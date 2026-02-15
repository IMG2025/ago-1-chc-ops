/**
 * Behavioral Baseline Tracker
 * Learns normal behavior patterns for agents
 */

import { AgentBehaviorBaseline } from './types.js';

// Baseline storage (production would use persistent storage)
const baselines = new Map<string, AgentBehaviorBaseline>();

export class BaselineTracker {
  /**
   * Record an agent action to build baseline
   */
  static recordAction(params: {
    agentId: string;
    domainName: string;
    taskType: string;
    scopes: string[];
  }): void {
    let baseline = baselines.get(params.agentId);
    
    if (!baseline) {
      // Create new baseline
      baseline = {
        agentId: params.agentId,
        totalActions: 0,
        averageActionsPerHour: 0,
        commonDomains: [],
        commonTaskTypes: [],
        typicalScopes: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
    }
    
    // Update action count
    baseline.totalActions += 1;
    
    // Update common domains (keep top 5)
    if (!baseline.commonDomains.includes(params.domainName)) {
      baseline.commonDomains.push(params.domainName);
      if (baseline.commonDomains.length > 5) {
        baseline.commonDomains = baseline.commonDomains.slice(0, 5);
      }
    }
    
    // Update common task types (keep top 10)
    if (!baseline.commonTaskTypes.includes(params.taskType)) {
      baseline.commonTaskTypes.push(params.taskType);
      if (baseline.commonTaskTypes.length > 10) {
        baseline.commonTaskTypes = baseline.commonTaskTypes.slice(0, 10);
      }
    }
    
    // Update typical scopes
    for (const scope of params.scopes) {
      if (!baseline.typicalScopes.includes(scope)) {
        baseline.typicalScopes.push(scope);
      }
    }
    
    baseline.lastUpdated = new Date().toISOString();
    
    baselines.set(params.agentId, baseline);
  }
  
  /**
   * Get baseline for an agent
   */
  static getBaseline(agentId: string): AgentBehaviorBaseline | null {
    return baselines.get(agentId) || null;
  }
  
  /**
   * Check if agent has established baseline (minimum 10 actions)
   */
  static hasBaseline(agentId: string): boolean {
    const baseline = baselines.get(agentId);
    return baseline ? baseline.totalActions >= 10 : false;
  }
}
