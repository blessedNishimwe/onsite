-- ============================================================================
-- WOTI Attendance V2 - Email Verification Migration
-- Version: 1.1.0
-- Date: 2025-11-24
-- Description: Add email verification columns to users table
-- ============================================================================

-- Add email verification columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE;

-- Add index for verification token lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Update existing users to have email_verified = TRUE (since they were created by admins)
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

-- Add comments for new columns
COMMENT ON COLUMN users.email_verified IS 'Whether user email has been verified';
COMMENT ON COLUMN users.verification_token IS 'Token for email verification (6-digit code or UUID)';
COMMENT ON COLUMN users.verification_token_expires IS 'Expiration timestamp for verification token';

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================
COMMENT ON TABLE users IS 'System users with role-based access control and email verification';
