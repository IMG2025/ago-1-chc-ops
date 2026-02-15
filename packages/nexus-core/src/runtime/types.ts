/**
 * Agent Runtime Types
 */

export type AgentStatus = 'initializing' | 'active' | 'idle' | 'suspended' | 'terminated';

export type MemoryScope = 'short-term' | 'long-term' | 'domain-scoped';

export interface AgentContext {
  agentId: string;
  domainName: string;
  status: AgentStatus;
  createdAt: string;
  lastActiveAt: string;
  executionCount: number;
}

export interface MemorySegment {
  segmentId: string;
  agentId: string;
  scope: MemoryScope;
  data: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string;
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'custom';
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ExecutionContext {
  agentId: string;
  domainName: string;
  taskType: string;
  memory: MemorySegment[];
  model: ModelConfig;
}
