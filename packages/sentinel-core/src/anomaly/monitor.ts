/**
 * Anomaly Monitor
 * Manages anomaly detection and response
 */

import { AnomalyEvent } from './types.js';
import { AnomalyDetector } from './detector.js';
import { SentinelAuditLogger } from '../audit/logger.js';

// Anomaly log
const anomalyLog: AnomalyEvent[] = [];

export class AnomalyMonitor {
  /**
   * Monitor agent action for anomalies
   */
  static async monitor(params: {
    agentId: string;
    domainName: string;
    taskType: string;
    scopes: string[];
    authorized: boolean;
  }): Promise<AnomalyEvent | null> {
    const anomaly = await AnomalyDetector.checkBehavior(params);
    
    if (anomaly) {
      // Log anomaly
      anomalyLog.push(anomaly);
      
      console.log(
        `[ANOMALY DETECTED] ${anomaly.anomalyType} | ` +
        `Agent: ${anomaly.agentId} | ` +
        `Severity: ${anomaly.severity} | ` +
        `Auto-suspended: ${anomaly.autoSuspended}`
      );
      
      // Log to audit trail
      await SentinelAuditLogger.log({
        eventType: 'authorization',
        actor: { agentId: params.agentId },
        target: { domainName: params.domainName, taskType: params.taskType },
        decision: anomaly.autoSuspended ? 'suspended' : 'denied',
        reason: `Anomaly detected: ${anomaly.description}`,
        metadata: { anomaly },
      });
      
      // Auto-suspend if required
      if (anomaly.autoSuspended) {
        // In production: call KillSwitchEnforcer.suspendAgent()
        console.log(`[AUTO-SUSPEND] Agent ${anomaly.agentId} suspended due to anomaly`);
      }
    }
    
    return anomaly;
  }
  
  /**
   * Get all anomalies
   */
  static getAnomalies(filter?: {
    agentId?: string;
    severity?: string;
    limit?: number;
  }): AnomalyEvent[] {
    let results = [...anomalyLog];
    
    if (filter?.agentId) {
      results = results.filter(a => a.agentId === filter.agentId);
    }
    
    if (filter?.severity) {
      results = results.filter(a => a.severity === filter.severity);
    }
    
    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }
    
    return results;
  }
  
  /**
   * Get anomaly statistics
   */
  static getStats(): {
    totalAnomalies: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    autoSuspendedCount: number;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let autoSuspendedCount = 0;
    
    for (const anomaly of anomalyLog) {
      byType[anomaly.anomalyType] = (byType[anomaly.anomalyType] || 0) + 1;
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
      if (anomaly.autoSuspended) autoSuspendedCount++;
    }
    
    return {
      totalAnomalies: anomalyLog.length,
      byType,
      bySeverity,
      autoSuspendedCount,
    };
  }
}
