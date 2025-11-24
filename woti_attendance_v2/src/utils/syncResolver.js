// src/utils/syncResolver.js
/**
 * Offline Sync Conflict Resolution Logic
 * Handles conflicts when mobile devices sync attendance data
 */

const logger = require('./logger');

/**
 * Conflict resolution strategies
 */
const STRATEGIES = {
  CLIENT_WINS: 'client_wins',
  SERVER_WINS: 'server_wins',
  MANUAL: 'manual'
};

/**
 * Resolve conflict between client and server records
 * @param {Object} clientRecord - Record from mobile device
 * @param {Object} serverRecord - Existing record on server
 * @param {string} strategy - Resolution strategy
 * @returns {Object} Resolved record and metadata
 */
const resolveConflict = (clientRecord, serverRecord, strategy) => {
  logger.info('Resolving sync conflict', {
    clientId: clientRecord.id,
    serverId: serverRecord?.id,
    strategy
  });
  
  // No conflict if server record doesn't exist
  if (!serverRecord) {
    return {
      resolved: clientRecord,
      action: 'insert',
      conflict: false
    };
  }
  
  // Check if records are actually different
  const hasConflict = detectConflict(clientRecord, serverRecord);
  
  if (!hasConflict) {
    return {
      resolved: serverRecord,
      action: 'no_change',
      conflict: false
    };
  }
  
  // Apply resolution strategy
  switch (strategy) {
  case STRATEGIES.CLIENT_WINS:
    return {
      resolved: mergeRecords(clientRecord, serverRecord, 'client'),
      action: 'update',
      conflict: true,
      resolution: 'client_wins'
    };
      
  case STRATEGIES.SERVER_WINS:
    return {
      resolved: serverRecord,
      action: 'no_change',
      conflict: true,
      resolution: 'server_wins'
    };
      
  case STRATEGIES.MANUAL:
    return {
      resolved: null,
      action: 'manual_review',
      conflict: true,
      resolution: 'manual',
      clientRecord,
      serverRecord
    };
      
  default:
    // Default to server wins
    return {
      resolved: serverRecord,
      action: 'no_change',
      conflict: true,
      resolution: 'server_wins_default'
    };
  }
};

/**
 * Detect if there's a conflict between records
 * @param {Object} clientRecord - Client record
 * @param {Object} serverRecord - Server record
 * @returns {boolean} Whether conflict exists
 */
const detectConflict = (clientRecord, serverRecord) => {
  // Compare sync versions
  if (clientRecord.sync_version !== serverRecord.sync_version) {
    return true;
  }
  
  // Compare critical fields
  const criticalFields = ['clock_in_time', 'clock_out_time', 'status'];
  
  for (const field of criticalFields) {
    const clientValue = clientRecord[field];
    const serverValue = serverRecord[field];
    
    // Handle null values
    if (clientValue !== serverValue) {
      // Special handling for timestamps
      if (field.includes('time') && clientValue && serverValue) {
        const clientTime = new Date(clientValue).getTime();
        const serverTime = new Date(serverValue).getTime();
        
        // Allow 1 second difference for timestamp rounding
        if (Math.abs(clientTime - serverTime) > 1000) {
          return true;
        }
      } else if (clientValue !== serverValue) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Merge client and server records based on strategy
 * @param {Object} clientRecord - Client record
 * @param {Object} serverRecord - Server record
 * @param {string} preference - 'client' or 'server'
 * @returns {Object} Merged record
 */
const mergeRecords = (clientRecord, serverRecord, preference) => {
  const base = preference === 'client' ? { ...clientRecord } : { ...serverRecord };
  const other = preference === 'client' ? serverRecord : clientRecord;
  
  // Always keep server's id and timestamps
  base.id = serverRecord.id;
  base.created_at = serverRecord.created_at;
  base.server_timestamp = new Date().toISOString();
  
  // Increment sync version
  base.sync_version = Math.max(
    clientRecord.sync_version || 1,
    serverRecord.sync_version || 1
  ) + 1;
  
  // Mark as synced
  base.synced = true;
  
  // Merge metadata
  base.metadata = {
    ...other.metadata,
    ...base.metadata,
    conflict_resolved: true,
    resolution_strategy: preference,
    resolved_at: new Date().toISOString()
  };
  
  return base;
};

/**
 * Batch resolve conflicts for multiple records
 * @param {Array} clientRecords - Records from client
 * @param {Array} serverRecords - Existing server records
 * @param {string} defaultStrategy - Default resolution strategy
 * @returns {Object} Batch resolution results
 */
const batchResolveConflicts = (clientRecords, serverRecords, defaultStrategy = STRATEGIES.SERVER_WINS) => {
  const results = {
    inserted: [],
    updated: [],
    conflicts: [],
    errors: []
  };
  
  // Create a map of server records by device_id and client_timestamp
  const serverMap = new Map();
  serverRecords.forEach(record => {
    const key = `${record.device_id}_${record.client_timestamp}`;
    serverMap.set(key, record);
  });
  
  // Process each client record
  clientRecords.forEach((clientRecord, index) => {
    try {
      const key = `${clientRecord.device_id}_${clientRecord.client_timestamp}`;
      const serverRecord = serverMap.get(key);
      
      const strategy = clientRecord.conflict_resolution_strategy || defaultStrategy;
      const resolution = resolveConflict(clientRecord, serverRecord, strategy);
      
      if (resolution.action === 'insert') {
        results.inserted.push(resolution.resolved);
      } else if (resolution.action === 'update') {
        results.updated.push(resolution.resolved);
      } else if (resolution.action === 'manual_review') {
        results.conflicts.push({
          index,
          clientRecord: resolution.clientRecord,
          serverRecord: resolution.serverRecord
        });
      }
    } catch (error) {
      logger.error('Error resolving conflict:', error);
      results.errors.push({
        index,
        error: error.message,
        record: clientRecord
      });
    }
  });
  
  logger.info('Batch conflict resolution completed', {
    inserted: results.inserted.length,
    updated: results.updated.length,
    conflicts: results.conflicts.length,
    errors: results.errors.length
  });
  
  return results;
};

/**
 * Validate sync metadata
 * @param {Object} record - Record to validate
 * @returns {Object} Validation result
 */
const validateSyncMetadata = (record) => {
  const errors = [];
  
  if (!record.device_id) {
    errors.push('device_id is required for sync');
  }
  
  if (!record.client_timestamp) {
    errors.push('client_timestamp is required for sync');
  }
  
  if (record.client_timestamp) {
    const clientTime = new Date(record.client_timestamp);
    const now = new Date();
    const daysDiff = (now - clientTime) / (1000 * 60 * 60 * 24);
    
    // Warn if record is more than 30 days old
    if (daysDiff > 30) {
      errors.push('client_timestamp is more than 30 days old');
    }
    
    // Error if record is from the future
    if (clientTime > now) {
      errors.push('client_timestamp is in the future');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  STRATEGIES,
  resolveConflict,
  detectConflict,
  mergeRecords,
  batchResolveConflicts,
  validateSyncMetadata
};
