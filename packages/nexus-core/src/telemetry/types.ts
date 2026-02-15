/**
 * Telemetry Types
 */

export interface ExecutionMetrics {
  agentId: string;
  taskId: string;
  domainName: string;
  taskType: string;
  startTime: string;
  endTime: string;
  duration: number;
  success: boolean;
  tokensUsed: number;
  cost: number;
}

export interface AgentPerformance {
  agentId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalTokens: number;
  totalCost: number;
  averageDuration: number;
  successRate: number;
}

export interface DomainUtilization {
  domainName: string;
  activeAgents: number;
  totalExecutions: number;
  totalTokens: number;
  totalCost: number;
}
