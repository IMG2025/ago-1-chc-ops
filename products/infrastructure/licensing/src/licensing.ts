/**
 * Enterprise Licensing System
 * License management for infrastructure customers
 */

export interface EnterpriseLicense {
  licenseId: string;
  customerId: string;
  customerName: string;
  licenseType: 'per-seat' | 'per-agent' | 'unlimited';
  seats?: number;
  agents?: number;
  validFrom: string;
  validUntil: string;
  features: string[];
  contractValue: number;
  status: 'active' | 'suspended' | 'expired';
}

export class LicensingManager {
  static validateLicense(licenseKey: string): {
    valid: boolean;
    license?: EnterpriseLicense;
    error?: string;
  } {
    // In production: query license database
    // For now, mock validation
    
    if (!licenseKey || licenseKey.length < 32) {
      return { valid: false, error: 'Invalid license key format' };
    }

    const mockLicense: EnterpriseLicense = {
      licenseId: 'lic_enterprise_001',
      customerId: 'cust_enterprise_001',
      customerName: 'Enterprise Corp',
      licenseType: 'unlimited',
      validFrom: '2026-01-01',
      validUntil: '2027-01-01',
      features: [
        'unlimited-agents',
        'unlimited-executions',
        'white-label',
        'soc2-compliance',
        'custom-integrations',
        'dedicated-support',
        '99.9-sla'
      ],
      contractValue: 500000,
      status: 'active'
    };

    return { valid: true, license: mockLicense };
  }

  static checkFeatureAccess(license: EnterpriseLicense, feature: string): boolean {
    return license.features.includes(feature);
  }

  static generateLicense(params: {
    customerId: string;
    customerName: string;
    licenseType: 'per-seat' | 'per-agent' | 'unlimited';
    seats?: number;
    agents?: number;
    durationMonths: number;
    features: string[];
    contractValue: number;
  }): EnterpriseLicense {
    const licenseId = `lic_${params.customerId}_${Date.now()}`;
    const validFrom = new Date().toISOString();
    const validUntil = new Date(
      Date.now() + params.durationMonths * 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    return {
      licenseId,
      customerId: params.customerId,
      customerName: params.customerName,
      licenseType: params.licenseType,
      seats: params.seats,
      agents: params.agents,
      validFrom,
      validUntil,
      features: params.features,
      contractValue: params.contractValue,
      status: 'active'
    };
  }

  static calculateLicenseRevenue(licenses: EnterpriseLicense[]): {
    totalARR: number;
    averageContractValue: number;
    licensesByType: Record<string, number>;
  } {
    const totalARR = licenses.reduce((sum, lic) => sum + lic.contractValue, 0);
    const averageContractValue = totalARR / licenses.length;
    
    const licensesByType: Record<string, number> = {};
    for (const license of licenses) {
      licensesByType[license.licenseType] = (licensesByType[license.licenseType] || 0) + 1;
    }

    return {
      totalARR,
      averageContractValue,
      licensesByType
    };
  }
}
