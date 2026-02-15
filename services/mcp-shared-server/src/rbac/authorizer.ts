/**
 * RBAC Authorizer
 * Checks caller permissions against tool requirements
 */

import { Caller, AuthorizationResult } from './types.js';
import { TOOL_PERMISSIONS, SCOPE_HIERARCHY } from './permissions.js';
import { createError } from '../errors/index.js';

export function authorize(caller: Caller, toolName: string): AuthorizationResult {
  const permissions = TOOL_PERMISSIONS[toolName];
  
  if (!permissions) {
    return {
      authorized: false,
      reason: `No permissions defined for tool: ${toolName}`,
    };
  }
  
  // Check tenant allowed
  if (!permissions.allowedTenants.includes(caller.tenant)) {
    return {
      authorized: false,
      reason: `Tenant '${caller.tenant}' not allowed for tool '${toolName}'`,
    };
  }
  
  // Expand caller scopes with hierarchy
  const expandedScopes = expandScopes(caller.scopes);
  
  // Check required scopes
  const missingScopes: string[] = [];
  for (const requiredScope of permissions.requiredScopes) {
    if (!expandedScopes.has(requiredScope)) {
      missingScopes.push(requiredScope);
    }
  }
  
  if (missingScopes.length > 0) {
    return {
      authorized: false,
      reason: `Missing required scopes`,
      missingScopes,
    };
  }
  
  return {
    authorized: true,
  };
}

function expandScopes(scopes: string[]): Set<string> {
  const expanded = new Set<string>(scopes);
  
  for (const scope of scopes) {
    const impliedScopes = SCOPE_HIERARCHY[scope];
    if (impliedScopes) {
      for (const implied of impliedScopes) {
        expanded.add(implied);
      }
    }
  }
  
  return expanded;
}

export function getAuthorizationError(toolName: string, authResult: AuthorizationResult) {
  if (authResult.missingScopes && authResult.missingScopes.length > 0) {
    return createError('INSUFFICIENT_SCOPE', {
      tool: toolName,
      missingScopes: authResult.missingScopes,
    });
  }
  
  if (authResult.reason?.includes('not allowed')) {
    return createError('TENANT_NOT_ALLOWED', {
      tool: toolName,
      reason: authResult.reason,
    });
  }
  
  return createError('INSUFFICIENT_SCOPE', {
    tool: toolName,
    reason: authResult.reason,
  });
}
