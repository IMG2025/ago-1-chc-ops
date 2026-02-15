/**
 * Audit Logger
 * Logs all tool executions for compliance and debugging
 */

import { ToolExecutionEvent } from './types.js';
import { randomUUID } from 'crypto';

// In-memory audit log (production would use persistent storage)
const auditLog: ToolExecutionEvent[] = [];

export class AuditLogger {
  static async logToolExecution(event: Omit<ToolExecutionEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const fullEvent: ToolExecutionEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };
    
    // Append to log (immutable - never modify existing events)
    auditLog.push(fullEvent);
    
    // Optional: Write to persistent storage here
    // await writeToDatabase(fullEvent);
    // await writeToFile(fullEvent);
    
    // Console log for development
    console.log(`[AUDIT] ${fullEvent.toolName} | ${fullEvent.caller.tenant} | ${fullEvent.result.success ? 'SUCCESS' : 'FAIL'} | ${fullEvent.duration}ms`);
  }
  
  static async queryAuditLog(filter?: {
    tenant?: string;
    toolName?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<ToolExecutionEvent[]> {
    let filtered = [...auditLog];
    
    if (filter?.tenant) {
      filtered = filtered.filter(e => e.caller.tenant === filter.tenant);
    }
    
    if (filter?.toolName) {
      filtered = filtered.filter(e => e.toolName === filter.toolName);
    }
    
    if (filter?.startTime) {
      filtered = filtered.filter(e => e.timestamp >= filter.startTime!);
    }
    
    if (filter?.endTime) {
      filtered = filtered.filter(e => e.timestamp <= filter.endTime!);
    }
    
    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    if (filter?.limit) {
      filtered = filtered.slice(0, filter.limit);
    }
    
    return filtered;
  }
  
  static async getAuditStats(tenant?: string): Promise<{
    totalEvents: number;
    successCount: number;
    failureCount: number;
    averageDuration: number;
  }> {
    let events = auditLog;
    
    if (tenant) {
      events = events.filter(e => e.caller.tenant === tenant);
    }
    
    const successCount = events.filter(e => e.result.success).length;
    const failureCount = events.length - successCount;
    const averageDuration = events.length > 0
      ? events.reduce((sum, e) => sum + e.duration, 0) / events.length
      : 0;
    
    return {
      totalEvents: events.length,
      successCount,
      failureCount,
      averageDuration,
    };
  }
  
  static async exportAuditLog(startTime?: string, endTime?: string): Promise<string> {
    const events = await this.queryAuditLog({ startTime, endTime });
    return JSON.stringify(events, null, 2);
  }
}
