/**
 * Sovereign Risk Tiers - National security classification
 */
export interface SovereignTier {
  tier: 'tier0' | 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';
  name: string;
  description: string;
  examples: string[];
  approvalAuthority: string;
  responseTime: string;
}

export const SOVEREIGN_TIERS: SovereignTier[] = [
  {
    tier: 'tier0',
    name: 'Public Information',
    description: 'AI systems processing only public information',
    examples: ['Public data queries', 'Open government data'],
    approvalAuthority: 'Department Head',
    responseTime: '7 days',
  },
  {
    tier: 'tier1',
    name: 'Administrative Services',
    description: 'Routine government operations',
    examples: ['Constituent services', 'Permit processing'],
    approvalAuthority: 'Agency Director',
    responseTime: '48 hours',
  },
  {
    tier: 'tier2',
    name: 'Citizen-Facing Services',
    description: 'Systems directly impacting citizens',
    examples: ['Benefits determination', 'Healthcare', 'Education'],
    approvalAuthority: 'Cabinet-Level Official',
    responseTime: '24 hours',
  },
  {
    tier: 'tier3',
    name: 'Critical Infrastructure',
    description: 'Essential national infrastructure',
    examples: ['Energy grid', 'Water systems', 'Transportation'],
    approvalAuthority: 'National Security Council',
    responseTime: '4 hours',
  },
  {
    tier: 'tier4',
    name: 'National Security',
    description: 'Defense, intelligence, law enforcement',
    examples: ['Defense systems', 'Intelligence', 'Law enforcement'],
    approvalAuthority: 'Head of State / Defense Minister',
    responseTime: '1 hour',
  },
  {
    tier: 'tier5',
    name: 'Sovereign Critical',
    description: 'National sovereignty and existential security',
    examples: ['Autonomous weapons', 'Elections', 'Monetary policy', 'Nuclear C2'],
    approvalAuthority: 'Head of State + Legislative Approval',
    responseTime: 'Immediate (<15 min)',
  },
];

export class SovereignRiskFramework {
  getTierDefinition(tier: string): SovereignTier | undefined {
    return SOVEREIGN_TIERS.find(t => t.tier === tier);
  }

  validateSystemForTier(purpose: string, tier: string): { valid: boolean; recommendations: string[] } {
    const tierDef = this.getTierDefinition(tier);
    if (!tierDef) return { valid: false, recommendations: ['Invalid tier'] };
    
    return {
      valid: true,
      recommendations: [
        `Approval required from: ${tierDef.approvalAuthority}`,
        `Response time: ${tierDef.responseTime}`,
      ],
    };
  }
}
