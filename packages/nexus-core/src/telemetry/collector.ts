/**
 * Telemetry Collector
 * Tracks execution metrics for all agents
 */

import { ExecutionMetrics } from './types.js';
import { randomUUID } from 'crypto';

const metrics: ExecutionMetrics[] = [];

export class TelemetryCollector {
  static record(params: {
    agentId: string;
    domainName: string;
    taskType: string;
    startTime: string;
    endTime: string;
    success: boolean;
    tokensUsed: number;
  }): ExecutionMetrics {
    const start = new Date(params.startTime);
    const end = new Date(params.endTime);
    const duration = end.getTime() - start.getTime();
    
    // Cost calculation (simplified - $0.003 per 1K tokens for Claude Sonnet)
    const cost = (params.tokensUsed / 1000) * 0.003;
    
    const metric: ExecutionMetrics = {
      agentId: params.agentId,
      taskId: randomUUID(),
      domainName: params.domainName,
      taskType: params.taskType,
      startTime: params.startTime,
      endTime: params.endTime,
      duration,
      success: params.success,
      tokensUsed: params.tokensUsed,
      cost,
    };
    
    metrics.push(metric);
    
    console.log(
      `[TELEMETRY] ${params.agentId} | ${params.taskType} | ` +
      `${duration}ms | ${params.tokensUsed} tokens | $${cost.toFixed(4)}`
    );
    
    return metric;
  }
  
  static getMetrics(filter?: {
    agentId?: string;
    domainName?: string;
    startTime?: string;
    endTime?: string;
  }): ExecutionMetrics[] {
    let results = [...metrics];
    
    if (filter?.agentId) {
      results = results.filter(m => m.agentId === filter.agentId);
    }
    
    if (filter?.domainName) {
      results = results.filter(m => m.domainName === filter.domainName);
    }
    
    if (filter?.startTime) {
      results = results.filter(m => m.startTime >= filter.startTime!);
    }
    
    if (filter?.endTime) {
      results = results.filter(m => m.endTime <= filter.endTime!);
    }
    
    return results;
  }
  
  static cleanup(olderThan: string): number {
    const initialLength = metrics.length;
    const filtered = metrics.filter(m => m.endTime >= olderThan);
    metrics.length = 0;
    metrics.push(...filtered);
    
    const removed = initialLength - metrics.length;
    if (removed > 0) {
      console.log(`[TELEMETRY] Cleaned up ${removed} old metrics`);
    }
    
    return removed;
  }
}
