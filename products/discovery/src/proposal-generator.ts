/**
 * AI-Powered Proposal Generator
 * Creates deployment proposals from assessment data
 */

import { Assessment } from './risk-assessment.js';
import { GapAnalysis } from './compliance-gap.js';

export interface Proposal {
  customerId: string;
  customerName: string;
  industry: string;
  executiveSummary: string;
  riskScore: number;
  gaps: number;
  phases: ProposalPhase[];
  pricing: ProposalPricing;
  timeline: string;
}

export interface ProposalPhase {
  phase: number;
  name: string;
  description: string;
  deliverables: string[];
  duration: string;
}

export interface ProposalPricing {
  phase0: number;
  phase1: number;
  phase2: number;
  total: number;
  paymentTerms: string;
}

export class ProposalGenerator {
  static generate(
    customerName: string,
    industry: string,
    assessment: Assessment,
    gapAnalysis: GapAnalysis
  ): Proposal {
    const executiveSummary = this.generateExecutiveSummary(customerName, assessment, gapAnalysis);
    const phases = this.generatePhases(assessment.riskScore, gapAnalysis);
    const pricing = this.generatePricing(assessment.riskScore, gapAnalysis);

    return {
      customerId: assessment.customerId,
      customerName,
      industry,
      executiveSummary,
      riskScore: assessment.riskScore,
      gaps: gapAnalysis.gapCount,
      phases,
      pricing,
      timeline: '12-16 weeks',
    };
  }

  private static generateExecutiveSummary(
    customerName: string,
    assessment: Assessment,
    gapAnalysis: GapAnalysis
  ): string {
    return `${customerName} currently operates with a risk score of ${assessment.riskScore}/100, ` +
           `indicating ${assessment.riskScore > 70 ? 'HIGH' : assessment.riskScore > 40 ? 'MEDIUM' : 'LOW'} risk exposure. ` +
           `Our assessment identified ${gapAnalysis.gapCount} governance gaps, with ${gapAnalysis.criticalGaps} requiring immediate attention. ` +
           `We propose a phased implementation of CoreIdentity governance framework to establish institutional-grade AI oversight.`;
  }

  private static generatePhases(riskScore: number, gapAnalysis: GapAnalysis): ProposalPhase[] {
    return [
      {
        phase: 0,
        name: 'Discovery & Policy Design',
        description: 'Comprehensive AI inventory, risk assessment, and custom policy framework creation',
        deliverables: [
          'Complete AI agent inventory',
          'Risk tier classification for all agents',
          'Custom governance policies',
          'Compliance gap remediation plan',
          'Executive governance report',
        ],
        duration: '2-3 weeks',
      },
      {
        phase: 1,
        name: 'Sentinel Deployment',
        description: 'Deploy governance layer with authorization, audit, and kill switches',
        deliverables: [
          'Sentinel Core installation',
          'Policy configuration and binding',
          'Kill switch activation (3 levels)',
          'Audit trail initialization',
          'Integration with existing systems',
          'Governance dashboard access',
        ],
        duration: '4-6 weeks',
      },
      {
        phase: 2,
        name: 'Monitoring & Optimization',
        description: 'Activate anomaly detection and optimize governance rules',
        deliverables: [
          'Anomaly detection calibration',
          'Real-time monitoring dashboards',
          'Alert configuration',
          'Policy optimization based on usage',
          'Compliance reporting automation',
          'Team training and handoff',
        ],
        duration: '6-8 weeks',
      },
    ];
  }

  private static generatePricing(riskScore: number, gapAnalysis: GapAnalysis): ProposalPricing {
    // Base pricing
    let phase0 = 35000; // Discovery baseline
    let phase1 = 50000; // Deployment baseline
    let phase2 = 30000; // Monitoring baseline

    // Risk-based adjustments
    if (riskScore > 70) {
      phase0 += 15000; // More complex discovery
      phase1 += 25000; // More rigorous deployment
    } else if (riskScore > 40) {
      phase0 += 7500;
      phase1 += 12500;
    }

    // Gap-based adjustments
    if (gapAnalysis.criticalGaps > 5) {
      phase0 += 10000;
      phase1 += 15000;
    }

    const total = phase0 + phase1 + phase2;

    return {
      phase0,
      phase1,
      phase2,
      total,
      paymentTerms: '50% deposit, 25% at Phase 1 completion, 25% at Phase 2 completion',
    };
  }

  static formatProposal(proposal: Proposal): string {
    const lines: string[] = [];
    
    lines.push('═══════════════════════════════════════════');
    lines.push(`  AI GOVERNANCE DEPLOYMENT PROPOSAL`);
    lines.push(`  ${proposal.customerName}`);
    lines.push('═══════════════════════════════════════════\n');
    
    lines.push('EXECUTIVE SUMMARY');
    lines.push(proposal.executiveSummary + '\n');
    
    lines.push('CURRENT STATE');
    lines.push(`  Risk Score: ${proposal.riskScore}/100`);
    lines.push(`  Governance Gaps: ${proposal.gaps}`);
    lines.push(`  Industry: ${proposal.industry}\n`);
    
    lines.push('PROPOSED SOLUTION\n');
    for (const phase of proposal.phases) {
      lines.push(`PHASE ${phase.phase}: ${phase.name}`);
      lines.push(`Duration: ${phase.duration}`);
      lines.push(phase.description);
      lines.push('Deliverables:');
      for (const deliverable of phase.deliverables) {
        lines.push(`  • ${deliverable}`);
      }
      lines.push('');
    }
    
    lines.push('INVESTMENT');
    lines.push(`  Phase 0 (Discovery): $${proposal.pricing.phase0.toLocaleString()}`);
    lines.push(`  Phase 1 (Deployment): $${proposal.pricing.phase1.toLocaleString()}`);
    lines.push(`  Phase 2 (Monitoring): $${proposal.pricing.phase2.toLocaleString()}`);
    lines.push(`  ────────────────────────`);
    lines.push(`  Total Investment: $${proposal.pricing.total.toLocaleString()}`);
    lines.push(`  Payment Terms: ${proposal.pricing.paymentTerms}\n`);
    
    lines.push(`Timeline: ${proposal.timeline}`);
    
    return lines.join('\n');
  }
}
