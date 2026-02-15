/**
 * Zombie Agent Detector
 * Identifies inactive agents for cleanup
 */

import { AgentRegistry } from './registry.js';
import { ContextManager } from '../runtime/context.js';

export class ZombieDetector {
  static detectZombies(inactiveThresholdHours: number = 24): string[] {
    const contexts = ContextManager.getAll();
    const now = new Date();
    const threshold = new Date(now.getTime() - inactiveThresholdHours * 60 * 60 * 1000);
    const zombies: string[] = [];
    
    for (const context of contexts) {
      const lastActive = new Date(context.lastActiveAt);
      
      if (lastActive < threshold && context.status !== 'terminated') {
        const identity = AgentRegistry.get(context.agentId);
        if (identity && identity.state !== 'retired') {
          zombies.push(context.agentId);
        }
      }
    }
    
    if (zombies.length > 0) {
      console.log(`[ZOMBIE DETECTOR] Found ${zombies.length} zombie agents`);
    }
    
    return zombies;
  }
  
  static autoRetireZombies(inactiveThresholdHours: number = 72): number {
    const zombies = this.detectZombies(inactiveThresholdHours);
    
    for (const agentId of zombies) {
      AgentRegistry.retire(
        agentId,
        'system',
        `Auto-retired after ${inactiveThresholdHours}h of inactivity`
      );
      ContextManager.destroy(agentId);
    }
    
    return zombies.length;
  }
}
