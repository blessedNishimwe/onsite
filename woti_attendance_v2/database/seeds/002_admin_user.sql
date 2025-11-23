-- ============================================================================
-- WOTI Attendance V2 - Initial Admin User
-- Description: Create default admin user for system access
-- Note: Password is "Admin@123" - MUST be changed after first login
-- ============================================================================

-- Insert admin user
-- Password: Admin@123 (bcrypt hash with 12 rounds)
INSERT INTO users (
    id,
    email,
    phone,
    password_hash,
    first_name,
    last_name,
    role,
    is_active,
    metadata
) VALUES (
    '550e8400-e29b-41d4-a716-446655440100',
    'admin@woti.rw',
    '+250788000000',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU8vGmF3Uway',
    'System',
    'Administrator',
    'admin',
    TRUE,
    '{"initial_admin": true, "created_by": "system"}'::jsonb
);

-- Log admin creation activity
INSERT INTO activities (
    action,
    entity_type,
    entity_id,
    description,
    metadata
) VALUES (
    'create',
    'user',
    '550e8400-e29b-41d4-a716-446655440100',
    'Initial admin user created during system setup',
    '{"setup": true, "role": "admin"}'::jsonb
);

-- Verify admin user creation
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    created_at
FROM users 
WHERE role = 'admin';

-- Security reminder
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SECURITY REMINDER:';
    RAISE NOTICE 'Default admin credentials:';
    RAISE NOTICE 'Email: admin@woti.rw';
    RAISE NOTICE 'Password: Admin@123';
    RAISE NOTICE '';
    RAISE NOTICE 'CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!';
    RAISE NOTICE '============================================================';
END $$;
