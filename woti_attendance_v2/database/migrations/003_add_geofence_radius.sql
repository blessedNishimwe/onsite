-- ============================================================================
-- Migration: Add geofence_radius to facilities
-- Version: 003
-- Description: Enable PostGIS and add geofence radius column for attendance validation
-- ============================================================================

-- Enable PostGIS extension (user should ensure PostGIS is installed)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geofence_radius column to facilities (default 100 meters)
ALTER TABLE facilities 
ADD COLUMN IF NOT EXISTS geofence_radius INTEGER DEFAULT 100;

-- Add comment
COMMENT ON COLUMN facilities.geofence_radius IS 'Geofence radius in meters for attendance validation (default 100m)';

-- Create spatial index for faster geofencing queries
-- Note: This uses ST_MakePoint which requires PostGIS
CREATE INDEX IF NOT EXISTS idx_facilities_geom 
ON facilities USING GIST (ST_MakePoint(longitude, latitude))
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
