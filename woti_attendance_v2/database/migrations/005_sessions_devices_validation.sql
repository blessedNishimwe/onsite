-- ============================================================================
-- WOTI Attendance V2 - Sessions, Devices, and Validation Migration
-- Version: 1.0.5
-- Date: 2025-11-28
-- Description: Adds user_devices, user_sessions tables and validation columns
--              to attendance table for enhanced security
-- ============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: user_devices
-- Description: Track registered devices for each user
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    browser TEXT,
    platform VARCHAR(20),
    is_active BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_fingerprint)
);

COMMENT ON TABLE user_devices IS 'Registered devices for each user';
COMMENT ON COLUMN user_devices.device_fingerprint IS 'Unique fingerprint identifying the device';
COMMENT ON COLUMN user_devices.is_active IS 'Whether device is approved for use';
COMMENT ON COLUMN user_devices.approved_by IS 'Admin who approved the device';

-- ============================================================================
-- TABLE: user_sessions
-- Description: Active sessions with token tracking for session management
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint TEXT,
    token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    invalidated_at TIMESTAMPTZ,
    invalidation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_sessions IS 'Active user sessions with token tracking';
COMMENT ON COLUMN user_sessions.token_hash IS 'Hash of the JWT token for validation';
COMMENT ON COLUMN user_sessions.is_active IS 'Whether session is currently active';
COMMENT ON COLUMN user_sessions.invalidation_reason IS 'Reason for invalidation (new_login, logout, admin_action)';

-- ============================================================================
-- ALTER TABLE: attendance
-- Description: Add validation and accuracy tracking columns
-- ============================================================================
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS clock_in_accuracy_meters FLOAT,
ADD COLUMN IF NOT EXISTS clock_out_accuracy_meters FLOAT,
ADD COLUMN IF NOT EXISTS clock_in_distance_meters FLOAT,
ADD COLUMN IF NOT EXISTS clock_out_distance_meters FLOAT,
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'verified';

-- Add check constraint for validation_status (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'attendance_validation_status_check'
    ) THEN
        ALTER TABLE attendance
        ADD CONSTRAINT attendance_validation_status_check 
        CHECK (validation_status IN ('verified', 'unverified', 'flagged', 'rejected', 'approved'));
    END IF;
END $$;

COMMENT ON COLUMN attendance.clock_in_accuracy_meters IS 'GPS accuracy at clock-in in meters';
COMMENT ON COLUMN attendance.clock_out_accuracy_meters IS 'GPS accuracy at clock-out in meters';
COMMENT ON COLUMN attendance.clock_in_distance_meters IS 'Distance from facility at clock-in';
COMMENT ON COLUMN attendance.clock_out_distance_meters IS 'Distance from facility at clock-out';
COMMENT ON COLUMN attendance.device_fingerprint IS 'Device fingerprint used for clock-in';
COMMENT ON COLUMN attendance.validation_status IS 'GPS validation status: verified, unverified, flagged, rejected, approved';

-- ============================================================================
-- INDEXES
-- Description: Indexes for optimizing session and device queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON user_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_attendance_validation_status ON attendance(validation_status);
CREATE INDEX IF NOT EXISTS idx_attendance_device_fingerprint ON attendance(device_fingerprint);

-- ============================================================================
-- TRIGGERS
-- Description: Apply updated_at trigger to new tables
-- ============================================================================
DROP TRIGGER IF EXISTS update_user_devices_updated_at ON user_devices;
CREATE TRIGGER update_user_devices_updated_at 
    BEFORE UPDATE ON user_devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================
COMMENT ON TABLE user_devices IS 'WOTI Attendance V2 - User devices table added on 2025-11-28';
COMMENT ON TABLE user_sessions IS 'WOTI Attendance V2 - User sessions table added on 2025-11-28';
