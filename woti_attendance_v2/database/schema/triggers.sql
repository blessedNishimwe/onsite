-- ============================================================================
-- WOTI Attendance V2 - Database Triggers
-- Description: Automatic triggers for timestamp updates
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for regions table
CREATE TRIGGER update_regions_updated_at 
    BEFORE UPDATE ON regions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for councils table
CREATE TRIGGER update_councils_updated_at 
    BEFORE UPDATE ON councils 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for facilities table
CREATE TRIGGER update_facilities_updated_at 
    BEFORE UPDATE ON facilities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for attendance table
CREATE TRIGGER update_attendance_updated_at 
    BEFORE UPDATE ON attendance 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
