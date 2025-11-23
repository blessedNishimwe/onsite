-- ============================================================================
-- WOTI Attendance V2 - Initial Database Schema
-- Version: 1.0.0
-- Date: 2025-11-23
-- Description: Complete schema for regions, councils, facilities, users, 
--              attendance, and activities tables with offline sync support
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: regions
-- Description: Top-level geographic hierarchy (e.g., Rwanda regions)
-- ============================================================================
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE regions IS 'Top-level geographic divisions';
COMMENT ON COLUMN regions.id IS 'Unique identifier for region';
COMMENT ON COLUMN regions.name IS 'Region name (e.g., Kigali City, Eastern Province)';
COMMENT ON COLUMN regions.code IS 'Short code for region';
COMMENT ON COLUMN regions.is_active IS 'Whether region is currently active';

-- ============================================================================
-- TABLE: councils
-- Description: Mid-level geographic hierarchy (districts/councils)
-- ============================================================================
CREATE TABLE councils (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(region_id, name)
);

COMMENT ON TABLE councils IS 'Mid-level geographic divisions (districts/councils)';
COMMENT ON COLUMN councils.id IS 'Unique identifier for council';
COMMENT ON COLUMN councils.region_id IS 'Reference to parent region';
COMMENT ON COLUMN councils.name IS 'Council/district name';
COMMENT ON COLUMN councils.code IS 'Short code for council';

-- ============================================================================
-- TABLE: facilities
-- Description: Health facilities with geolocation data
-- ============================================================================
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    council_id UUID NOT NULL REFERENCES councils(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    facility_type VARCHAR(50) CHECK (facility_type IN ('hospital', 'health_center', 'clinic', 'dispensary', 'other')),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR 
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

COMMENT ON TABLE facilities IS 'Health facilities with geolocation information';
COMMENT ON COLUMN facilities.id IS 'Unique identifier for facility';
COMMENT ON COLUMN facilities.council_id IS 'Reference to parent council';
COMMENT ON COLUMN facilities.latitude IS 'Facility latitude coordinate (-90 to 90)';
COMMENT ON COLUMN facilities.longitude IS 'Facility longitude coordinate (-180 to 180)';
COMMENT ON COLUMN facilities.metadata IS 'Additional facility metadata in JSON format';

-- ============================================================================
-- TABLE: users
-- Description: System users with roles, hierarchy, and facility assignments
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('tester', 'data_clerk', 'focal', 'ddo', 'supervisor', 'backstopper', 'admin')),
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON COLUMN users.id IS 'Unique identifier for user';
COMMENT ON COLUMN users.email IS 'User email address (used for login)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password (12 rounds)';
COMMENT ON COLUMN users.role IS 'User role for access control';
COMMENT ON COLUMN users.facility_id IS 'Assigned facility for user';
COMMENT ON COLUMN users.supervisor_id IS 'Reference to supervisor (self-referencing)';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata in JSON format';

-- ============================================================================
-- TABLE: attendance
-- Description: Clock in/out records with offline sync metadata
-- ============================================================================
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out_time TIMESTAMP WITH TIME ZONE,
    clock_in_latitude DECIMAL(10, 8),
    clock_in_longitude DECIMAL(11, 8),
    clock_out_latitude DECIMAL(10, 8),
    clock_out_longitude DECIMAL(11, 8),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    notes TEXT,
    
    -- Offline sync metadata
    synced BOOLEAN DEFAULT FALSE NOT NULL,
    client_timestamp TIMESTAMP WITH TIME ZONE,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(100),
    sync_version INTEGER DEFAULT 1 NOT NULL,
    conflict_resolution_strategy VARCHAR(20) DEFAULT 'server_wins' CHECK (
        conflict_resolution_strategy IN ('client_wins', 'server_wins', 'manual')
    ),
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT valid_clock_times CHECK (
        clock_out_time IS NULL OR clock_out_time > clock_in_time
    ),
    CONSTRAINT valid_clock_in_coordinates CHECK (
        (clock_in_latitude IS NULL AND clock_in_longitude IS NULL) OR 
        (clock_in_latitude BETWEEN -90 AND 90 AND clock_in_longitude BETWEEN -180 AND 180)
    ),
    CONSTRAINT valid_clock_out_coordinates CHECK (
        (clock_out_latitude IS NULL AND clock_out_longitude IS NULL) OR 
        (clock_out_latitude BETWEEN -90 AND 90 AND clock_out_longitude BETWEEN -180 AND 180)
    )
);

COMMENT ON TABLE attendance IS 'Attendance records with offline sync support';
COMMENT ON COLUMN attendance.id IS 'Unique identifier for attendance record';
COMMENT ON COLUMN attendance.user_id IS 'User who clocked in/out';
COMMENT ON COLUMN attendance.facility_id IS 'Facility where attendance occurred';
COMMENT ON COLUMN attendance.clock_in_time IS 'When user clocked in';
COMMENT ON COLUMN attendance.clock_out_time IS 'When user clocked out (NULL if still active)';
COMMENT ON COLUMN attendance.synced IS 'Whether record has been synced from mobile device';
COMMENT ON COLUMN attendance.client_timestamp IS 'Timestamp from mobile device';
COMMENT ON COLUMN attendance.server_timestamp IS 'Timestamp when server received record';
COMMENT ON COLUMN attendance.device_id IS 'Unique identifier for mobile device';
COMMENT ON COLUMN attendance.sync_version IS 'Version number for conflict resolution';
COMMENT ON COLUMN attendance.conflict_resolution_strategy IS 'Strategy for resolving sync conflicts';

-- ============================================================================
-- TABLE: activities
-- Description: Audit logs and system activity tracking
-- ============================================================================
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE activities IS 'Audit logs for tracking system activities';
COMMENT ON COLUMN activities.id IS 'Unique identifier for activity log';
COMMENT ON COLUMN activities.user_id IS 'User who performed the action';
COMMENT ON COLUMN activities.action IS 'Action performed (e.g., login, create, update, delete)';
COMMENT ON COLUMN activities.entity_type IS 'Type of entity affected (e.g., user, facility, attendance)';
COMMENT ON COLUMN activities.entity_id IS 'ID of the affected entity';
COMMENT ON COLUMN activities.ip_address IS 'IP address of the request';
COMMENT ON COLUMN activities.metadata IS 'Additional activity details in JSON format';

-- ============================================================================
-- INDEXES
-- Description: Indexes for optimizing frequently queried columns
-- ============================================================================

-- Regions indexes
CREATE INDEX idx_regions_is_active ON regions(is_active);

-- Councils indexes
CREATE INDEX idx_councils_region_id ON councils(region_id);
CREATE INDEX idx_councils_is_active ON councils(is_active);

-- Facilities indexes
CREATE INDEX idx_facilities_council_id ON facilities(council_id);
CREATE INDEX idx_facilities_is_active ON facilities(is_active);
CREATE INDEX idx_facilities_facility_type ON facilities(facility_type);
CREATE INDEX idx_facilities_coordinates ON facilities(latitude, longitude);

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_facility_id ON users(facility_id);
CREATE INDEX idx_users_supervisor_id ON users(supervisor_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Attendance indexes
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_facility_id ON attendance(facility_id);
CREATE INDEX idx_attendance_clock_in_time ON attendance(clock_in_time);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_synced ON attendance(synced);
CREATE INDEX idx_attendance_device_id ON attendance(device_id);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, clock_in_time);

-- Activities indexes
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_entity_type ON activities(entity_type);
CREATE INDEX idx_activities_entity_id ON activities(entity_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);

-- ============================================================================
-- TRIGGERS
-- Description: Automatic triggers for updating timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to regions
CREATE TRIGGER update_regions_updated_at 
    BEFORE UPDATE ON regions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to councils
CREATE TRIGGER update_councils_updated_at 
    BEFORE UPDATE ON councils 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to facilities
CREATE TRIGGER update_facilities_updated_at 
    BEFORE UPDATE ON facilities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to attendance
CREATE TRIGGER update_attendance_updated_at 
    BEFORE UPDATE ON attendance 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================
COMMENT ON SCHEMA public IS 'WOTI Attendance V2 - Initial schema created on 2025-11-23';
