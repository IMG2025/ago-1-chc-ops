/**
 * Usage Metering & Billing
 * Track agent usage and generate invoices
 */

export interface UsageRecord {
  customerId: string;
  agentId: string;
  metric: 'subscription' | 'interaction' | 'execution' | 'analysis';
  quantity: number;
  unitPrice: number;
  timestamp: string;
}

export interface AgentSubscription {
  subscriptionId: string;
  customerId: string;
  agentId: string;
  agentName: string;
  monthlyPrice: number;
  startDate: string;
  status: 'active' | 'paused' | 'cancelled';
}

export interface Invoice {
  invoiceId: string;
  customerId: string;
  billingPeriod: { start: string; end: string };
  subscriptions: {
    agentName: string;
    price: number;
  }[];
  usage: {
    agentName: string;
    metric: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
}

export class UsageMeteringSystem {
  private usageRecords: UsageRecord[] = [];
  private subscriptions: AgentSubscription[] = [];

  recordUsage(record: UsageRecord): void {
    this.usageRecords.push({
      ...record,
      timestamp: new Date().toISOString(),
    });
  }

  addSubscription(subscription: Omit<AgentSubscription, 'subscriptionId' | 'startDate' | 'status'>): AgentSubscription {
    const sub: AgentSubscription = {
      ...subscription,
      subscriptionId: `sub_${Date.now()}`,
      startDate: new Date().toISOString(),
      status: 'active',
    };
    this.subscriptions.push(sub);
    return sub;
  }

  generateInvoice(customerId: string, periodStart: Date, periodEnd: Date): Invoice {
    // Get subscriptions
    const customerSubs = this.subscriptions.filter(
      s => s.customerId === customerId && s.status === 'active'
    );

    // Get usage records
    const customerUsage = this.usageRecords.filter(
      r => r.customerId === customerId &&
           new Date(r.timestamp) >= periodStart &&
           new Date(r.timestamp) <= periodEnd
    );

    // Calculate subscription charges
    const subscriptionCharges = customerSubs.map(sub => ({
      agentName: sub.agentName,
      price: sub.monthlyPrice,
    }));

    // Aggregate usage charges
    const usageByAgent = new Map<string, { quantity: number; unitPrice: number }>();
    for (const usage of customerUsage) {
      const key = `${usage.agentId}_${usage.metric}`;
      const existing = usageByAgent.get(key) || { quantity: 0, unitPrice: usage.unitPrice };
      existing.quantity += usage.quantity;
      usageByAgent.set(key, existing);
    }

    const usageCharges = Array.from(usageByAgent.entries()).map(([key, data]) => ({
      agentName: key.split('_')[0],
      metric: key.split('_')[1],
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      total: data.quantity * data.unitPrice,
    }));

    // Calculate totals
    const subscriptionTotal = subscriptionCharges.reduce((sum, s) => sum + s.price, 0);
    const usageTotal = usageCharges.reduce((sum, u) => sum + u.total, 0);
    const subtotal = subscriptionTotal + usageTotal;
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;

    return {
      invoiceId: `inv_${Date.now()}`,
      customerId,
      billingPeriod: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      subscriptions: subscriptionCharges,
      usage: usageCharges,
      subtotal,
      tax,
      total,
    };
  }

  formatInvoice(invoice: Invoice): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════');
    lines.push('  AI WORKFORCE INVOICE');
    lines.push('═══════════════════════════════════════\n');

    lines.push(`Invoice ID: ${invoice.invoiceId}`);
    lines.push(`Billing Period: ${new Date(invoice.billingPeriod.start).toLocaleDateString()} - ${new Date(invoice.billingPeriod.end).toLocaleDateString()}\n`);

    lines.push('AGENT SUBSCRIPTIONS\n');
    for (const sub of invoice.subscriptions) {
      lines.push(`  ${sub.agentName.padEnd(40)} $${sub.price.toFixed(2)}`);
    }

    if (invoice.usage.length > 0) {
      lines.push('\nUSAGE CHARGES\n');
      for (const usage of invoice.usage) {
        lines.push(`  ${usage.agentName} (${usage.quantity} ${usage.metric}s)`.padEnd(40) + ` $${usage.total.toFixed(2)}`);
      }
    }

    lines.push('\n' + '─'.repeat(45));
    lines.push(`Subtotal:`.padEnd(40) + ` $${invoice.subtotal.toFixed(2)}`);
    lines.push(`Tax (8%):`.padEnd(40) + ` $${invoice.tax.toFixed(2)}`);
    lines.push('═'.repeat(45));
    lines.push(`TOTAL:`.padEnd(40) + ` $${invoice.total.toFixed(2)}`);

    return lines.join('\n');
  }
}
