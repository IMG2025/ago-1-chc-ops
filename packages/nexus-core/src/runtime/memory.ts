/**
 * Memory Segmentation System
 * Short-term, long-term, and domain-scoped memory
 */

import { MemorySegment, MemoryScope } from './types.js';
import { randomUUID } from 'crypto';

const memoryStore = new Map<string, MemorySegment[]>();

export class MemoryManager {
  static write(
    agentId: string,
    scope: MemoryScope,
    key: string,
    value: unknown,
    ttl?: number
  ): MemorySegment {
    const segment: MemorySegment = {
      segmentId: randomUUID(),
      agentId,
      scope,
      data: { [key]: value },
      createdAt: new Date().toISOString(),
      expiresAt: ttl ? new Date(Date.now() + ttl).toISOString() : undefined,
    };
    
    const segments = memoryStore.get(agentId) || [];
    segments.push(segment);
    memoryStore.set(agentId, segments);
    
    return segment;
  }
  
  static read(agentId: string, scope: MemoryScope, key: string): unknown | null {
    const segments = memoryStore.get(agentId) || [];
    const now = new Date();
    
    // Find most recent non-expired segment with this key
    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i];
      if (segment.scope === scope && key in segment.data) {
        // Check expiration
        if (segment.expiresAt && new Date(segment.expiresAt) < now) {
          continue;
        }
        return segment.data[key];
      }
    }
    
    return null;
  }
  
  static getSegments(agentId: string, scope?: MemoryScope): MemorySegment[] {
    const segments = memoryStore.get(agentId) || [];
    const now = new Date();
    
    // Filter out expired segments
    let active = segments.filter(s => 
      !s.expiresAt || new Date(s.expiresAt) > now
    );
    
    if (scope) {
      active = active.filter(s => s.scope === scope);
    }
    
    return active;
  }
  
  static clearShortTerm(agentId: string): void {
    const segments = memoryStore.get(agentId) || [];
    const remaining = segments.filter(s => s.scope !== 'short-term');
    memoryStore.set(agentId, remaining);
  }
  
  static clearAll(agentId: string): void {
    memoryStore.delete(agentId);
    console.log(`[MEMORY] Cleared all memory for agent ${agentId}`);
  }
  
  static cleanup(): void {
    const now = new Date();
    for (const [agentId, segments] of memoryStore.entries()) {
      const active = segments.filter(s => 
        !s.expiresAt || new Date(s.expiresAt) > now
      );
      if (active.length === 0) {
        memoryStore.delete(agentId);
      } else {
        memoryStore.set(agentId, active);
      }
    }
  }
}

// Auto-cleanup expired memory every 5 minutes
setInterval(() => MemoryManager.cleanup(), 5 * 60 * 1000);
