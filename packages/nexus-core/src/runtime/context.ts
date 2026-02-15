/**
 * Agent Execution Context Manager
 * Isolated execution environments per agent
 */

import { AgentContext, AgentStatus } from './types.js';

const contexts = new Map<string, AgentContext>();

export class ContextManager {
  static create(agentId: string, domainName: string): AgentContext {
    const context: AgentContext = {
      agentId,
      domainName,
      status: 'initializing',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      executionCount: 0,
    };
    
    contexts.set(agentId, context);
    console.log(`[CONTEXT] Created context for agent ${agentId}`);
    
    return context;
  }
  
  static get(agentId: string): AgentContext | null {
    return contexts.get(agentId) || null;
  }
  
  static updateStatus(agentId: string, status: AgentStatus): void {
    const context = contexts.get(agentId);
    if (context) {
      context.status = status;
      context.lastActiveAt = new Date().toISOString();
    }
  }
  
  static incrementExecution(agentId: string): void {
    const context = contexts.get(agentId);
    if (context) {
      context.executionCount++;
      context.lastActiveAt = new Date().toISOString();
    }
  }
  
  static destroy(agentId: string): void {
    contexts.delete(agentId);
    console.log(`[CONTEXT] Destroyed context for agent ${agentId}`);
  }
  
  static getAll(): AgentContext[] {
    return Array.from(contexts.values());
  }
}
