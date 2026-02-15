/**
 * Sentinel Audit Logger
 * Immutable, append-only audit trail
 */

import { SentinelAuditEvent, AuditQuery } from './types.js';
import { randomUUID } from 'crypto';

// Immutable audit log (append-only)
const auditLog: SentinelAuditEvent[] = [];

export class SentinelAuditLogger {
  /**
   * Log an audit event (immutable - never modified after creation)
   */
  static async log(event: Omit<SentinelAuditEvent, 'eventId' | 'timestamp'>): Promise<SentinelAuditEvent> {
    const fullEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    } as SentinelAuditEvent;
    
    // Append-only: freeze the event to ensure immutability
    Object.freeze(fullEvent);
    
    auditLog.push(fullEvent);
    
    // Console log for development
    console.log(
      `[SENTINEL AUDIT] ${fullEvent.eventType} | ` +
      `${fullEvent.actor.agentId || fullEvent.actor.humanId || 'system'} | ` +
      `${fullEvent.decision}`
    );
    
    // In production, also write to:
    // - Persistent database
    // - Immutable log storage (S3, etc.)
    // - SIEM system
    
    return fullEvent;
  }
  
  /**
   * Log authorization decision
   */
  static async logAuthorization(params: {
    agentId: string;
    domainName: string;
    taskType: string;
    scopes: string[];
    decision: 'allowed' | 'denied';
    reason?: string;
    killSwitchActive?: boolean;
    policiesEvaluated?: string[];
  }): Promise<SentinelAuditEvent> {
    return this.log({
      eventType: 'authorization',
      actor: { agentId: params.agentId },
      target: { 
        domainName: params.domainName,
        taskType: params.taskType,
      },
      decision: params.decision,
      reason: params.reason,
      authorization: {
        requested: {
          domainName: params.domainName,
          taskType: params.taskType,
          scopes: params.scopes,
        },
        decision: params.decision,
        reason: params.reason,
        killSwitchActive: params.killSwitchActive,
        policiesEvaluated: params.policiesEvaluated || [],
      },
    });
  }
  
  /**
   * Log task execution
   */
  static async logExecution(params: {
    agentId: string;
    domainName: string;
    taskType: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    success: boolean;
    error?: string;
  }): Promise<SentinelAuditEvent> {
    return this.log({
      eventType: 'execution',
      actor: { agentId: params.agentId },
      target: { 
        domainName: params.domainName,
        taskType: params.taskType,
      },
      decision: params.success ? 'allowed' : 'denied',
      execution: {
        domainName: params.domainName,
        taskType: params.taskType,
        startTime: params.startTime,
        endTime: params.endTime,
        duration: params.duration,
        success: params.success,
        error: params.error,
      },
    });
  }
  
  /**
   * Log kill switch action
   */
  static async logKillSwitch(params: {
    humanId: string;
    level: 'agent' | 'domain' | 'global';
    targetId: string;
    action: 'activate' | 'deactivate';
    reason: string;
  }): Promise<SentinelAuditEvent> {
    return this.log({
      eventType: 'killswitch',
      actor: { humanId: params.humanId },
      target: { resourceId: params.targetId },
      decision: params.action === 'activate' ? 'suspended' : 'allowed',
      killSwitch: {
        level: params.level,
        targetId: params.targetId,
        action: params.action,
        reason: params.reason,
      },
    });
  }
  
  /**
   * Query audit log
   */
  static async query(filter: AuditQuery): Promise<SentinelAuditEvent[]> {
    let results = [...auditLog];
    
    if (filter.eventType) {
      results = results.filter(e => e.eventType === filter.eventType);
    }
    
    if (filter.agentId) {
      results = results.filter(e => e.actor.agentId === filter.agentId);
    }
    
    if (filter.domainName) {
      results = results.filter(e => e.target?.domainName === filter.domainName);
    }
    
    if (filter.startTime) {
      results = results.filter(e => e.timestamp >= filter.startTime!);
    }
    
    if (filter.endTime) {
      results = results.filter(e => e.timestamp <= filter.endTime!);
    }
    
    if (filter.decision) {
      results = results.filter(e => e.decision === filter.decision);
    }
    
    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }
    
    return results;
  }
  
  /**
   * Get audit statistics
   */
  static async getStats(filter?: { agentId?: string; domainName?: string }): Promise<{
    totalEvents: number;
    authorizationEvents: number;
    allowedCount: number;
    deniedCount: number;
    killSwitchEvents: number;
  }> {
    let events = auditLog;
    
    if (filter?.agentId) {
      events = events.filter(e => e.actor.agentId === filter.agentId);
    }
    
    if (filter?.domainName) {
      events = events.filter(e => e.target?.domainName === filter.domainName);
    }
    
    return {
      totalEvents: events.length,
      authorizationEvents: events.filter(e => e.eventType === 'authorization').length,
      allowedCount: events.filter(e => e.decision === 'allowed').length,
      deniedCount: events.filter(e => e.decision === 'denied').length,
      killSwitchEvents: events.filter(e => e.eventType === 'killswitch').length,
    };
  }
  
  /**
   * Export audit trail for compliance
   */
  static async export(startTime?: string, endTime?: string): Promise<string> {
    const events = await this.query({ startTime, endTime });
    return JSON.stringify(events, null, 2);
  }
  
  /**
   * Get complete audit trail for an agent
   */
  static async getAgentHistory(agentId: string): Promise<SentinelAuditEvent[]> {
    return this.query({ agentId });
  }
  
  /**
   * Get complete audit trail for a domain
   */
  static async getDomainHistory(domainName: string): Promise<SentinelAuditEvent[]> {
    return this.query({ domainName });
  }
}
