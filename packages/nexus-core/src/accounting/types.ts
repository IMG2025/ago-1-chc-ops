/**
 * Economic Accounting Types
 */

export interface BillingEvent {
  eventId: string;
  timestamp: string;
  customerId: string;
  agentId: string;
  domainName: string;
  taskType: string;
  tokensUsed: number;
  cost: number;
}

export interface CustomerAccount {
  customerId: string;
  customerName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalCost: number;
  totalTokens: number;
  totalExecutions: number;
}

export interface Invoice {
  invoiceId: string;
  customerId: string;
  periodStart: string;
  periodEnd: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  generatedAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}
