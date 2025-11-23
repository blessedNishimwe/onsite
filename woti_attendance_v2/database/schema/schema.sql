-- ============================================================================
-- WOTI Attendance V2 - Consolidated Schema
-- Version: 1.0.0
-- Description: Complete database schema for all tables
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Regions table
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Councils table
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

-- Facilities table
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

-- Users table
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

-- Attendance table
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

-- Activities table
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
