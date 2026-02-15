/**
 * Telemetry Analytics
 * Aggregates and analyzes performance data
 */

import { AgentPerformance, DomainUtilization } from './types.js';
import { TelemetryCollector } from './collector.js';

export class TelemetryAnalytics {
  static getAgentPerformance(agentId: string): AgentPerformance {
    const agentMetrics = TelemetryCollector.getMetrics({ agentId });
    
    const successfulExecutions = agentMetrics.filter(m => m.success).length;
    const failedExecutions = agentMetrics.length - successfulExecutions;
    const totalTokens = agentMetrics.reduce((sum, m) => sum + m.tokensUsed, 0);
    const totalCost = agentMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalDuration = agentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = agentMetrics.length > 0 ? totalDuration / agentMetrics.length : 0;
    const successRate = agentMetrics.length > 0 ? successfulExecutions / agentMetrics.length : 0;
    
    return {
      agentId,
      totalExecutions: agentMetrics.length,
      successfulExecutions,
      failedExecutions,
      totalTokens,
      totalCost,
      averageDuration,
      successRate,
    };
  }
  
  static getDomainUtilization(domainName: string): DomainUtilization {
    const domainMetrics = TelemetryCollector.getMetrics({ domainName });
    const uniqueAgents = new Set(domainMetrics.map(m => m.agentId));
    const totalTokens = domainMetrics.reduce((sum, m) => sum + m.tokensUsed, 0);
    const totalCost = domainMetrics.reduce((sum, m) => sum + m.cost, 0);
    
    return {
      domainName,
      activeAgents: uniqueAgents.size,
      totalExecutions: domainMetrics.length,
      totalTokens,
      totalCost,
    };
  }
  
  static getOverallStats(): {
    totalExecutions: number;
    totalAgents: number;
    totalTokens: number;
    totalCost: number;
    averageSuccessRate: number;
  } {
    const allMetrics = TelemetryCollector.getMetrics();
    const uniqueAgents = new Set(allMetrics.map(m => m.agentId));
    const successful = allMetrics.filter(m => m.success).length;
    const totalTokens = allMetrics.reduce((sum, m) => sum + m.tokensUsed, 0);
    const totalCost = allMetrics.reduce((sum, m) => sum + m.cost, 0);
    const successRate = allMetrics.length > 0 ? successful / allMetrics.length : 0;
    
    return {
      totalExecutions: allMetrics.length,
      totalAgents: uniqueAgents.size,
      totalTokens,
      totalCost,
      averageSuccessRate: successRate,
    };
  }
}
