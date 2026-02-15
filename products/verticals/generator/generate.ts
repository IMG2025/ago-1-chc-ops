/**
 * Vertical Template Generator
 * Creates complete industry-specific packages
 */

export interface VerticalConfig {
  industry: string;
  displayName: string;
  description: string;
  riskTiers: {
    tier0: string[];
    tier1: string[];
    tier2: string[];
    tier3: string[];
    tier4: string[];
  };
  complianceFrameworks: string[];
  agents: AgentTemplate[];
  pricing: PricingModel;
}

export interface AgentTemplate {
  name: string;
  role: string;
  capabilities: string[];
  governance: {
    tier: string;
    requiresApproval: string[];
  };
  integrations: string[];
}

export interface PricingModel {
  phase0: { min: number; max: number };
  phase1: { min: number; max: number };
  platformMonthly: number;
  notes: string;
}

export class VerticalGenerator {
  static generate(industry: string): VerticalConfig {
    const configs: Record<string, VerticalConfig> = {
      hospitality: this.generateHospitality(),
      healthcare: this.generateHealthcare(),
      legal: this.generateLegal(),
      financial: this.generateFinancial(),
      retail: this.generateRetail(),
      manufacturing: this.generateManufacturing(),
      government: this.generateGovernment(),
      education: this.generateEducation(),
      realestate: this.generateRealEstate(),
      energy: this.generateEnergy(),
      transportation: this.generateTransportation(),
      media: this.generateMedia(),
    };

    return configs[industry];
  }

  private static generateHospitality(): VerticalConfig {
    return {
      industry: 'hospitality',
      displayName: 'Hospitality & Hotels',
      description: 'AI governance for hotels, resorts, and hospitality operations',
      riskTiers: {
        tier0: ['guest_data_queries', 'public_information'],
        tier1: ['reservation_recommendations', 'service_suggestions'],
        tier2: ['room_assignments', 'service_requests', 'guest_communications'],
        tier3: ['pricing_adjustments', 'guest_credits', 'loyalty_modifications'],
        tier4: ['financial_transactions', 'refunds', 'payment_processing'],
      },
      complianceFrameworks: ['PCI-DSS', 'GDPR', 'CCPA', 'Brand Standards'],
      agents: [
        {
          name: 'Guest Experience Advisor',
          role: 'Analyzes guest feedback and recommends service improvements',
          capabilities: ['feedback_analysis', 'service_recommendations', 'vip_flagging'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['major_service_changes'],
          },
          integrations: ['PMS', 'CRM', 'Review Platforms'],
        },
        {
          name: 'Revenue Optimization Executor',
          role: 'Dynamic pricing and occupancy optimization',
          capabilities: ['pricing_optimization', 'demand_forecasting', 'upsell_identification'],
          governance: {
            tier: 'tier3',
            requiresApproval: ['price_changes_over_20_percent'],
          },
          integrations: ['RMS', 'PMS', 'Analytics'],
        },
        {
          name: 'Operations Monitor',
          role: 'Service request routing and staff allocation',
          capabilities: ['request_routing', 'staff_scheduling', 'maintenance_tracking'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['emergency_requests'],
          },
          integrations: ['Property Management', 'Maintenance Systems'],
        },
      ],
      pricing: {
        phase0: { min: 35000, max: 50000 },
        phase1: { min: 60000, max: 85000 },
        platformMonthly: 1500,
        notes: 'Pricing varies by property count and guest volume',
      },
    };
  }

  private static generateHealthcare(): VerticalConfig {
    return {
      industry: 'healthcare',
      displayName: 'Healthcare & Medical',
      description: 'HIPAA-compliant AI governance for healthcare organizations',
      riskTiers: {
        tier0: ['public_health_information', 'medical_literature'],
        tier1: ['medical_research', 'literature_review', 'anonymized_analytics'],
        tier2: ['patient_data_queries_anonymized', 'scheduling', 'billing'],
        tier3: ['diagnosis_support', 'treatment_recommendations', 'care_planning'],
        tier4: ['phi_access', 'prescription_recommendations', 'clinical_decisions'],
      },
      complianceFrameworks: ['HIPAA', 'HITECH', 'State Medical Privacy Laws', 'FDA'],
      agents: [
        {
          name: 'Medical Records Analyzer',
          role: 'Reads patient charts and identifies trends with HIPAA compliance',
          capabilities: ['chart_review', 'trend_identification', 'anomaly_flagging'],
          governance: {
            tier: 'tier4',
            requiresApproval: ['all_phi_access'],
          },
          integrations: ['EHR', 'HIPAA Audit Systems'],
        },
        {
          name: 'Diagnosis Support Advisor',
          role: 'Reviews symptoms and suggests differential diagnosis',
          capabilities: ['symptom_analysis', 'differential_diagnosis', 'literature_references'],
          governance: {
            tier: 'tier3',
            requiresApproval: ['all_recommendations'],
          },
          integrations: ['EHR', 'Medical Databases', 'Clinical Decision Support'],
        },
        {
          name: 'Clinical Trial Coordinator',
          role: 'Patient matching and eligibility screening for trials',
          capabilities: ['eligibility_screening', 'patient_matching', 'consent_tracking'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['patient_enrollment'],
          },
          integrations: ['Trial Management Systems', 'EHR'],
        },
      ],
      pricing: {
        phase0: { min: 85000, max: 150000 },
        phase1: { min: 125000, max: 200000 },
        platformMonthly: 5000,
        notes: 'HIPAA compliance premium included',
      },
    };
  }

  private static generateLegal(): VerticalConfig {
    return {
      industry: 'legal',
      displayName: 'Legal Services',
      description: 'AI governance for law firms with privilege protection',
      riskTiers: {
        tier0: ['public_legal_research', 'statute_lookup'],
        tier1: ['document_review', 'contract_analysis', 'citation_verification'],
        tier2: ['legal_memo_drafting', 'discovery_assistance'],
        tier3: ['case_strategy_recommendations', 'settlement_analysis'],
        tier4: ['client_privilege_information', 'confidential_communications'],
      },
      complianceFrameworks: ['Attorney-Client Privilege', 'State Bar Regulations', 'Confidentiality'],
      agents: [
        {
          name: 'Contract Review Advisor',
          role: 'Analyzes contracts and flags risky clauses',
          capabilities: ['contract_parsing', 'risk_flagging', 'comparison_analysis'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['client_advice'],
          },
          integrations: ['Document Management', 'Contract Lifecycle Management'],
        },
        {
          name: 'Legal Research Assistant',
          role: 'Case law research and statute analysis',
          capabilities: ['case_research', 'statute_analysis', 'citation_verification'],
          governance: {
            tier: 'tier0',
            requiresApproval: ['none_read_only'],
          },
          integrations: ['Westlaw', 'LexisNexis', 'Casetext'],
        },
        {
          name: 'Document Discovery Executor',
          role: 'E-discovery automation with privilege screening',
          capabilities: ['document_categorization', 'privilege_screening', 'relevance_scoring'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['privilege_determinations'],
          },
          integrations: ['E-Discovery Platforms', 'Document Review Systems'],
        },
      ],
      pricing: {
        phase0: { min: 60000, max: 100000 },
        phase1: { min: 90000, max: 150000 },
        platformMonthly: 3000,
        notes: 'Pricing varies by firm size and matter volume',
      },
    };
  }

  private static generateFinancial(): VerticalConfig {
    return {
      industry: 'financial',
      displayName: 'Financial Services',
      description: 'SEC/FINRA compliant AI governance for financial institutions',
      riskTiers: {
        tier0: ['market_data_queries', 'public_research'],
        tier1: ['portfolio_analysis', 'investment_recommendations'],
        tier2: ['trade_suggestions', 'risk_assessment'],
        tier3: ['automated_trading_within_limits', 'rebalancing'],
        tier4: ['large_transactions', 'client_fund_movements', 'account_changes'],
      },
      complianceFrameworks: ['SEC', 'FINRA', 'SOC2', 'PCI-DSS', 'KYC/AML'],
      agents: [
        {
          name: 'Portfolio Analyzer',
          role: 'Investment performance analysis and rebalancing suggestions',
          capabilities: ['performance_tracking', 'risk_assessment', 'rebalancing_recommendations'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['client_communications'],
          },
          integrations: ['Portfolio Management', 'Market Data', 'CRM'],
        },
        {
          name: 'Trading Assistant',
          role: 'Market analysis and trade execution within limits',
          capabilities: ['market_analysis', 'trade_execution', 'compliance_checking'],
          governance: {
            tier: 'tier3',
            requiresApproval: ['trades_over_10k'],
          },
          integrations: ['Trading Platforms', 'Market Data', 'Compliance Systems'],
        },
        {
          name: 'Fraud Detection Monitor',
          role: 'Transaction monitoring and AML screening',
          capabilities: ['transaction_monitoring', 'anomaly_detection', 'aml_screening'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['suspicious_activity_reports'],
          },
          integrations: ['Transaction Systems', 'AML Platforms', 'Alert Systems'],
        },
      ],
      pricing: {
        phase0: { min: 75000, max: 125000 },
        phase1: { min: 100000, max: 175000 },
        platformMonthly: 4000,
        notes: 'SEC/FINRA compliance included',
      },
    };
  }

  private static generateRetail(): VerticalConfig {
    return {
      industry: 'retail',
      displayName: 'Retail & E-Commerce',
      description: 'AI governance for retail operations and customer experience',
      riskTiers: {
        tier0: ['product_catalog_queries', 'inventory_lookups'],
        tier1: ['customer_service_responses', 'product_recommendations'],
        tier2: ['order_processing', 'inventory_management', 'returns'],
        tier3: ['pricing_changes', 'promotions', 'discounts'],
        tier4: ['large_refunds', 'account_changes', 'fraud_decisions'],
      },
      complianceFrameworks: ['PCI-DSS', 'GDPR', 'CCPA', 'FTC Regulations'],
      agents: [
        {
          name: 'Customer Service Executor',
          role: 'Order tracking, returns, and product recommendations',
          capabilities: ['order_tracking', 'returns_processing', 'product_recommendations'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['refunds_over_500'],
          },
          integrations: ['E-Commerce Platform', 'CRM', 'Inventory Systems'],
        },
        {
          name: 'Inventory Optimizer',
          role: 'Stock monitoring and demand forecasting',
          capabilities: ['stock_monitoring', 'demand_forecasting', 'reorder_automation'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['large_purchases'],
          },
          integrations: ['Inventory Management', 'Supply Chain', 'Analytics'],
        },
        {
          name: 'Dynamic Pricing Advisor',
          role: 'Competitive pricing and promotion optimization',
          capabilities: ['price_optimization', 'promotion_planning', 'margin_protection'],
          governance: {
            tier: 'tier3',
            requiresApproval: ['price_changes_over_15_percent'],
          },
          integrations: ['Pricing Systems', 'Competitor Data', 'Analytics'],
        },
      ],
      pricing: {
        phase0: { min: 35000, max: 60000 },
        phase1: { min: 50000, max: 90000 },
        platformMonthly: 1500,
        notes: 'Pricing scales with transaction volume',
      },
    };
  }

  private static generateManufacturing(): VerticalConfig {
    return {
      industry: 'manufacturing',
      displayName: 'Manufacturing & Industrial',
      description: 'AI governance for production and quality control',
      riskTiers: {
        tier0: ['production_metrics_read', 'quality_data_queries'],
        tier1: ['quality_analysis', 'defect_detection', 'trend_identification'],
        tier2: ['production_scheduling', 'resource_allocation'],
        tier3: ['equipment_control', 'process_changes', 'maintenance_scheduling'],
        tier4: ['safety_systems', 'emergency_shutdown', 'critical_adjustments'],
      },
      complianceFrameworks: ['OSHA', 'ISO 9001', 'Environmental Regulations', 'Industry Standards'],
      agents: [
        {
          name: 'Quality Control Monitor',
          role: 'Defect detection and root cause analysis',
          capabilities: ['defect_detection', 'root_cause_analysis', 'process_improvement'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['process_changes'],
          },
          integrations: ['Quality Management', 'Production Systems', 'Analytics'],
        },
        {
          name: 'Production Optimizer',
          role: 'Schedule optimization and resource allocation',
          capabilities: ['schedule_optimization', 'resource_allocation', 'downtime_reduction'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['major_schedule_changes'],
          },
          integrations: ['MES', 'ERP', 'Scheduling Systems'],
        },
        {
          name: 'Predictive Maintenance Advisor',
          role: 'Equipment monitoring and failure prediction',
          capabilities: ['equipment_monitoring', 'failure_prediction', 'maintenance_scheduling'],
          governance: {
            tier: 'tier3',
            requiresApproval: ['equipment_shutdowns'],
          },
          integrations: ['CMMS', 'IoT Sensors', 'Maintenance Systems'],
        },
      ],
      pricing: {
        phase0: { min: 50000, max: 85000 },
        phase1: { min: 75000, max: 125000 },
        platformMonthly: 2500,
        notes: 'Pricing varies by production volume and complexity',
      },
    };
  }

  private static generateGovernment(): VerticalConfig {
    return {
      industry: 'government',
      displayName: 'Government & Public Sector',
      description: 'AI governance for government agencies and public services',
      riskTiers: {
        tier0: ['public_information', 'open_data'],
        tier1: ['constituent_services', 'permit_processing'],
        tier2: ['case_management', 'benefit_determination'],
        tier3: ['enforcement_decisions', 'regulatory_actions'],
        tier4: ['classified_information', 'national_security', 'law_enforcement'],
      },
      complianceFrameworks: ['FISMA', 'FedRAMP', 'State Regulations', 'Public Records Laws'],
      agents: [
        {
          name: 'Citizen Services Assistant',
          role: 'Handles citizen inquiries and service requests',
          capabilities: ['inquiry_handling', 'service_routing', 'information_provision'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['policy_interpretations'],
          },
          integrations: ['311 Systems', 'Case Management', 'Service Portals'],
        },
        {
          name: 'Permit Processing Executor',
          role: 'Permit review and approval workflow',
          capabilities: ['application_review', 'compliance_checking', 'workflow_routing'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['permit_denials'],
          },
          integrations: ['Permit Systems', 'GIS', 'Document Management'],
        },
        {
          name: 'Fraud Detection Monitor',
          role: 'Benefits fraud detection and investigation',
          capabilities: ['fraud_detection', 'pattern_analysis', 'case_flagging'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['investigations'],
          },
          integrations: ['Benefits Systems', 'Analytics', 'Investigation Tools'],
        },
      ],
      pricing: {
        phase0: { min: 100000, max: 250000 },
        phase1: { min: 150000, max: 350000 },
        platformMonthly: 10000,
        notes: 'Government procurement pricing, FedRAMP premium',
      },
    };
  }

  private static generateEducation(): VerticalConfig {
    return {
      industry: 'education',
      displayName: 'Education & Universities',
      description: 'AI governance for educational institutions',
      riskTiers: {
        tier0: ['public_course_information', 'catalog_queries'],
        tier1: ['student_support', 'course_recommendations'],
        tier2: ['admissions_screening', 'grading_assistance'],
        tier3: ['student_records_access', 'grade_changes'],
        tier4: ['ferpa_protected_data', 'disciplinary_records'],
      },
      complianceFrameworks: ['FERPA', 'COPPA', 'State Education Laws', 'Accreditation Standards'],
      agents: [
        {
          name: 'Admissions Assistant',
          role: 'Application review and candidate screening',
          capabilities: ['application_review', 'candidate_screening', 'recommendation_analysis'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['admission_decisions'],
          },
          integrations: ['Admissions Systems', 'CRM', 'Student Information Systems'],
        },
        {
          name: 'Student Support Advisor',
          role: 'Academic advising and course recommendations',
          capabilities: ['course_recommendations', 'degree_planning', 'resource_guidance'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['policy_exceptions'],
          },
          integrations: ['SIS', 'LMS', 'Advising Systems'],
        },
        {
          name: 'Grading Analysis Assistant',
          role: 'Grading consistency and rubric application',
          capabilities: ['rubric_application', 'consistency_checking', 'feedback_generation'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['final_grades'],
          },
          integrations: ['LMS', 'Grading Systems'],
        },
      ],
      pricing: {
        phase0: { min: 40000, max: 75000 },
        phase1: { min: 60000, max: 110000 },
        platformMonthly: 2000,
        notes: 'Academic pricing available, scales with enrollment',
      },
    };
  }

  private static generateRealEstate(): VerticalConfig {
    return {
      industry: 'realestate',
      displayName: 'Real Estate',
      description: 'AI governance for real estate operations',
      riskTiers: {
        tier0: ['property_data_queries', 'market_research'],
        tier1: ['valuation_analysis', 'comp_selection'],
        tier2: ['client_matching', 'showing_scheduling'],
        tier3: ['pricing_recommendations', 'offer_analysis'],
        tier4: ['contract_execution', 'financial_transactions'],
      },
      complianceFrameworks: ['Fair Housing', 'State Real Estate Laws', 'MLS Rules'],
      agents: [
        {
          name: 'Property Analyzer',
          role: 'Comparable analysis and valuation',
          capabilities: ['comp_analysis', 'valuation', 'market_trends'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['pricing_recommendations'],
          },
          integrations: ['MLS', 'Property Databases', 'Analytics'],
        },
        {
          name: 'Client Matching Assistant',
          role: 'Buyer-property matching and showing coordination',
          capabilities: ['client_matching', 'preference_analysis', 'showing_scheduling'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['client_communications'],
          },
          integrations: ['CRM', 'MLS', 'Scheduling Systems'],
        },
        {
          name: 'Market Intelligence Monitor',
          role: 'Market trends and investment analysis',
          capabilities: ['trend_analysis', 'investment_evaluation', 'market_forecasting'],
          governance: {
            tier: 'tier0',
            requiresApproval: ['none_read_only'],
          },
          integrations: ['Market Data', 'Analytics', 'GIS'],
        },
      ],
      pricing: {
        phase0: { min: 35000, max: 65000 },
        phase1: { min: 50000, max: 95000 },
        platformMonthly: 1800,
        notes: 'Pricing varies by market size and transaction volume',
      },
    };
  }

  private static generateEnergy(): VerticalConfig {
    return {
      industry: 'energy',
      displayName: 'Energy & Utilities',
      description: 'AI governance for critical energy infrastructure',
      riskTiers: {
        tier0: ['public_usage_data', 'rate_information'],
        tier1: ['demand_forecasting', 'optimization_recommendations'],
        tier2: ['grid_monitoring', 'resource_allocation'],
        tier3: ['grid_adjustments', 'automated_response'],
        tier4: ['critical_infrastructure_control', 'emergency_response'],
      },
      complianceFrameworks: ['NERC CIP', 'State Utility Regulations', 'Environmental Standards'],
      agents: [
        {
          name: 'Grid Optimization Advisor',
          role: 'Energy distribution optimization',
          capabilities: ['load_balancing', 'efficiency_optimization', 'demand_response'],
          governance: {
            tier: 'tier3',
            requiresApproval: ['major_grid_changes'],
          },
          integrations: ['SCADA', 'Energy Management Systems', 'Grid Analytics'],
        },
        {
          name: 'Demand Forecasting Monitor',
          role: 'Energy demand prediction and planning',
          capabilities: ['demand_forecasting', 'weather_integration', 'capacity_planning'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['major_capacity_decisions'],
          },
          integrations: ['Analytics', 'Weather Data', 'Historical Systems'],
        },
        {
          name: 'Outage Management Executor',
          role: 'Outage detection and restoration coordination',
          capabilities: ['outage_detection', 'crew_dispatch', 'restoration_prioritization'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['manual_override_required'],
          },
          integrations: ['OMS', 'GIS', 'Crew Management'],
        },
      ],
      pricing: {
        phase0: { min: 75000, max: 150000 },
        phase1: { min: 100000, max: 200000 },
        platformMonthly: 5000,
        notes: 'Critical infrastructure premium, NERC CIP compliance',
      },
    };
  }

  private static generateTransportation(): VerticalConfig {
    return {
      industry: 'transportation',
      displayName: 'Transportation & Logistics',
      description: 'AI governance for logistics and fleet operations',
      riskTiers: {
        tier0: ['shipment_tracking', 'route_information'],
        tier1: ['route_optimization', 'delivery_scheduling'],
        tier2: ['fleet_management', 'dispatch_automation'],
        tier3: ['dynamic_routing', 'carrier_selection'],
        tier4: ['autonomous_vehicle_control', 'safety_critical_decisions'],
      },
      complianceFrameworks: ['DOT Regulations', 'International Shipping', 'Safety Standards'],
      agents: [
        {
          name: 'Route Optimization Executor',
          role: 'Delivery route optimization and traffic avoidance',
          capabilities: ['route_optimization', 'traffic_analysis', 'fuel_efficiency'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['major_route_changes'],
          },
          integrations: ['TMS', 'GPS', 'Traffic Data'],
        },
        {
          name: 'Fleet Management Monitor',
          role: 'Vehicle health and maintenance scheduling',
          capabilities: ['vehicle_monitoring', 'maintenance_prediction', 'utilization_optimization'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['vehicle_retirement'],
          },
          integrations: ['Fleet Management', 'Telematics', 'Maintenance Systems'],
        },
        {
          name: 'Shipment Tracking Assistant',
          role: 'Shipment visibility and exception handling',
          capabilities: ['tracking', 'exception_detection', 'customer_communication'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['customer_escalations'],
          },
          integrations: ['TMS', 'Carrier Systems', 'Customer Portals'],
        },
      ],
      pricing: {
        phase0: { min: 50000, max: 100000 },
        phase1: { min: 75000, max: 140000 },
        platformMonthly: 3000,
        notes: 'Pricing scales with fleet size and shipment volume',
      },
    };
  }

  private static generateMedia(): VerticalConfig {
    return {
      industry: 'media',
      displayName: 'Media & Entertainment',
      description: 'AI governance for content creation and distribution',
      riskTiers: {
        tier0: ['content_cataloging', 'metadata_management'],
        tier1: ['content_recommendations', 'audience_analysis'],
        tier2: ['content_moderation', 'automated_editing'],
        tier3: ['content_creation', 'rights_management'],
        tier4: ['content_approval', 'distribution_decisions'],
      },
      complianceFrameworks: ['Copyright', 'FCC Regulations', 'Content Standards', 'Rights Management'],
      agents: [
        {
          name: 'Content Moderation Monitor',
          role: 'Automated content screening and policy enforcement',
          capabilities: ['content_screening', 'policy_enforcement', 'flagging'],
          governance: {
            tier: 'tier2',
            requiresApproval: ['content_removal'],
          },
          integrations: ['CMS', 'Moderation Tools', 'Analytics'],
        },
        {
          name: 'Recommendation Engine Advisor',
          role: 'Personalized content recommendations',
          capabilities: ['recommendation_generation', 'audience_analysis', 'engagement_prediction'],
          governance: {
            tier: 'tier1',
            requiresApproval: ['algorithm_changes'],
          },
          integrations: ['Content Platform', 'Analytics', 'User Data'],
        },
        {
          name: 'Rights Management Assistant',
          role: 'Content rights tracking and clearance',
          capabilities: ['rights_tracking', 'clearance_checking', 'usage_monitoring'],
          governance: {
            tier: 'tier3',
            requiresApproval: ['rights_acquisitions'],
          },
          integrations: ['Rights Management', 'Contract Systems', 'DAM'],
        },
      ],
      pricing: {
        phase0: { min: 45000, max: 85000 },
        phase1: { min: 65000, max: 120000 },
        platformMonthly: 2500,
        notes: 'Pricing varies by content volume and distribution scale',
      },
    };
  }
}
