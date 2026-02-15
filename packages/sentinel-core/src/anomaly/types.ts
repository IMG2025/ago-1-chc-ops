/**
 * Anomaly Detection Types
 */

export type AnomalyType = 
  | 'frequency_spike'      // Too many actions in short time
  | 'pattern_deviation'    // Unusual action sequence
  | 'scope_creep'          // Attempting unauthorized scopes
  | 'domain_violation'     // Accessing unexpected domains
  | 'time_anomaly';        // Activity at unusual times

export interface AnomalyEvent {
  anomalyId: string;
  timestamp: string;
  agentId: string;
  domainName?: string;
  anomalyType: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: Record<string, unknown>;
  autoSuspended: boolean;
}

export interface AgentBehaviorBaseline {
  agentId: string;
  totalActions: number;
  averageActionsPerHour: number;
  commonDomains: string[];
  commonTaskTypes: string[];
  typicalScopes: string[];
  createdAt: string;
  lastUpdated: string;
}

export interface AnomalyThresholds {
  maxActionsPerMinute: number;
  maxActionsPerHour: number;
  scopeAttemptLimit: number;
  domainDeviationLimit: number;
}
