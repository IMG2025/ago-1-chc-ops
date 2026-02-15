/**
 * Kill Switch Registry
 * Persistent storage of kill switch states
 */

import { KillSwitchState, KillSwitchLevel, KillSwitchStatus } from './types.js';

// In-memory registry (production would use persistent storage)
const killSwitchRegistry = new Map<string, KillSwitchState>();

export class KillSwitchRegistry {
  /**
   * Register a kill switch activation
   */
  static activate(
    level: KillSwitchLevel,
    targetId: string,
    reason: string,
    suspendedBy: string
  ): KillSwitchState {
    const key = `${level}:${targetId}`;
    
    const state: KillSwitchState = {
      level,
      targetId,
      status: 'suspended',
      reason,
      suspendedBy,
      suspendedAt: new Date().toISOString(),
    };
    
    killSwitchRegistry.set(key, state);
    
    console.log(`[KILL SWITCH ACTIVATED] ${level}:${targetId} | Reason: ${reason}`);
    
    return state;
  }
  
  /**
   * Deactivate a kill switch (resume)
   */
  static deactivate(
    level: KillSwitchLevel,
    targetId: string,
    resumedBy: string
  ): KillSwitchState | null {
    const key = `${level}:${targetId}`;
    const state = killSwitchRegistry.get(key);
    
    if (!state) {
      return null;
    }
    
    state.status = 'active';
    state.resumedAt = new Date().toISOString();
    state.resumedBy = resumedBy;
    
    killSwitchRegistry.set(key, state);
    
    console.log(`[KILL SWITCH DEACTIVATED] ${level}:${targetId} | By: ${resumedBy}`);
    
    return state;
  }
  
  /**
   * Check if a kill switch is active for a target
   */
  static isActive(level: KillSwitchLevel, targetId: string): boolean {
    const key = `${level}:${targetId}`;
    const state = killSwitchRegistry.get(key);
    
    return state?.status === 'suspended';
  }
  
  /**
   * Get kill switch state
   */
  static getState(level: KillSwitchLevel, targetId: string): KillSwitchState | null {
    const key = `${level}:${targetId}`;
    return killSwitchRegistry.get(key) || null;
  }
  
  /**
   * Get all active kill switches
   */
  static getAllActive(): KillSwitchState[] {
    return Array.from(killSwitchRegistry.values())
      .filter(state => state.status === 'suspended');
  }
  
  /**
   * Get all kill switches for a domain
   */
  static getByDomain(domainName: string): KillSwitchState[] {
    return Array.from(killSwitchRegistry.values())
      .filter(state => 
        (state.level === 'domain' && state.targetId === domainName) ||
        state.level === 'global'
      );
  }
  
  /**
   * Clear all kill switches (use with caution)
   */
  static clearAll(): void {
    killSwitchRegistry.clear();
    console.log('[KILL SWITCH] All kill switches cleared');
  }
}
