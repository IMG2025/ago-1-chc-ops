/**
 * Agent Lifecycle Types
 */

export type AgentClass = 'Observer' | 'Advisor' | 'Executor' | 'Coordinator' | 'Auditor';

export type LifecycleState = 'created' | 'authorized' | 'operating' | 'suspended' | 'retired';

export interface AgentIdentity {
  agentId: string;
  agentClass: AgentClass;
  domainName: string;
  createdAt: string;
  createdBy: string;
  state: LifecycleState;
  capabilities: string[];
  retiredAt?: string;
  retiredBy?: string;
  retiredReason?: string;
}

export interface AgentArchive {
  identity: AgentIdentity;
  auditTrail: string[]; // References to audit events
  archivedAt: string;
}
