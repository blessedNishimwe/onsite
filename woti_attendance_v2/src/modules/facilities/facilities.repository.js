// src/modules/facilities/facilities.repository.js
/**
 * Facilities Repository
 * Database queries for facilities
 */

const { query, getClient } = require('../../config/database');

/**
 * Find facility by ID
 * @param {string} facilityId - Facility ID
 * @returns {Promise<Object>} Facility with hierarchy
 */
const findById = async (facilityId) => {
  const result = await query(
    `SELECT 
      f.*,
      c.id as council_id,
      c.name as council_name,
      c.code as council_code,
      r.id as region_id,
      r.name as region_name,
      r.code as region_code
    FROM facilities f
    LEFT JOIN councils c ON f.council_id = c.id
    LEFT JOIN regions r ON c.region_id = r.id
    WHERE f.id = $1`,
    [facilityId]
  );
  
  return result.rows[0] || null;
};

/**
 * Find all facilities with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Facilities list
 */
const findAll = async (filters = {}) => {
  const {
    council_id,
    region_id,
    facility_type,
    is_active,
    search,
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = filters;
  
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  if (council_id) {
    conditions.push(`f.council_id = $${paramIndex++}`);
    params.push(council_id);
  }
  
  if (region_id) {
    conditions.push(`c.region_id = $${paramIndex++}`);
    params.push(region_id);
  }
  
  if (facility_type) {
    conditions.push(`f.facility_type = $${paramIndex++}`);
    params.push(facility_type);
  }
  
  if (is_active !== undefined) {
    conditions.push(`f.is_active = $${paramIndex++}`);
    params.push(is_active);
  }
  
  if (search) {
    conditions.push(`(f.name ILIKE $${paramIndex} OR f.code ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const allowedSortColumns = ['created_at', 'updated_at', 'name', 'code', 'facility_type'];
  const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  const countQuery = `
    SELECT COUNT(*) 
    FROM facilities f
    LEFT JOIN councils c ON f.council_id = c.id
    ${whereClause}
  `;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  params.push(limit, offset);
  const facilitiesQuery = `
    SELECT 
      f.*,
      c.name as council_name,
      r.name as region_name
    FROM facilities f
    LEFT JOIN councils c ON f.council_id = c.id
    LEFT JOIN regions r ON c.region_id = r.id
    ${whereClause}
    ORDER BY f.${validSortBy} ${validSortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;
  
  const result = await query(facilitiesQuery, params);
  
  return {
    facilities: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Create new facility
 * @param {Object} facilityData - Facility data
 * @returns {Promise<Object>} Created facility
 */
const create = async (facilityData) => {
  const result = await query(
    `INSERT INTO facilities (
      council_id, name, code, facility_type, latitude, longitude,
      address, phone, email, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      facilityData.council_id,
      facilityData.name,
      facilityData.code || null,
      facilityData.facility_type || 'other',
      facilityData.latitude || null,
      facilityData.longitude || null,
      facilityData.address || null,
      facilityData.phone || null,
      facilityData.email || null,
      facilityData.metadata || {}
    ]
  );
  
  return result.rows[0];
};

/**
 * Bulk insert facilities (for CSV import)
 * @param {Array} facilities - Array of facility objects
 * @returns {Promise<Object>} Insert results
 */
const bulkInsert = async (facilities) => {
  const client = await getClient();
  const results = { inserted: 0, errors: [] };
  
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i];
      
      try {
        await client.query(
          `INSERT INTO facilities (
            council_id, name, code, facility_type, latitude, longitude,
            address, phone, email, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            facility.council_id,
            facility.name,
            facility.code || null,
            facility.facility_type || 'other',
            facility.latitude || null,
            facility.longitude || null,
            facility.address || null,
            facility.phone || null,
            facility.email || null,
            facility.metadata || {}
          ]
        );
        
        results.inserted++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          facility: facility.name,
          error: error.message
        });
      }
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  return results;
};

/**
 * Update facility
 * @param {string} facilityId - Facility ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated facility
 */
const update = async (facilityId, updateData) => {
  const fields = [];
  const params = [];
  let paramIndex = 1;
  
  const allowedFields = [
    'council_id', 'name', 'code', 'facility_type', 'latitude', 'longitude',
    'address', 'phone', 'email', 'is_active', 'metadata'
  ];
  
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      fields.push(`${field} = $${paramIndex++}`);
      params.push(updateData[field]);
    }
  }
  
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  
  params.push(facilityId);
  const updateQuery = `
    UPDATE facilities
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  
  const result = await query(updateQuery, params);
  
  if (result.rows.length === 0) {
    throw new Error('Facility not found');
  }
  
  return result.rows[0];
};

/**
 * Delete facility (soft delete)
 * @param {string} facilityId - Facility ID
 * @returns {Promise<boolean>} Success status
 */
const remove = async (facilityId) => {
  const result = await query(
    'UPDATE facilities SET is_active = FALSE WHERE id = $1 RETURNING id',
    [facilityId]
  );
  
  return result.rows.length > 0;
};

/**
 * Find council by name or code
 * @param {string} identifier - Council name or code
 * @returns {Promise<Object>} Council
 */
const findCouncilByIdentifier = async (identifier) => {
  const result = await query(
    'SELECT * FROM councils WHERE name ILIKE $1 OR code ILIKE $1',
    [identifier]
  );
  
  return result.rows[0] || null;
};

module.exports = {
  findById,
  findAll,
  create,
  bulkInsert,
  update,
  remove,
  findCouncilByIdentifier
};
