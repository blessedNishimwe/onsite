-- ============================================================================
-- WOTI Attendance V2 - Timesheet Activities Migration
-- Version: 1.0.0
-- Date: 2025-11-27
-- Description: Adds timesheet activities table and links to attendance
-- ============================================================================

-- Enable uuid-ossp if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: timesheet_activities
-- Description: Predefined activities for timesheet categorization
-- ============================================================================
CREATE TABLE IF NOT EXISTS timesheet_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE timesheet_activities IS 'Predefined activities for timesheet categorization';
COMMENT ON COLUMN timesheet_activities.id IS 'Unique identifier for activity';
COMMENT ON COLUMN timesheet_activities.name IS 'Activity name (unique)';
COMMENT ON COLUMN timesheet_activities.description IS 'Description of the activity';
COMMENT ON COLUMN timesheet_activities.is_active IS 'Whether activity is available for selection';
COMMENT ON COLUMN timesheet_activities.display_order IS 'Order for display in dropdowns';

-- ============================================================================
-- ALTER TABLE: attendance
-- Description: Add activity columns to attendance table
-- ============================================================================
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES timesheet_activities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activity_description TEXT;

COMMENT ON COLUMN attendance.activity_id IS 'Reference to timesheet activity';
COMMENT ON COLUMN attendance.activity_description IS 'Additional description for the activity';

-- ============================================================================
-- INDEXES
-- Description: Indexes for optimizing timesheet queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_attendance_activity_id ON attendance(activity_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_activities_active ON timesheet_activities(is_active);
CREATE INDEX IF NOT EXISTS idx_timesheet_activities_display_order ON timesheet_activities(display_order);

-- ============================================================================
-- TRIGGER: Update timestamp
-- Description: Automatically update updated_at on modification
-- ============================================================================
CREATE TRIGGER update_timesheet_activities_updated_at 
    BEFORE UPDATE ON timesheet_activities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Default activities
-- Description: Insert default timesheet activities
-- ============================================================================
INSERT INTO timesheet_activities (name, description, display_order) VALUES
('Field Supervision', 'On-site supervision and oversight activities', 1),
('Data Collection', 'Collecting and recording field data', 2),
('Training Support', 'Conducting or supporting training sessions', 3),
('Community Engagement', 'Community outreach and engagement activities', 4),
('Reporting', 'Preparing and submitting reports', 5),
('Monitoring & Evaluation', 'M&E activities and assessments', 6),
('Facility Visits', 'Visiting health facilities', 7),
('Administrative Work', 'Office-based administrative tasks', 8),
('Meetings', 'Attending or conducting meetings', 9),
('Travel', 'Travel between locations', 10),
('Other', 'Other activities not listed', 99)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================
COMMENT ON SCHEMA public IS 'WOTI Attendance V2 - Timesheet activities migration applied';
