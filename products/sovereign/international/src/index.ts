/**
 * International AI Cooperation Framework
 */
export interface InternationalPartner {
  countryCode: string;
  countryName: string;
  partnershipType: 'ally' | 'treaty' | 'cooperation';
  sharedStandards: boolean;
  dataShareEnabled: boolean;
  crisisResponseProtocol: boolean;
}

export interface CrossBorderIncident {
  incidentId: string;
  reportingCountry: string;
  affectedCountries: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  status: 'reported' | 'investigating' | 'resolved';
}

export class InternationalCooperation {
  private partners: Map<string, InternationalPartner> = new Map();
  private incidents: CrossBorderIncident[] = [];

  registerPartner(partner: InternationalPartner): void {
    this.partners.set(partner.countryCode, partner);
    console.log(`[INTL] Partner registered: ${partner.countryName}`);
  }

  reportIncident(incident: Omit<CrossBorderIncident, 'incidentId' | 'timestamp' | 'status'>): CrossBorderIncident {
    const reported: CrossBorderIncident = {
      ...incident,
      incidentId: `inc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'reported',
    };
    this.incidents.push(reported);
    console.log(`[INTL] Incident reported: ${incident.description}`);
    return reported;
  }

  getAllies(): InternationalPartner[] {
    return Array.from(this.partners.values()).filter(p => p.partnershipType === 'ally');
  }
}
