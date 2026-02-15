/**
 * Authorization with Kill Switch Integration
 * Enhanced authorization that checks kill switches
 */

import { KillSwitchEnforcer } from './killswitch/enforcer.js';

export interface AuthorizationRequest {
  agentId: string;
  domainName: string;
  taskType: string;
  scopes: string[];
}

export interface AuthorizationResponse {
  allowed: boolean;
  reason?: string;
  killSwitchActive?: boolean;
}

export function authorizeWithKillSwitch(request: AuthorizationRequest): AuthorizationResponse {
  // First check kill switches
  const killSwitchCheck = KillSwitchEnforcer.checkAgent(request.agentId, request.domainName);
  
  if (!killSwitchCheck.success) {
    return {
      allowed: false,
      reason: killSwitchCheck.message,
      killSwitchActive: true,
    };
  }
  
  // If no kill switches, proceed with normal authorization
  // (This would call your existing authorization logic)
  
  return {
    allowed: true,
  };
}
