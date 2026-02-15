/**
 * Billing Calculator
 * Generates customer invoices
 */

import { CustomerAccount, Invoice, InvoiceLineItem } from './types.js';
import { AccountingLedger } from './ledger.js';
import { randomUUID } from 'crypto';

export class BillingCalculator {
  static calculateCustomerAccount(
    customerId: string,
    periodStart: string,
    periodEnd: string
  ): CustomerAccount {
    const events = AccountingLedger.getEvents({
      customerId,
      startTime: periodStart,
      endTime: periodEnd,
    });
    
    const totalCost = events.reduce((sum, e) => sum + e.cost, 0);
    const totalTokens = events.reduce((sum, e) => sum + e.tokensUsed, 0);
    
    return {
      customerId,
      customerName: `Customer ${customerId}`, // In production, fetch from customer DB
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      totalCost,
      totalTokens,
      totalExecutions: events.length,
    };
  }
  
  static generateInvoice(
    customerId: string,
    periodStart: string,
    periodEnd: string,
    taxRate: number = 0
  ): Invoice {
    const account = this.calculateCustomerAccount(customerId, periodStart, periodEnd);
    
    // Group by domain for line items
    const events = AccountingLedger.getEvents({
      customerId,
      startTime: periodStart,
      endTime: periodEnd,
    });
    
    const byDomain = new Map<string, { tokens: number; cost: number; count: number }>();
    for (const event of events) {
      const current = byDomain.get(event.domainName) || { tokens: 0, cost: 0, count: 0 };
      current.tokens += event.tokensUsed;
      current.cost += event.cost;
      current.count += 1;
      byDomain.set(event.domainName, current);
    }
    
    const lineItems: InvoiceLineItem[] = [];
    for (const [domain, data] of byDomain.entries()) {
      lineItems.push({
        description: `${domain} domain - ${data.count} executions (${data.tokens.toLocaleString()} tokens)`,
        quantity: data.count,
        unitPrice: data.cost / data.count,
        amount: data.cost,
      });
    }
    
    const subtotal = account.totalCost;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    const invoice: Invoice = {
      invoiceId: `INV-${randomUUID()}`,
      customerId,
      periodStart,
      periodEnd,
      lineItems,
      subtotal,
      tax,
      total,
      generatedAt: new Date().toISOString(),
    };
    
    console.log(
      `[BILLING] Generated invoice ${invoice.invoiceId} for ` +
      `customer ${customerId}: $${total.toFixed(2)}`
    );
    
    return invoice;
  }
  
  static formatInvoice(invoice: Invoice): string {
    const lines: string[] = [];
    lines.push(`Invoice: ${invoice.invoiceId}`);
    lines.push(`Customer: ${invoice.customerId}`);
    lines.push(`Period: ${invoice.periodStart} to ${invoice.periodEnd}`);
    lines.push('');
    lines.push('Line Items:');
    for (const item of invoice.lineItems) {
      lines.push(`  ${item.description}: $${item.amount.toFixed(2)}`);
    }
    lines.push('');
    lines.push(`Subtotal: $${invoice.subtotal.toFixed(2)}`);
    lines.push(`Tax: $${invoice.tax.toFixed(2)}`);
    lines.push(`Total: $${invoice.total.toFixed(2)}`);
    
    return lines.join('\n');
  }
}
