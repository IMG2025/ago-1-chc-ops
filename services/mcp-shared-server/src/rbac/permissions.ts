/**
 * Tool Permission Definitions
 * RBAC rules for all MCP tools
 */

import { ToolPermissions } from './types.js';

export const TOOL_PERMISSIONS: Record<string, ToolPermissions> = {
  // Shared tools - accessible by all tenants
  'shared.artifact_registry.read': {
    requiredScopes: ['artifacts:read'],
    allowedTenants: ['shared', 'chc', 'ciag', 'hospitality'],
    description: 'Read shared artifacts',
  },
  
  'shared.artifact_registry.readById': {
    requiredScopes: ['artifacts:read'],
    allowedTenants: ['shared', 'chc', 'ciag', 'hospitality'],
    description: 'Read specific shared artifact',
  },
  
  'shared.artifact_registry.search': {
    requiredScopes: ['artifacts:read'],
    allowedTenants: ['shared', 'chc', 'ciag', 'hospitality'],
    description: 'Search shared artifacts',
  },
  
  'shared.artifact_registry.write': {
    requiredScopes: ['artifacts:write'],
    allowedTenants: ['shared', 'chc', 'ciag', 'hospitality'],
    description: 'Write to shared artifacts',
  },
  
  // CHC tools - CHC tenant only
  'chc.artifact_registry.read': {
    requiredScopes: ['artifacts:read', 'chc:access'],
    allowedTenants: ['chc'],
    description: 'Read CHC artifacts',
  },
  
  'chc.artifact_registry.readById': {
    requiredScopes: ['artifacts:read', 'chc:access'],
    allowedTenants: ['chc'],
    description: 'Read specific CHC artifact',
  },
  
  'chc.artifact_registry.write': {
    requiredScopes: ['artifacts:write', 'chc:access'],
    allowedTenants: ['chc'],
    description: 'Write to CHC artifacts',
  },
  
  // CIAG tools - CIAG tenant only
  'ciag.artifact_registry.read': {
    requiredScopes: ['artifacts:read', 'ciag:access'],
    allowedTenants: ['ciag'],
    description: 'Read CIAG artifacts',
  },
  
  'ciag.artifact_registry.readById': {
    requiredScopes: ['artifacts:read', 'ciag:access'],
    allowedTenants: ['ciag'],
    description: 'Read specific CIAG artifact',
  },
  
  'ciag.artifact_registry.write': {
    requiredScopes: ['artifacts:write', 'ciag:access'],
    allowedTenants: ['ciag'],
    description: 'Write to CIAG artifacts',
  },
  
  // Hospitality tools - Hospitality tenant only
  'hospitality.artifact_registry.read': {
    requiredScopes: ['artifacts:read', 'hospitality:access'],
    allowedTenants: ['hospitality'],
    description: 'Read Hospitality artifacts',
  },
  
  'hospitality.artifact_registry.readById': {
    requiredScopes: ['artifacts:read', 'hospitality:access'],
    allowedTenants: ['hospitality'],
    description: 'Read specific Hospitality artifact',
  },
  
  'hospitality.artifact_registry.write': {
    requiredScopes: ['artifacts:write', 'hospitality:access'],
    allowedTenants: ['hospitality'],
    description: 'Write to Hospitality artifacts',
  },
};

// Scope hierarchy - higher scopes imply lower scopes
export const SCOPE_HIERARCHY: Record<string, string[]> = {
  'artifacts:write': ['artifacts:read'],
  'admin:all': ['artifacts:write', 'artifacts:read'],
};
