/**
 * Kill Switch Enforcer
 * Enforces kill switch policies during authorization
 */

import { KillSwitchRegistry } from './registry.js';
import { KillSwitchResult } from './types.js';

export class KillSwitchEnforcer {
  /**
   * Check if agent is allowed to execute
   * Checks: global kill switch, domain kill switch, agent kill switch
   */
  static checkAgent(agentId: string, domainName: string): KillSwitchResult {
    // Check global kill switch first
    if (KillSwitchRegistry.isActive('global', 'global')) {
      const state = KillSwitchRegistry.getState('global', 'global');
      return {
        success: false,
        message: `Global kill switch active: ${state?.reason}`,
        state: state || undefined,
      };
    }
    
    // Check domain kill switch
    if (KillSwitchRegistry.isActive('domain', domainName)) {
      const state = KillSwitchRegistry.getState('domain', domainName);
      return {
        success: false,
        message: `Domain '${domainName}' suspended: ${state?.reason}`,
        state: state || undefined,
      };
    }
    
    // Check agent kill switch
    if (KillSwitchRegistry.isActive('agent', agentId)) {
      const state = KillSwitchRegistry.getState('agent', agentId);
      return {
        success: false,
        message: `Agent '${agentId}' suspended: ${state?.reason}`,
        state: state || undefined,
      };
    }
    
    return {
      success: true,
      message: 'No kill switches active',
    };
  }
  
  /**
   * Suspend a specific agent
   */
  static suspendAgent(agentId: string, reason: string, suspendedBy: string): KillSwitchResult {
    const state = KillSwitchRegistry.activate('agent', agentId, reason, suspendedBy);
    
    return {
      success: true,
      message: `Agent '${agentId}' suspended`,
      state,
    };
  }
  
  /**
   * Resume a specific agent
   */
  static resumeAgent(agentId: string, resumedBy: string): KillSwitchResult {
    const state = KillSwitchRegistry.deactivate('agent', agentId, resumedBy);
    
    if (!state) {
      return {
        success: false,
        message: `No kill switch found for agent '${agentId}'`,
      };
    }
    
    return {
      success: true,
      message: `Agent '${agentId}' resumed`,
      state,
    };
  }
  
  /**
   * Suspend all agents in a domain
   */
  static suspendDomain(domainName: string, reason: string, suspendedBy: string): KillSwitchResult {
    const state = KillSwitchRegistry.activate('domain', domainName, reason, suspendedBy);
    
    return {
      success: true,
      message: `Domain '${domainName}' suspended`,
      state,
    };
  }
  
  /**
   * Resume all agents in a domain
   */
  static resumeDomain(domainName: string, resumedBy: string): KillSwitchResult {
    const state = KillSwitchRegistry.deactivate('domain', domainName, resumedBy);
    
    if (!state) {
      return {
        success: false,
        message: `No kill switch found for domain '${domainName}'`,
      };
    }
    
    return {
      success: true,
      message: `Domain '${domainName}' resumed`,
      state,
    };
  }
  
  /**
   * Activate global emergency halt (suspend all Tier 2+ actions)
   */
  static activateGlobalHalt(reason: string, suspendedBy: string): KillSwitchResult {
    const state = KillSwitchRegistry.activate('global', 'global', reason, suspendedBy);
    
    return {
      success: true,
      message: 'Global kill switch activated - all operations suspended',
      state,
    };
  }
  
  /**
   * Deactivate global emergency halt
   */
  static deactivateGlobalHalt(resumedBy: string): KillSwitchResult {
    const state = KillSwitchRegistry.deactivate('global', 'global', resumedBy);
    
    if (!state) {
      return {
        success: false,
        message: 'No global kill switch active',
      };
    }
    
    return {
      success: true,
      message: 'Global kill switch deactivated - operations resumed',
      state,
    };
  }
  
  /**
   * Get status of all kill switches
   */
  static getStatus(): {
    globalActive: boolean;
    suspendedDomains: string[];
    suspendedAgents: string[];
    totalActive: number;
  } {
    const active = KillSwitchRegistry.getAllActive();
    
    return {
      globalActive: active.some(s => s.level === 'global'),
      suspendedDomains: active.filter(s => s.level === 'domain').map(s => s.targetId),
      suspendedAgents: active.filter(s => s.level === 'agent').map(s => s.targetId),
      totalActive: active.length,
    };
  }
}
