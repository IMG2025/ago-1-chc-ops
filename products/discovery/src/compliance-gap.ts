/**
 * Compliance Gap Analysis
 * Identifies governance gaps vs. best practices
 */

export interface ComplianceControl {
  id: string;
  category: string;
  control: string;
  required: boolean;
  implemented: boolean;
  evidence?: string;
}

export interface GapAnalysis {
  customerId: string;
  framework: 'baseline' | 'soc2' | 'hipaa' | 'gdpr';
  controls: ComplianceControl[];
  gapCount: number;
  criticalGaps: number;
  completionPercentage: number;
}

export class ComplianceGapAnalyzer {
  static getRequiredControls(framework: 'baseline' | 'soc2' | 'hipaa' | 'gdpr'): ComplianceControl[] {
    const baselineControls: ComplianceControl[] = [
      {
        id: 'auth-001',
        category: 'Authorization',
        control: 'AI agents require explicit authorization before execution',
        required: true,
        implemented: false,
      },
      {
        id: 'audit-001',
        category: 'Audit',
        control: 'All AI decisions are logged with timestamp and rationale',
        required: true,
        implemented: false,
      },
      {
        id: 'kill-001',
        category: 'Emergency Control',
        control: 'Kill switches available for immediate agent suspension',
        required: true,
        implemented: false,
      },
      {
        id: 'monitor-001',
        category: 'Monitoring',
        control: 'Anomaly detection for unusual agent behavior',
        required: true,
        implemented: false,
      },
      {
        id: 'data-001',
        category: 'Data Access',
        control: 'AI agents have minimum necessary data access',
        required: true,
        implemented: false,
      },
    ];

    if (framework === 'soc2') {
      baselineControls.push(
        {
          id: 'soc2-001',
          category: 'Access Control',
          control: 'Role-based access control for all AI operations',
          required: true,
          implemented: false,
        },
        {
          id: 'soc2-002',
          category: 'Change Management',
          control: 'All AI policy changes require approval and documentation',
          required: true,
          implemented: false,
        },
        {
          id: 'soc2-003',
          category: 'Incident Response',
          control: 'Documented incident response procedures for AI failures',
          required: true,
          implemented: false,
        }
      );
    }

    return baselineControls;
  }

  static analyzeGaps(controls: ComplianceControl[]): GapAnalysis {
    const implementedCount = controls.filter(c => c.implemented).length;
    const gapCount = controls.length - implementedCount;
    const criticalGaps = controls.filter(c => c.required && !c.implemented).length;
    const completionPercentage = Math.round((implementedCount / controls.length) * 100);

    return {
      customerId: '',
      framework: 'baseline',
      controls,
      gapCount,
      criticalGaps,
      completionPercentage,
    };
  }

  static generateReport(analysis: GapAnalysis): string {
    const lines: string[] = [];
    lines.push('=== COMPLIANCE GAP ANALYSIS ===\n');
    lines.push(`Framework: ${analysis.framework.toUpperCase()}`);
    lines.push(`Completion: ${analysis.completionPercentage}%`);
    lines.push(`Total Gaps: ${analysis.gapCount}`);
    lines.push(`Critical Gaps: ${analysis.criticalGaps}\n`);
    
    lines.push('GAPS TO ADDRESS:\n');
    for (const control of analysis.controls) {
      if (!control.implemented) {
        const priority = control.required ? '[CRITICAL]' : '[OPTIONAL]';
        lines.push(`${priority} ${control.category}: ${control.control}`);
      }
    }

    return lines.join('\n');
  }
}
