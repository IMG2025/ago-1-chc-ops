/**
 * CIAG Advisory Engagement Framework
 */

export interface AdvisoryEngagement {
  engagementId: string;
  clientName: string;
  engagementType: 'diagnostic' | 'governance_deployment' | 'transformation' | 'ongoing_advisory';
  scope: string[];
  startDate: string;
  expectedDuration: string;
  team: AdvisoryTeamMember[];
  deliverables: Deliverable[];
  pricing: EngagementPricing;
  status: 'scoping' | 'active' | 'completed' | 'on_hold';
  milestones: Milestone[];
}

export interface AdvisoryTeamMember {
  role: 'lead_advisor' | 'governance_specialist' | 'technical_architect' | 'analyst';
  name: string;
  hoursAllocated: number;
}

export interface Deliverable {
  name: string;
  description: string;
  dueDate: string;
  status: 'not_started' | 'in_progress' | 'review' | 'delivered';
  template?: string;
}

export interface EngagementPricing {
  model: 'fixed_fee' | 'hourly' | 'retainer' | 'value_based';
  amount: number;
  currency: string;
  paymentTerms: string;
  milestonePayments?: MilestonePayment[];
}

export interface MilestonePayment {
  milestone: string;
  percentage: number;
  amount: number;
  dueDate: string;
}

export interface Milestone {
  name: string;
  dueDate: string;
  completed: boolean;
  deliverables: string[];
}

export const ENGAGEMENT_TEMPLATES = {
  DIAGNOSTIC: {
    name: 'AI Governance Diagnostic & Risk Assessment',
    duration: '21 days',
    pricing: { model: 'fixed_fee', amount: 95000, currency: 'USD' },
    deliverables: [
      'Executive Governance Briefing',
      'AI Risk Classification Report',
      'Compliance Gap Assessment',
      'Workforce Governance Blueprint',
      '90-Day Remediation Roadmap'
    ]
  },
  
  GOVERNANCE_DEPLOYMENT: {
    name: 'Multi-Location Governance System Deployment',
    duration: '90 days',
    pricing: { model: 'fixed_fee', amount: 150000, currency: 'USD' },
    deliverables: [
      'Governance Framework Deployment',
      'Policy Architecture',
      'Compliance Overlay Configuration',
      'Workforce Governance Design',
      'Audit Logging Architecture',
      'Monitoring Dashboard Setup'
    ]
  }
};

export class AdvisoryEngagementManager {
  private engagements: Map<string, AdvisoryEngagement> = new Map();

  createEngagement(template: keyof typeof ENGAGEMENT_TEMPLATES, clientName: string): AdvisoryEngagement {
    const templateData = ENGAGEMENT_TEMPLATES[template];
    
    const engagement: AdvisoryEngagement = {
      engagementId: `eng_${Date.now()}`,
      clientName,
      engagementType: template.toLowerCase().replace('_', '_') as any,
      scope: templateData.deliverables,
      startDate: new Date().toISOString(),
      expectedDuration: templateData.duration,
      team: [],
      deliverables: templateData.deliverables.map(d => ({
        name: d,
        description: '',
        dueDate: '',
        status: 'not_started'
      })),
      pricing: templateData.pricing as any,
      status: 'scoping',
      milestones: []
    };

    this.engagements.set(engagement.engagementId, engagement);
    return engagement;
  }
}
