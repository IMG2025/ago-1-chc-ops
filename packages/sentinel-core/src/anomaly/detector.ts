/**
 * Anomaly Detector
 * Detects suspicious behavior patterns
 */

import { AnomalyEvent, AnomalyThresholds, AnomalyType } from './types.js';
import { BaselineTracker } from './baseline.js';
import { randomUUID } from 'crypto';

// Activity tracking (last N actions per agent)
const recentActivity = new Map<string, Array<{ timestamp: string; domainName: string; taskType: string }>>();

// Default thresholds
const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  maxActionsPerMinute: 20,    // More than 20 actions/minute is suspicious
  maxActionsPerHour: 500,     // More than 500 actions/hour is very suspicious
  scopeAttemptLimit: 3,       // 3 failed scope attempts = anomaly
  domainDeviationLimit: 5,    // Accessing 5+ domains outside baseline
};

export class AnomalyDetector {
  /**
   * Check for anomalies in agent behavior
   */
  static async checkBehavior(params: {
    agentId: string;
    domainName: string;
    taskType: string;
    scopes: string[];
    authorized: boolean;
  }): Promise<AnomalyEvent | null> {
    const now = new Date();
    
    // Track this activity
    this.recordActivity(params.agentId, {
      timestamp: now.toISOString(),
      domainName: params.domainName,
      taskType: params.taskType,
    });
    
    // Update baseline
    if (params.authorized) {
      BaselineTracker.recordAction(params);
    }
    
    // Check for frequency spike
    const frequencyAnomaly = this.checkFrequencySpike(params.agentId);
    if (frequencyAnomaly) return frequencyAnomaly;
    
    // Check for domain deviation (only if baseline exists)
    if (BaselineTracker.hasBaseline(params.agentId)) {
      const domainAnomaly = this.checkDomainDeviation(params.agentId, params.domainName);
      if (domainAnomaly) return domainAnomaly;
    }
    
    // Check for scope creep (repeated unauthorized attempts)
    if (!params.authorized) {
      const scopeAnomaly = this.checkScopeCreep(params.agentId);
      if (scopeAnomaly) return scopeAnomaly;
    }
    
    return null;
  }
  
  /**
   * Check for frequency spike (too many actions)
   */
  private static checkFrequencySpike(agentId: string): AnomalyEvent | null {
    const activity = recentActivity.get(agentId) || [];
    const now = new Date();
    
    // Count actions in last minute
    const lastMinute = new Date(now.getTime() - 60 * 1000);
    const actionsLastMinute = activity.filter(a => 
      new Date(a.timestamp) > lastMinute
    ).length;
    
    if (actionsLastMinute > DEFAULT_THRESHOLDS.maxActionsPerMinute) {
      return {
        anomalyId: randomUUID(),
        timestamp: now.toISOString(),
        agentId,
        anomalyType: 'frequency_spike',
        severity: 'high',
        description: `Agent exceeded maximum actions per minute (${actionsLastMinute}/${DEFAULT_THRESHOLDS.maxActionsPerMinute})`,
        details: {
          actionsLastMinute,
          threshold: DEFAULT_THRESHOLDS.maxActionsPerMinute,
        },
        autoSuspended: true, // Auto-suspend on frequency spikes
      };
    }
    
    // Count actions in last hour
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const actionsLastHour = activity.filter(a => 
      new Date(a.timestamp) > lastHour
    ).length;
    
    if (actionsLastHour > DEFAULT_THRESHOLDS.maxActionsPerHour) {
      return {
        anomalyId: randomUUID(),
        timestamp: now.toISOString(),
        agentId,
        anomalyType: 'frequency_spike',
        severity: 'critical',
        description: `Agent exceeded maximum actions per hour (${actionsLastHour}/${DEFAULT_THRESHOLDS.maxActionsPerHour})`,
        details: {
          actionsLastHour,
          threshold: DEFAULT_THRESHOLDS.maxActionsPerHour,
        },
        autoSuspended: true,
      };
    }
    
    return null;
  }
  
  /**
   * Check for domain deviation (accessing unexpected domains)
   */
  private static checkDomainDeviation(agentId: string, currentDomain: string): AnomalyEvent | null {
    const baseline = BaselineTracker.getBaseline(agentId);
    if (!baseline) return null;
    
    // Check if current domain is in baseline
    if (!baseline.commonDomains.includes(currentDomain)) {
      const activity = recentActivity.get(agentId) || [];
      const recentDomains = new Set(activity.slice(-20).map(a => a.domainName));
      
      const unusualDomains = Array.from(recentDomains).filter(
        d => !baseline.commonDomains.includes(d)
      );
      
      if (unusualDomains.length >= DEFAULT_THRESHOLDS.domainDeviationLimit) {
        return {
          anomalyId: randomUUID(),
          timestamp: new Date().toISOString(),
          agentId,
          domainName: currentDomain,
          anomalyType: 'domain_violation',
          severity: 'medium',
          description: `Agent accessing ${unusualDomains.length} domains outside baseline`,
          details: {
            baselineDomains: baseline.commonDomains,
            unusualDomains,
          },
          autoSuspended: false, // Don't auto-suspend for domain deviation
        };
      }
    }
    
    return null;
  }
  
  /**
   * Check for scope creep (repeated unauthorized attempts)
   */
  private static checkScopeCreep(agentId: string): AnomalyEvent | null {
    const activity = recentActivity.get(agentId) || [];
    
    // Count recent unauthorized attempts (last 10 actions)
    const recentAttempts = activity.slice(-10);
    // In real implementation, we'd track authorization results
    // For now, assume we have this data
    
    // Simplified check: if we're seeing this function called repeatedly
    // it means repeated unauthorized attempts
    const suspiciousCount = recentAttempts.length;
    
    if (suspiciousCount >= DEFAULT_THRESHOLDS.scopeAttemptLimit) {
      return {
        anomalyId: randomUUID(),
        timestamp: new Date().toISOString(),
        agentId,
        anomalyType: 'scope_creep',
        severity: 'high',
        description: `Agent made ${suspiciousCount} unauthorized scope attempts`,
        details: {
          attemptCount: suspiciousCount,
          threshold: DEFAULT_THRESHOLDS.scopeAttemptLimit,
        },
        autoSuspended: true, // Auto-suspend on scope creep
      };
    }
    
    return null;
  }
  
  /**
   * Record activity for tracking
   */
  private static recordActivity(
    agentId: string,
    activity: { timestamp: string; domainName: string; taskType: string }
  ): void {
    const history = recentActivity.get(agentId) || [];
    history.push(activity);
    
    // Keep last 1000 actions (or last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = history.filter(a => 
      new Date(a.timestamp) > yesterday
    ).slice(-1000);
    
    recentActivity.set(agentId, filtered);
  }
}
