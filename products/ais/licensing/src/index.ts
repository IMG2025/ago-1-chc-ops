export interface LicenseAgreement {
  licenseId: string;
  licensee: string;
  licenseType: 'perpetual' | 'subscription' | 'revenue_share';
  pricing: any;
  status: 'draft' | 'active';
}

export const LICENSE_TEMPLATES = {
  ENTERPRISE_PERPETUAL: {
    licenseType: 'perpetual',
    pricing: { upfrontFee: 500000, annualMaintenance: 100000 }
  }
};

export class LicensingManager {
  private licenses: Map<string, LicenseAgreement> = new Map();
  
  createLicense(template: keyof typeof LICENSE_TEMPLATES, licensee: string): LicenseAgreement {
    const license: LicenseAgreement = {
      licenseId: `lic_${Date.now()}`,
      licensee,
      licenseType: 'perpetual',
      pricing: LICENSE_TEMPLATES[template].pricing,
      status: 'draft'
    };
    this.licenses.set(license.licenseId, license);
    return license;
  }
}
