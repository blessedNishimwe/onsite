// src/modules/locations/index.js
/**
 * Locations Module
 * Exports all location-related components
 */

const locationsRoutes = require('./locations.routes');
const locationsController = require('./locations.controller');
const locationsService = require('./locations.service');
const locationsRepository = require('./locations.repository');

module.exports = {
  routes: locationsRoutes,
  controller: locationsController,
  service: locationsService,
  repository: locationsRepository
};
