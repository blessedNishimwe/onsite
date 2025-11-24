require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'woti_attendance',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'pg2025'
});

async function importFacilities() {
  const client = await pool.connect();
  
  try {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║   WOTI ATTENDANCE V2 - FACILITY IMPORT TOOL      ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
    console.log('🔵 Starting facility import...\n');
    
    const csvPath = path.join(__dirname, '../../onsite_woti.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      return;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    console.log(`📄 Found ${lines.length} lines in CSV\n`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorLog = [];
    
    const stats = new Map();
    
    // Process each line individually (no global transaction)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith(',,,')) continue;
      
      const parts = line.split(',');
      
      if (parts.length < 5) {
        skipped++;
        continue;
      }
      
      const regionName = parts[0]?.trim();
      const councilName = parts[1]?.trim();
      const facilityName = parts[2]?.trim();
      const latitude = parseFloat(parts[3]) || null;
      const longitude = parseFloat(parts[4]) || null;
      
      if (!regionName || !councilName || !facilityName) {
        skipped++;
        continue;
      }
      
      if (regionName.toLowerCase().includes('tier') || 
          regionName.toLowerCase().includes('total') ||
          facilityName.toLowerCase().includes('total')) {
        skipped++;
        continue;
      }
      
      try {
        // Start individual transaction for each facility
        await client.query('BEGIN');
        
        // Get or create region
        let regionResult = await client.query(
          'SELECT id FROM regions WHERE name = $1',
          [regionName]
        );
        
        let regionId;
        if (regionResult.rows.length === 0) {
          const code = regionName.substring(0, 3).toUpperCase();
          regionResult = await client.query(
            'INSERT INTO regions (name, code, description) VALUES ($1, $2, $3) RETURNING id',
            [regionName, code, `${regionName} Region, Tanzania`]
          );
          regionId = regionResult.rows[0].id;
        } else {
          regionId = regionResult.rows[0].id;
        }
        
        // Get or create council
        let councilResult = await client.query(
          'SELECT id FROM councils WHERE name = $1 AND region_id = $2',
          [councilName, regionId]
        );
        
        let councilId;
        if (councilResult.rows.length === 0) {
          const code = councilName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
          councilResult = await client.query(
            'INSERT INTO councils (region_id, name, code) VALUES ($1, $2, $3) RETURNING id',
            [regionId, councilName, code]
          );
          councilId = councilResult.rows[0].id;
        } else {
          councilId = councilResult.rows[0].id;
        }
        
        // Determine facility type
        let facilityType = 'other';
        const nameLower = facilityName.toLowerCase();
        if (nameLower.includes('hospital')) facilityType = 'hospital';
        else if (nameLower.includes('health center')) facilityType = 'health_center';
        else if (nameLower.includes('dispensary')) facilityType = 'dispensary';
        else if (nameLower.includes('clinic')) facilityType = 'clinic';
        
        const isActive = latitude && longitude && !(latitude === 0 && longitude === 0);
        
        // Check for duplicates
        const existingFacility = await client.query(
          'SELECT id FROM facilities WHERE name = $1 AND council_id = $2',
          [facilityName, councilId]
        );
        
        if (existingFacility.rows.length > 0) {
          await client.query('ROLLBACK');
          skipped++;
          continue;
        }
        
        // Insert facility
        await client.query(`
          INSERT INTO facilities (
            council_id, name, latitude, longitude, facility_type, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [councilId, facilityName, latitude, longitude, facilityType, isActive]);
        
        await client.query('COMMIT');
        
        imported++;
        
        const key = `${regionName}|${councilName}`;
        stats.set(key, (stats.get(key) || 0) + 1);
        
        if (imported % 10 === 0) {
          process.stdout.write(`\r  ⏳ Imported ${imported} facilities...`);
        }
        
      } catch (error) {
        await client.query('ROLLBACK');
        errors++;
        errorLog.push({
          line: i + 1,
          facility: facilityName,
          error: error.message
        });
      }
    }
    
    console.log('\n\n✅ Import complete!\n');
    console.log('📊 SUMMARY:');
    console.log(`  ✅ Facilities imported: ${imported}`);
    console.log(`  ⚠️  Facilities skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    if (errors > 0 && errorLog.length > 0) {
      console.log('\n❌ ERROR DETAILS (first 10):');
      errorLog.slice(0, 10).forEach(err => {
        console.log(`  Line ${err.line}: ${err.facility}`);
        console.log(`    → ${err.error}`);
      });
      
      // Save full error log to file
      const errorFile = path.join(__dirname, 'import-errors.log');
      fs.writeFileSync(errorFile, JSON.stringify(errorLog, null, 2));
      console.log(`\n  📄 Full error log saved to: ${errorFile}`);
    }
    
    console.log('');
    
    if (stats.size > 0) {
      console.log('📍 BREAKDOWN BY COUNCIL:');
      const sortedStats = Array.from(stats.entries()).sort();
      for (const [key, count] of sortedStats) {
        const [region, council] = key.split('|');
        console.log(`  ${region} → ${council}: ${count} facilities`);
      }
      console.log('');
    }
    
    // Show actual database totals
    const totals = await client.query(`
      SELECT 
        r.name as region,
        COUNT(DISTINCT c.id) as councils,
        COUNT(f.id) as facilities,
        SUM(CASE WHEN f.is_active THEN 1 ELSE 0 END) as active_facilities
      FROM regions r
      LEFT JOIN councils c ON c.region_id = r.id
      LEFT JOIN facilities f ON f.council_id = c.id
      GROUP BY r.name
      ORDER BY r.name
    `);
    
    console.log('📋 DATABASE TOTALS:');
    console.log('  Region       | Councils | Facilities | Active');
    console.log('  -------------|----------|------------|-------');
    for (const row of totals.rows) {
      const region = row.region.padEnd(12);
      const councils = String(row.councils || 0).padStart(8);
      const facilities = String(row.facilities || 0).padStart(10);
      const active = String(row.active_facilities || 0).padStart(6);
      console.log(`  ${region} |${councils} |${facilities} |${active}`);
    }
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importFacilities()
  .then(() => {
    console.log('\n🎉 All done!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err.message);
    process.exit(1);
  });