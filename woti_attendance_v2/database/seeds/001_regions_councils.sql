-- ============================================================================
-- WOTI Attendance V2 - Seed Data for Rwanda Regions and Councils
-- Description: Initial geographic hierarchy data for Rwanda
-- ============================================================================

-- ============================================================================
-- REGIONS
-- ============================================================================
INSERT INTO regions (id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Kigali City', 'KGL', 'Capital city of Rwanda'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Eastern Province', 'EST', 'Eastern region of Rwanda'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Northern Province', 'NOR', 'Northern region of Rwanda'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Southern Province', 'SOU', 'Southern region of Rwanda'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Western Province', 'WST', 'Western region of Rwanda');

-- ============================================================================
-- COUNCILS (DISTRICTS) - KIGALI CITY
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Gasabo', 'GSB', 'Gasabo District'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Kicukiro', 'KCK', 'Kicukiro District'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Nyarugenge', 'NYG', 'Nyarugenge District');

-- ============================================================================
-- COUNCILS (DISTRICTS) - EASTERN PROVINCE
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440002', 'Bugesera', 'BUG', 'Bugesera District'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Gatsibo', 'GAT', 'Gatsibo District'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Kayonza', 'KYZ', 'Kayonza District'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Kirehe', 'KRH', 'Kirehe District'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Ngoma', 'NGM', 'Ngoma District'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Nyagatare', 'NYT', 'Nyagatare District'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Rwamagana', 'RWM', 'Rwamagana District');

-- ============================================================================
-- COUNCILS (DISTRICTS) - NORTHERN PROVINCE
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440003', 'Burera', 'BUR', 'Burera District'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Gakenke', 'GKE', 'Gakenke District'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Gicumbi', 'GCM', 'Gicumbi District'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Musanze', 'MSZ', 'Musanze District'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Rulindo', 'RLD', 'Rulindo District');

-- ============================================================================
-- COUNCILS (DISTRICTS) - SOUTHERN PROVINCE
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440004', 'Gisagara', 'GSG', 'Gisagara District'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Huye', 'HUY', 'Huye District'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Kamonyi', 'KMY', 'Kamonyi District'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Muhanga', 'MHG', 'Muhanga District'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Nyamagabe', 'NYM', 'Nyamagabe District'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Nyanza', 'NYZ', 'Nyanza District'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Nyaruguru', 'NYR', 'Nyaruguru District'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Ruhango', 'RHG', 'Ruhango District');

-- ============================================================================
-- COUNCILS (DISTRICTS) - WESTERN PROVINCE
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440005', 'Karongi', 'KRG', 'Karongi District'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Ngororero', 'NGR', 'Ngororero District'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Nyabihu', 'NYB', 'Nyabihu District'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Nyamasheke', 'NYS', 'Nyamasheke District'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Rubavu', 'RBV', 'Rubavu District'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Rusizi', 'RSZ', 'Rusizi District'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Rutsiro', 'RTS', 'Rutsiro District');

-- Verify data insertion
SELECT 
    r.name as region_name, 
    COUNT(c.id) as council_count 
FROM regions r 
LEFT JOIN councils c ON r.id = c.region_id 
GROUP BY r.name 
ORDER BY r.name;
