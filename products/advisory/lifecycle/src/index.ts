export interface Client {
  clientId: string;
  companyName: string;
  stage: 'prospect' | 'qualified' | 'active';
}
