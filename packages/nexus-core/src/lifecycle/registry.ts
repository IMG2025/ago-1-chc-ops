/**
 * Agent Identity Registry
 * Central registry for all agent identities
 */

import { AgentIdentity, AgentClass, LifecycleState } from './types.js';
import { randomUUID } from 'crypto';

const identities = new Map<string, AgentIdentity>();

export class AgentRegistry {
  static create(params: {
    agentClass: AgentClass;
    domainName: string;
    createdBy: string;
  }): AgentIdentity {
    const identity: AgentIdentity = {
      agentId: `agent-${randomUUID()}`,
      agentClass: params.agentClass,
      domainName: params.domainName,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy,
      state: 'created',
      capabilities: [], // Zero capabilities at creation
    };
    
    identities.set(identity.agentId, identity);
    
    console.log(
      `[LIFECYCLE] Created ${params.agentClass} agent ${identity.agentId} ` +
      `in domain ${params.domainName}`
    );
    
    return identity;
  }
  
  static get(agentId: string): AgentIdentity | null {
    return identities.get(agentId) || null;
  }
  
  static updateState(agentId: string, state: LifecycleState): void {
    const identity = identities.get(agentId);
    if (identity) {
      identity.state = state;
      console.log(`[LIFECYCLE] Agent ${agentId} state changed to ${state}`);
    }
  }
  
  static grantCapability(agentId: string, capability: string): void {
    const identity = identities.get(agentId);
    if (identity && !identity.capabilities.includes(capability)) {
      identity.capabilities.push(capability);
      console.log(`[LIFECYCLE] Granted capability '${capability}' to agent ${agentId}`);
    }
  }
  
  static retire(agentId: string, retiredBy: string, reason: string): void {
    const identity = identities.get(agentId);
    if (identity) {
      identity.state = 'retired';
      identity.retiredAt = new Date().toISOString();
      identity.retiredBy = retiredBy;
      identity.retiredReason = reason;
      
      console.log(`[LIFECYCLE] Agent ${agentId} retired: ${reason}`);
    }
  }
  
  static getAll(filter?: { state?: LifecycleState; domainName?: string }): AgentIdentity[] {
    let results = Array.from(identities.values());
    
    if (filter?.state) {
      results = results.filter(i => i.state === filter.state);
    }
    
    if (filter?.domainName) {
      results = results.filter(i => i.domainName === filter.domainName);
    }
    
    return results;
  }
}
