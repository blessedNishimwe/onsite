-- ============================================================================
-- WOTI Attendance V2 - Database Indexes
-- Description: Performance indexes for frequently queried columns
-- ============================================================================

-- ============================================================================
-- REGIONS INDEXES
-- ============================================================================
CREATE INDEX idx_regions_is_active ON regions(is_active);

-- ============================================================================
-- COUNCILS INDEXES
-- ============================================================================
CREATE INDEX idx_councils_region_id ON councils(region_id);
CREATE INDEX idx_councils_is_active ON councils(is_active);

-- ============================================================================
-- FACILITIES INDEXES
-- ============================================================================
CREATE INDEX idx_facilities_council_id ON facilities(council_id);
CREATE INDEX idx_facilities_is_active ON facilities(is_active);
CREATE INDEX idx_facilities_facility_type ON facilities(facility_type);
CREATE INDEX idx_facilities_coordinates ON facilities(latitude, longitude);

-- ============================================================================
-- USERS INDEXES
-- ============================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_facility_id ON users(facility_id);
CREATE INDEX idx_users_supervisor_id ON users(supervisor_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ============================================================================
-- ATTENDANCE INDEXES
-- ============================================================================
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_facility_id ON attendance(facility_id);
CREATE INDEX idx_attendance_clock_in_time ON attendance(clock_in_time);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_synced ON attendance(synced);
CREATE INDEX idx_attendance_device_id ON attendance(device_id);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, clock_in_time);

-- ============================================================================
-- ACTIVITIES INDEXES
-- ============================================================================
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_entity_type ON activities(entity_type);
CREATE INDEX idx_activities_entity_id ON activities(entity_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);
