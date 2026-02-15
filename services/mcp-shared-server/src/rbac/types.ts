/**
 * RBAC Types
 * Role-Based Access Control for tools
 */

export interface ToolPermissions {
  requiredScopes: string[];
  allowedTenants: string[];
  description?: string;
}

export interface Caller {
  tenant: string;
  scopes: string[];
  actor?: string;
  traceId?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  missingScopes?: string[];
}
