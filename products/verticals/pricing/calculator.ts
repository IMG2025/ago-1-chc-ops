/**
 * Vertical-Specific Pricing Calculator
 * Adjusts pricing based on industry, compliance, and company size
 */

export interface PricingInput {
  industry: string;
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  complianceRequirements: string[];
  agentCount: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PricingOutput {
  phase0: number;
  phase1: number;
  phase2: number;
  platformMonthly: number;
  total: number;
  breakdown: string[];
}

export class VerticalPricingCalculator {
  private static basePricing: Record<string, any> = {
    hospitality: { phase0: 40000, phase1: 65000, phase2: 30000, platform: 1500 },
    healthcare: { phase0: 100000, phase1: 150000, phase2: 40000, platform: 5000 },
    legal: { phase0: 75000, phase1: 110000, phase2: 35000, platform: 3000 },
    financial: { phase0: 90000, phase1: 125000, phase2: 40000, platform: 4000 },
    retail: { phase0: 45000, phase1: 70000, phase2: 30000, platform: 1500 },
    manufacturing: { phase0: 65000, phase1: 95000, phase2: 35000, platform: 2500 },
    government: { phase0: 150000, phase1: 225000, phase2: 50000, platform: 10000 },
    education: { phase0: 55000, phase1: 80000, phase2: 30000, platform: 2000 },
    realestate: { phase0: 50000, phase1: 75000, phase2: 30000, platform: 1800 },
    energy: { phase0: 100000, phase1: 140000, phase2: 40000, platform: 5000 },
    transportation: { phase0: 70000, phase1: 100000, phase2: 35000, platform: 3000 },
    media: { phase0: 60000, phase1: 85000, phase2: 32000, platform: 2500 },
  };

  static calculate(input: PricingInput): PricingOutput {
    const base = this.basePricing[input.industry] || this.basePricing.hospitality;
    const breakdown: string[] = [];

    // Start with base pricing
    let phase0 = base.phase0;
    let phase1 = base.phase1;
    let phase2 = base.phase2;
    let platform = base.platform;

    breakdown.push(`Base ${input.industry} pricing`);

    // Company size multiplier
    const sizeMultipliers = {
      small: 0.8,
      medium: 1.0,
      large: 1.3,
      enterprise: 1.6,
    };
    const sizeMultiplier = sizeMultipliers[input.companySize];
    phase0 *= sizeMultiplier;
    phase1 *= sizeMultiplier;
    phase2 *= sizeMultiplier;
    platform *= sizeMultiplier;
    breakdown.push(`${input.companySize} company adjustment: ${sizeMultiplier}x`);

    // Compliance premium
    let compliancePremium = 0;
    if (input.complianceRequirements.includes('HIPAA')) {
      compliancePremium += 0.25;
      breakdown.push('HIPAA compliance: +25%');
    }
    if (input.complianceRequirements.includes('SOC2')) {
      compliancePremium += 0.15;
      breakdown.push('SOC2 compliance: +15%');
    }
    if (input.complianceRequirements.includes('FedRAMP')) {
      compliancePremium += 0.5;
      breakdown.push('FedRAMP compliance: +50%');
    }

    phase0 *= 1 + compliancePremium;
    phase1 *= 1 + compliancePremium;

    // Risk level adjustment
    const riskMultipliers = { low: 0.9, medium: 1.0, high: 1.2 };
    const riskMultiplier = riskMultipliers[input.riskLevel];
    phase0 *= riskMultiplier;
    phase1 *= riskMultiplier;
    if (riskMultiplier !== 1.0) {
      breakdown.push(`${input.riskLevel} risk: ${riskMultiplier}x`);
    }

    // Agent count adjustment for platform
    if (input.agentCount > 10) {
      const agentPremium = Math.floor((input.agentCount - 10) / 5) * 200;
      platform += agentPremium;
      breakdown.push(`Additional agents: +$${agentPremium}/mo`);
    }

    const total = Math.round(phase0 + phase1 + phase2);

    return {
      phase0: Math.round(phase0),
      phase1: Math.round(phase1),
      phase2: Math.round(phase2),
      platformMonthly: Math.round(platform),
      total,
      breakdown,
    };
  }

  static formatProposal(input: PricingInput, pricing: PricingOutput): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════');
    lines.push(`  PRICING PROPOSAL`);
    lines.push(`  ${input.industry.toUpperCase()} VERTICAL`);
    lines.push('═══════════════════════════════════════\n');

    lines.push('DEPLOYMENT PRICING\n');
    lines.push(`Phase 0 (Discovery):     $${pricing.phase0.toLocaleString()}`);
    lines.push(`Phase 1 (Deployment):    $${pricing.phase1.toLocaleString()}`);
    lines.push(`Phase 2 (Optimization):  $${pricing.phase2.toLocaleString()}`);
    lines.push(`────────────────────────────────────`);
    lines.push(`Total Investment:        $${pricing.total.toLocaleString()}\n`);

    lines.push('PLATFORM SUBSCRIPTION\n');
    lines.push(`Monthly:                 $${pricing.platformMonthly.toLocaleString()}/month`);
    lines.push(`Annual:                  $${(pricing.platformMonthly * 12).toLocaleString()}/year\n`);

    lines.push('PRICING FACTORS\n');
    for (const item of pricing.breakdown) {
      lines.push(`  • ${item}`);
    }

    return lines.join('\n');
  }
}
