/**
 * National AI Registry - Central tracking of all national AI systems
 */
export interface NationalAISystem {
  systemId: string;
  systemName: string;
  agency: string;
  department: string;
  purpose: string;
  riskClassification: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  sovereignTier: 'tier0' | 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';
  dataSources: string[];
  internationalDataTransfers: boolean;
  internationalPartners: string[];
  complianceStatus: 'compliant' | 'pending' | 'non-compliant';
  registeredDate: string;
  lastAuditDate: string;
  operationalStatus: 'active' | 'testing' | 'suspended' | 'decommissioned';
}

export class NationalAIRegistry {
  private systems: Map<string, NationalAISystem> = new Map();

  registerSystem(system: Omit<NationalAISystem, 'systemId' | 'registeredDate'>): NationalAISystem {
    const registered: NationalAISystem = {
      ...system,
      systemId: `nai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      registeredDate: new Date().toISOString(),
    };
    this.systems.set(registered.systemId, registered);
    console.log(`[REGISTRY] Registered: ${registered.systemName}`);
    return registered;
  }

  getAllSystems(): NationalAISystem[] {
    return Array.from(this.systems.values());
  }

  getSystemsByRisk(risk: string): NationalAISystem[] {
    return this.getAllSystems().filter(s => s.riskClassification === risk);
  }

  getCriticalSystems(): NationalAISystem[] {
    return this.getAllSystems().filter(
      s => s.sovereignTier === 'tier4' || s.sovereignTier === 'tier5'
    );
  }

  generateReport(): string {
    const total = this.systems.size;
    const critical = this.getCriticalSystems().length;
    const suspended = this.getAllSystems().filter(s => s.operationalStatus === 'suspended').length;
    
    return `
═══════════════════════════════════════════════════
  NATIONAL AI REGISTRY REPORT
═══════════════════════════════════════════════════

Total Systems: ${total}
Critical Systems: ${critical}
Suspended: ${suspended}
Compliance Rate: ${((this.getAllSystems().filter(s => s.complianceStatus === 'compliant').length / total) * 100).toFixed(1)}%
    `.trim();
  }
}
