/**
 * Kill Switch Types
 * Emergency control mechanisms for Sentinel
 */

export type KillSwitchLevel = 'agent' | 'domain' | 'global';

export type KillSwitchStatus = 'active' | 'suspended';

export interface KillSwitchState {
  level: KillSwitchLevel;
  targetId: string; // agentId, domainName, or 'global'
  status: KillSwitchStatus;
  reason: string;
  suspendedBy: string;
  suspendedAt: string;
  resumedAt?: string;
  resumedBy?: string;
}

export interface KillSwitchResult {
  success: boolean;
  message: string;
  state?: KillSwitchState;
}
