/**
 * Sentinel Audit Types
 * Comprehensive audit trail for governance events
 */

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  eventType: 'authorization' | 'execution' | 'killswitch' | 'policy_change';
  actor: {
    agentId?: string;
    humanId?: string;
    role?: string;
  };
  target: {
    domainName?: string;
    taskType?: string;
    resourceId?: string;
  };
  decision: 'allowed' | 'denied' | 'suspended';
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizationAuditEvent extends AuditEvent {
  eventType: 'authorization';
  authorization: {
    requested: {
      domainName: string;
      taskType: string;
      scopes: string[];
    };
    decision: 'allowed' | 'denied';
    reason?: string;
    killSwitchActive?: boolean;
    policiesEvaluated: string[];
  };
}

export interface ExecutionAuditEvent extends AuditEvent {
  eventType: 'execution';
  execution: {
    domainName: string;
    taskType: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    success: boolean;
    error?: string;
  };
}

export interface KillSwitchAuditEvent extends AuditEvent {
  eventType: 'killswitch';
  killSwitch: {
    level: 'agent' | 'domain' | 'global';
    targetId: string;
    action: 'activate' | 'deactivate';
    reason: string;
  };
}

export interface PolicyChangeAuditEvent extends AuditEvent {
  eventType: 'policy_change';
  policyChange: {
    policyId: string;
    action: 'created' | 'updated' | 'deleted';
    oldVersion?: string;
    newVersion?: string;
  };
}

export type SentinelAuditEvent = 
  | AuthorizationAuditEvent 
  | ExecutionAuditEvent 
  | KillSwitchAuditEvent 
  | PolicyChangeAuditEvent;

export interface AuditQuery {
  eventType?: string;
  agentId?: string;
  domainName?: string;
  startTime?: string;
  endTime?: string;
  decision?: 'allowed' | 'denied' | 'suspended';
  limit?: number;
}
