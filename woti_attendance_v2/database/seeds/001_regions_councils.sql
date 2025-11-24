-- ============================================================================
-- WOTI Attendance V2 - Tanzania Regions and Councils
-- Description: Geographic hierarchy data for Tanzania (6 regions)
-- ============================================================================

-- Clean existing data (keep admin user)
DELETE FROM attendance;
DELETE FROM users WHERE email != 'admin@woti.rw';
DELETE FROM facilities;
DELETE FROM councils;
DELETE FROM regions;

-- ============================================================================
-- TANZANIA REGIONS
-- ============================================================================
INSERT INTO regions (id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Ruvuma', 'RUV', 'Ruvuma Region, Tanzania'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Iringa', 'IRI', 'Iringa Region, Tanzania'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Morogoro', 'MOR', 'Morogoro Region, Tanzania'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Njombe', 'NJO', 'Njombe Region, Tanzania'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Lindi', 'LIN', 'Lindi Region, Tanzania'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Mtwara', 'MTW', 'Mtwara Region, Tanzania');

-- ============================================================================
-- RUVUMA REGION COUNCILS
-- Region ID: 550e8400-e29b-41d4-a716-446655440001
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Mbinga District Council', 'MBG', 'Mbinga District, Ruvuma'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Songea Municipal Council', 'SGM', 'Songea Municipal, Ruvuma'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Songea District Council', 'SGD', 'Songea District, Ruvuma'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Nyasa District Council', 'NYS', 'Nyasa District, Ruvuma'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Madaba District Council', 'MDB', 'Madaba District, Ruvuma'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Namtumbo District Council', 'NMT', 'Namtumbo District, Ruvuma'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Tunduru District Council', 'TND', 'Tunduru District, Ruvuma'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Mbinga Town Council', 'MBT', 'Mbinga Town, Ruvuma');

-- ============================================================================
-- IRINGA REGION COUNCILS
-- Region ID: 550e8400-e29b-41d4-a716-446655440002
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440002', 'Iringa Municipal Council', 'IRM', 'Iringa Municipal, Iringa'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Iringa District Council', 'IRD', 'Iringa District, Iringa'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Kilolo District Council', 'KIL', 'Kilolo District, Iringa'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Mufindi District Council', 'MUF', 'Mufindi District, Iringa'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Mafinga Town Council', 'MAF', 'Mafinga Town, Iringa');

-- ============================================================================
-- MOROGORO REGION COUNCILS
-- Region ID: 550e8400-e29b-41d4-a716-446655440003
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440003', 'Morogoro Municipal Council', 'MGM', 'Morogoro Municipal, Morogoro'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Morogoro District Council', 'MGD', 'Morogoro District, Morogoro'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Kilombero District Council', 'KLB', 'Kilombero District, Morogoro'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Kilosa District Council', 'KLS', 'Kilosa District, Morogoro'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Ulanga District Council', 'ULG', 'Ulanga District, Morogoro'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Mvomero District Council', 'MVO', 'Mvomero District, Morogoro'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Malinyi District Council', 'MLI', 'Malinyi District, Morogoro'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Gairo District Council', 'GAI', 'Gairo District, Morogoro');

-- ============================================================================
-- NJOMBE REGION COUNCILS
-- Region ID: 550e8400-e29b-41d4-a716-446655440004
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440004', 'Njombe Town Council', 'NJT', 'Njombe Town, Njombe'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Njombe District Council', 'NJD', 'Njombe District, Njombe'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Ludewa District Council', 'LUD', 'Ludewa District, Njombe'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Makambako Town Council', 'MAK', 'Makambako Town, Njombe'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Makete District Council', 'MKE', 'Makete District, Njombe'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Wanging''ombe District Council', 'WNG', 'Wanging''ombe District, Njombe');

-- ============================================================================
-- LINDI REGION COUNCILS
-- Region ID: 550e8400-e29b-41d4-a716-446655440005
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440005', 'Lindi Municipal Council', 'LNM', 'Lindi Municipal, Lindi'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Lindi District Council', 'LND', 'Lindi District, Lindi'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Kilwa District Council', 'KLW', 'Kilwa District, Lindi'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Liwale District Council', 'LIW', 'Liwale District, Lindi'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Nachingwea District Council', 'NCH', 'Nachingwea District, Lindi'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Ruangwa District Council', 'RUA', 'Ruangwa District, Lindi');

-- ============================================================================
-- MTWARA REGION COUNCILS
-- Region ID: 550e8400-e29b-41d4-a716-446655440006
-- ============================================================================
INSERT INTO councils (region_id, name, code, description) VALUES
    ('550e8400-e29b-41d4-a716-446655440006', 'Mtwara Municipal Council', 'MTM', 'Mtwara Municipal, Mtwara'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Mtwara District Council', 'MTD', 'Mtwara District, Mtwara'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Masasi Town Council', 'MST', 'Masasi Town, Mtwara'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Masasi District Council', 'MSD', 'Masasi District, Mtwara'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Nanyumbu District Council', 'NNY', 'Nanyumbu District, Mtwara'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Newala District Council', 'NEW', 'Newala District, Mtwara'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Tandahimba District Council', 'TND', 'Tandahimba District, Mtwara');

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
SELECT 
    r.name as region_name, 
    r.code as region_code,
    COUNT(c.id) as council_count 
FROM regions r 
LEFT JOIN councils c ON r.id = c.region_id 
GROUP BY r.name, r.code
ORDER BY r.name;

-- Display detailed breakdown
SELECT 
    r.name as region,
    c.name as council,
    c.code
FROM regions r
JOIN councils c ON r.id = c.region_id
ORDER BY r.name, c.name;

SELECT '✅ Tanzania regions and councils created successfully!' as status;