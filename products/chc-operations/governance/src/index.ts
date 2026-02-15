export interface Subsidiary {
  subsidiaryId: string;
  legalName: string;
  entityType: 'LLC' | 'Corporation';
  jurisdiction: string;
  ownership: number;
  status: 'active' | 'formation';
}

export const CHC_SUBSIDIARIES = {
  COREIDENTITY: { legalName: 'CoreIdentity, LLC', entityType: 'LLC', jurisdiction: 'Virginia', ownership: 100 },
  IMG: { legalName: 'Impulse Media Group, LLC', entityType: 'LLC', jurisdiction: 'Virginia', ownership: 100 },
  CIAG: { legalName: 'CoreIdentity Advisory Group, LLC', entityType: 'LLC', jurisdiction: 'Virginia', ownership: 100 }
};
