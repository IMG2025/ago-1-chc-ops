export interface IPAsset {
  assetId: string;
  name: string;
  type: 'agent' | 'framework' | 'algorithm';
  owner: 'CHC' | 'CoreIdentity IP Holdings';
  protectionStatus: 'trade_secret' | 'patent_pending' | 'patented';
}

export const REVENUE_MODELS = {
  PLATFORM_SAAS: { projectedAnnualRevenue: 50000000, margin: 75 },
  AGENT_LICENSING: { projectedAnnualRevenue: 25000000, margin: 90 }
};
