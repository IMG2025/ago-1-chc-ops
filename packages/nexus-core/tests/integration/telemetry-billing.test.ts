/**
 * Telemetry & Billing Integration Test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { TelemetryCollector } from '../../src/telemetry/collector.js';
import { TelemetryAnalytics } from '../../src/telemetry/analytics.js';
import { AccountingLedger } from '../../src/accounting/ledger.js';
import { BillingCalculator } from '../../src/accounting/billing.js';

describe('Telemetry & Billing Integration', () => {
  it('should track execution and generate invoice', () => {
    const customerId = 'test-customer';
    const agentId = 'test-agent-billing';
    const periodStart = new Date().toISOString();
    
    // Record 5 executions
    for (let i = 0; i < 5; i++) {
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + 100).toISOString();
      
      // Record telemetry
      const metric = TelemetryCollector.record({
        agentId,
        domainName: 'ciag',
        taskType: 'ANALYZE',
        startTime,
        endTime,
        success: true,
        tokensUsed: 1000,
      });
      
      // Record billing
      AccountingLedger.record({
        customerId,
        agentId,
        domainName: 'ciag',
        taskType: 'ANALYZE',
        tokensUsed: 1000,
        cost: metric.cost,
      });
    }
    
    const periodEnd = new Date().toISOString();
    
    // Get agent performance
    const performance = TelemetryAnalytics.getAgentPerformance(agentId);
    assert.strictEqual(performance.totalExecutions, 5, 'Should have 5 executions');
    assert.strictEqual(performance.successRate, 1, 'Success rate should be 100%');
    assert.strictEqual(performance.totalTokens, 5000, 'Should have 5000 total tokens');
    
    // Generate invoice
    const invoice = BillingCalculator.generateInvoice(customerId, periodStart, periodEnd);
    assert.ok(invoice.invoiceId, 'Invoice should have ID');
    assert.strictEqual(invoice.lineItems.length, 1, 'Should have 1 line item (1 domain)');
    assert.strictEqual(invoice.subtotal, performance.totalCost, 'Invoice should match telemetry cost');
    
    console.log('✅ Telemetry & billing integration test passed');
  });
});
