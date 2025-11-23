// src/modules/facilities/facilities.service.js
/**
 * Facilities Service
 * Business logic for facility operations including CSV/Excel import
 */

const fs = require('fs').promises;
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { createReadStream } = require('fs');
const facilitiesRepository = require('./facilities.repository');
const { isValidCoordinates } = require('../../utils/validators');
const logger = require('../../utils/logger');
const { query } = require('../../config/database');

/**
 * Parse CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} Parsed data
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    
    createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

/**
 * Parse Excel file
 * @param {string} filePath - Path to Excel file
 * @returns {Promise<Array>} Parsed data
 */
const parseExcel = async (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  return data;
};

/**
 * Validate and transform facility data
 * @param {Object} row - Raw data row
 * @param {number} rowIndex - Row number for error reporting
 * @returns {Object} Validation result
 */
const validateFacilityRow = async (row, rowIndex) => {
  const errors = [];
  
  // Required fields
  if (!row.name && !row.facility_name) {
    errors.push('Facility name is required');
  }
  
  if (!row.council && !row.district && !row.council_name) {
    errors.push('Council/District is required');
  }
  
  // Validate coordinates if provided
  const lat = parseFloat(row.latitude || row.lat);
  const lon = parseFloat(row.longitude || row.lon || row.long);
  
  if ((lat && !lon) || (!lat && lon)) {
    errors.push('Both latitude and longitude must be provided');
  } else if (lat && lon && !isValidCoordinates(lat, lon)) {
    errors.push('Invalid coordinates');
  }
  
  // Find council
  const councilIdentifier = row.council || row.district || row.council_name;
  let council = null;
  
  if (councilIdentifier) {
    council = await facilitiesRepository.findCouncilByIdentifier(councilIdentifier);
    if (!council) {
      errors.push(`Council/District not found: ${councilIdentifier}`);
    }
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      row: rowIndex
    };
  }
  
  // Transform to facility object
  const facilityType = (row.type || row.facility_type || 'other').toLowerCase();
  const validTypes = ['hospital', 'health_center', 'clinic', 'dispensary', 'other'];
  
  return {
    valid: true,
    facility: {
      council_id: council.id,
      name: row.name || row.facility_name,
      code: row.code || row.facility_code || null,
      facility_type: validTypes.includes(facilityType) ? facilityType : 'other',
      latitude: lat || null,
      longitude: lon || null,
      address: row.address || null,
      phone: row.phone || row.telephone || null,
      email: row.email || null,
      metadata: {
        imported: true,
        import_row: rowIndex,
        original_data: row
      }
    }
  };
};

/**
 * Import facilities from CSV/Excel file
 * @param {Object} file - Uploaded file
 * @param {Object} user - User performing import
 * @returns {Promise<Object>} Import results
 */
const importFacilities = async (file, user) => {
  try {
    logger.info('Starting facility import', {
      filename: file.originalname,
      size: file.size,
      userId: user.id
    });
    
    // Parse file based on type
    let rawData;
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      rawData = await parseCSV(file.path);
    } else {
      rawData = await parseExcel(file.path);
    }
    
    logger.info(`Parsed ${rawData.length} rows from file`);
    
    // Validate and transform data
    const validationResults = [];
    for (let i = 0; i < rawData.length; i++) {
      const result = await validateFacilityRow(rawData[i], i + 2); // +2 for header and 1-based indexing
      validationResults.push(result);
    }
    
    // Separate valid and invalid rows
    const validFacilities = validationResults
      .filter(r => r.valid)
      .map(r => r.facility);
    
    const invalidRows = validationResults
      .filter(r => !r.valid);
    
    logger.info(`Validation complete: ${validFacilities.length} valid, ${invalidRows.length} invalid`);
    
    // Insert valid facilities
    let importResults = { inserted: 0, errors: [] };
    
    if (validFacilities.length > 0) {
      importResults = await facilitiesRepository.bulkInsert(validFacilities);
    }
    
    // Log activity
    await query(
      `INSERT INTO activities (user_id, action, entity_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'import',
        'facility',
        `Imported ${importResults.inserted} facilities from ${file.originalname}`,
        JSON.stringify({
          filename: file.originalname,
          total_rows: rawData.length,
          valid_rows: validFacilities.length,
          invalid_rows: invalidRows.length,
          inserted: importResults.inserted,
          errors: importResults.errors.length
        })
      ]
    );
    
    // Clean up uploaded file
    try {
      await fs.unlink(file.path);
    } catch (err) {
      logger.error('Failed to delete uploaded file', err);
    }
    
    return {
      success: true,
      summary: {
        total_rows: rawData.length,
        valid_rows: validFacilities.length,
        invalid_rows: invalidRows.length,
        inserted: importResults.inserted,
        failed: importResults.errors.length
      },
      validation_errors: invalidRows,
      insert_errors: importResults.errors
    };
  } catch (error) {
    logger.error('Facility import failed', error);
    
    // Clean up uploaded file on error
    try {
      await fs.unlink(file.path);
    } catch (err) {
      // Ignore cleanup errors
    }
    
    throw error;
  }
};

/**
 * Get facility by ID
 * @param {string} facilityId - Facility ID
 * @returns {Promise<Object>} Facility details
 */
const getFacilityById = async (facilityId) => {
  const facility = await facilitiesRepository.findById(facilityId);
  
  if (!facility) {
    throw new Error('Facility not found');
  }
  
  return facility;
};

/**
 * Get all facilities
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Facilities list
 */
const getAllFacilities = async (filters) => {
  return await facilitiesRepository.findAll(filters);
};

/**
 * Create facility
 * @param {Object} facilityData - Facility data
 * @param {Object} user - User creating facility
 * @returns {Promise<Object>} Created facility
 */
const createFacility = async (facilityData, user) => {
  const facility = await facilitiesRepository.create(facilityData);
  
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user.id,
      'create',
      'facility',
      facility.id,
      `Facility ${facility.name} created`,
      JSON.stringify({ created_by: user.email })
    ]
  );
  
  logger.info('Facility created', { facilityId: facility.id, userId: user.id });
  
  return facility;
};

/**
 * Update facility
 * @param {string} facilityId - Facility ID
 * @param {Object} updateData - Update data
 * @param {Object} user - User updating facility
 * @returns {Promise<Object>} Updated facility
 */
const updateFacility = async (facilityId, updateData, user) => {
  const facility = await facilitiesRepository.update(facilityId, updateData);
  
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user.id,
      'update',
      'facility',
      facilityId,
      `Facility ${facility.name} updated`,
      JSON.stringify({ updated_by: user.email, fields: Object.keys(updateData) })
    ]
  );
  
  logger.info('Facility updated', { facilityId, userId: user.id });
  
  return facility;
};

/**
 * Delete facility
 * @param {string} facilityId - Facility ID
 * @param {Object} user - User deleting facility
 * @returns {Promise<boolean>} Success status
 */
const deleteFacility = async (facilityId, user) => {
  const facility = await facilitiesRepository.findById(facilityId);
  
  if (!facility) {
    throw new Error('Facility not found');
  }
  
  const success = await facilitiesRepository.remove(facilityId);
  
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user.id,
      'delete',
      'facility',
      facilityId,
      `Facility ${facility.name} deactivated`,
      JSON.stringify({ deleted_by: user.email })
    ]
  );
  
  logger.info('Facility deleted', { facilityId, userId: user.id });
  
  return success;
};

module.exports = {
  importFacilities,
  getFacilityById,
  getAllFacilities,
  createFacility,
  updateFacility,
  deleteFacility
};
