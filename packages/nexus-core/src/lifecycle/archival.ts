/**
 * Agent Archival System
 * Preserves agent identity and audit trail after retirement
 */

import { AgentArchive, AgentIdentity } from './types.js';

const archives = new Map<string, AgentArchive>();

export class ArchivalSystem {
  static archive(identity: AgentIdentity, auditEventIds: string[]): AgentArchive {
    const archive: AgentArchive = {
      identity,
      auditTrail: auditEventIds,
      archivedAt: new Date().toISOString(),
    };
    
    archives.set(identity.agentId, archive);
    
    console.log(
      `[ARCHIVAL] Archived agent ${identity.agentId} with ` +
      `${auditEventIds.length} audit events`
    );
    
    return archive;
  }
  
  static retrieve(agentId: string): AgentArchive | null {
    return archives.get(agentId) || null;
  }
  
  static search(filter: {
    agentClass?: string;
    domainName?: string;
    retiredAfter?: string;
  }): AgentArchive[] {
    let results = Array.from(archives.values());
    
    if (filter.agentClass) {
      results = results.filter(a => a.identity.agentClass === filter.agentClass);
    }
    
    if (filter.domainName) {
      results = results.filter(a => a.identity.domainName === filter.domainName);
    }
    
    if (filter.retiredAfter) {
      results = results.filter(a => 
        a.identity.retiredAt && a.identity.retiredAt >= filter.retiredAfter!
      );
    }
    
    return results;
  }
  
  static getStats(): {
    totalArchived: number;
    byClass: Record<string, number>;
    byDomain: Record<string, number>;
  } {
    const byClass: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    
    for (const archive of archives.values()) {
      byClass[archive.identity.agentClass] = (byClass[archive.identity.agentClass] || 0) + 1;
      byDomain[archive.identity.domainName] = (byDomain[archive.identity.domainName] || 0) + 1;
    }
    
    return {
      totalArchived: archives.size,
      byClass,
      byDomain,
    };
  }
}
