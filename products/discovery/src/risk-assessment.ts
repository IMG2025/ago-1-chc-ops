/**
 * Risk Assessment Questionnaire Generator
 * AI-powered risk discovery for customer onboarding
 */

export interface Question {
  id: string;
  category: 'technical' | 'operational' | 'compliance' | 'financial';
  question: string;
  type: 'multiple-choice' | 'scale' | 'text';
  options?: string[];
  weight: number;
}

export interface Assessment {
  customerId: string;
  industry: string;
  questions: Question[];
  responses: Record<string, string | number>;
  riskScore: number;
  recommendations: string[];
}

export class RiskAssessment {
  static generateQuestionnaire(industry: string): Question[] {
    const baseQuestions: Question[] = [
      {
        id: 'ai-current-usage',
        category: 'technical',
        question: 'How many AI agents/automations do you currently use?',
        type: 'scale',
        weight: 3,
      },
      {
        id: 'data-sensitivity',
        category: 'compliance',
        question: 'What type of data do your AI systems access?',
        type: 'multiple-choice',
        options: ['Public data only', 'Internal business data', 'Customer PII', 'Financial data', 'Regulated data (HIPAA/SOC2)'],
        weight: 5,
      },
      {
        id: 'human-oversight',
        category: 'operational',
        question: 'How often do humans review AI decisions?',
        type: 'multiple-choice',
        options: ['Never', 'Occasionally', 'For important decisions', 'Always'],
        weight: 4,
      },
      {
        id: 'incident-history',
        category: 'operational',
        question: 'Have you experienced AI-related incidents?',
        type: 'multiple-choice',
        options: ['No incidents', '1-2 minor incidents', '3-5 incidents', 'Multiple serious incidents'],
        weight: 5,
      },
      {
        id: 'compliance-requirements',
        category: 'compliance',
        question: 'What compliance frameworks apply to your business?',
        type: 'multiple-choice',
        options: ['None', 'Industry standards', 'SOC2', 'GDPR/CCPA', 'HIPAA', 'Financial regulations'],
        weight: 4,
      },
    ];

    // Industry-specific questions
    if (industry === 'hospitality') {
      baseQuestions.push({
        id: 'guest-data-handling',
        category: 'compliance',
        question: 'How do AI systems handle guest data?',
        type: 'multiple-choice',
        options: ['No guest data access', 'Anonymized data only', 'Full guest profiles', 'Payment information'],
        weight: 5,
      });
    }

    return baseQuestions;
  }

  static calculateRiskScore(responses: Record<string, string | number>, questions: Question[]): number {
    let totalScore = 0;
    let maxScore = 0;

    for (const question of questions) {
      const response = responses[question.id];
      maxScore += question.weight * 10;

      if (question.type === 'scale' && typeof response === 'number') {
        totalScore += response * question.weight;
      } else if (question.type === 'multiple-choice' && typeof response === 'string') {
        // Score based on risk level of answer
        const optionIndex = question.options?.indexOf(response) || 0;
        const riskMultiplier = (optionIndex + 1) / (question.options?.length || 1);
        totalScore += riskMultiplier * 10 * question.weight;
      }
    }

    return Math.round((totalScore / maxScore) * 100);
  }

  static generateRecommendations(riskScore: number, responses: Record<string, string | number>): string[] {
    const recommendations: string[] = [];

    if (riskScore > 70) {
      recommendations.push('HIGH PRIORITY: Implement immediate governance controls');
      recommendations.push('Deploy kill switches for all AI agents');
      recommendations.push('Require human approval for all Tier 2+ actions');
    } else if (riskScore > 40) {
      recommendations.push('MEDIUM PRIORITY: Establish governance framework');
      recommendations.push('Implement anomaly detection');
      recommendations.push('Create audit trail system');
    } else {
      recommendations.push('LOW PRIORITY: Establish baseline governance');
      recommendations.push('Monitor AI usage patterns');
      recommendations.push('Document current AI inventory');
    }

    // Data-specific recommendations
    if (responses['data-sensitivity']?.toString().includes('PII') || 
        responses['data-sensitivity']?.toString().includes('Financial')) {
      recommendations.push('CRITICAL: Implement data access controls');
      recommendations.push('Enable comprehensive audit logging');
    }

    return recommendations;
  }
}
