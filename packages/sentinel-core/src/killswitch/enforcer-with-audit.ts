/**
 * Kill Switch Enforcer with Audit Integration
 */

import { KillSwitchRegistry } from './registry.js';
import { KillSwitchResult } from './types.js';
import { SentinelAuditLogger } from '../audit/logger.js';

export class KillSwitchEnforcerWithAudit {
  /**
   * Suspend agent with audit logging
   */
  static async suspendAgent(
    agentId: string,
    reason: string,
    suspendedBy: string
  ): Promise<KillSwitchResult> {
    const state = KillSwitchRegistry.activate('agent', agentId, reason, suspendedBy);
    
    // Log to audit trail
    await SentinelAuditLogger.logKillSwitch({
      humanId: suspendedBy,
      level: 'agent',
      targetId: agentId,
      action: 'activate',
      reason,
    });
    
    return {
      success: true,
      message: `Agent '${agentId}' suspended`,
      state,
    };
  }
  
  /**
   * Resume agent with audit logging
   */
  static async resumeAgent(
    agentId: string,
    resumedBy: string
  ): Promise<KillSwitchResult> {
    const state = KillSwitchRegistry.deactivate('agent', agentId, resumedBy);
    
    if (!state) {
      return {
        success: false,
        message: `No kill switch found for agent '${agentId}'`,
      };
    }
    
    // Log to audit trail
    await SentinelAuditLogger.logKillSwitch({
      humanId: resumedBy,
      level: 'agent',
      targetId: agentId,
      action: 'deactivate',
      reason: 'Manual resume',
    });
    
    return {
      success: true,
      message: `Agent '${agentId}' resumed`,
      state,
    };
  }
  
  /**
   * Activate global halt with audit logging
   */
  static async activateGlobalHalt(
    reason: string,
    suspendedBy: string
  ): Promise<KillSwitchResult> {
    const state = KillSwitchRegistry.activate('global', 'global', reason, suspendedBy);
    
    // Log to audit trail
    await SentinelAuditLogger.logKillSwitch({
      humanId: suspendedBy,
      level: 'global',
      targetId: 'global',
      action: 'activate',
      reason,
    });
    
    return {
      success: true,
      message: 'Global kill switch activated',
      state,
    };
  }
}
