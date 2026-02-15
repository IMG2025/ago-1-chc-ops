/**
 * Subscription & Billing System
 * Stripe integration and usage tracking
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  maxAgents: number;
  maxExecutionsPerMonth: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 500,
    maxAgents: 5,
    maxExecutionsPerMonth: 10000,
    features: [
      '5 AI agents',
      '10,000 executions/month',
      'Basic governance controls',
      'Email support',
      'Standard SLA'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 1500,
    maxAgents: 20,
    maxExecutionsPerMonth: 50000,
    features: [
      '20 AI agents',
      '50,000 executions/month',
      'Advanced governance',
      'Anomaly detection',
      'Priority support',
      '99.5% SLA'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 5000,
    maxAgents: -1, // unlimited
    maxExecutionsPerMonth: -1, // unlimited
    features: [
      'Unlimited agents',
      'Unlimited executions',
      'Custom policies',
      'SOC2/HIPAA compliance',
      'Dedicated support',
      '99.9% SLA',
      'Custom integrations'
    ]
  }
];

export class BillingManager {
  static calculateUsage(customerId: string, periodStart: Date, periodEnd: Date): {
    executions: number;
    cost: number;
    overageCharges: number;
  } {
    // In production: query database for actual usage
    // Mock calculation for demonstration
    const executions = Math.floor(Math.random() * 50000);
    const tokensUsed = executions * 1000; // avg 1000 tokens per execution
    const baseCost = (tokensUsed / 1000) * 0.003; // $0.003 per 1K tokens
    
    return {
      executions,
      cost: baseCost,
      overageCharges: 0 // calculated if exceeds plan limit
    };
  }

  static async createStripeCustomer(customerId: string, email: string): Promise<string> {
    // In production: call Stripe API
    // const customer = await stripe.customers.create({ email, metadata: { customerId } });
    // return customer.id;
    return `cus_mock_${customerId}`;
  }

  static async createSubscription(
    customerId: string,
    planId: string
  ): Promise<{ subscriptionId: string; clientSecret: string }> {
    // In production: call Stripe API
    // const subscription = await stripe.subscriptions.create({
    //   customer: stripeCustomerId,
    //   items: [{ price: stripePriceId }]
    // });
    return {
      subscriptionId: `sub_mock_${customerId}`,
      clientSecret: 'pi_mock_secret'
    };
  }

  static generateInvoice(customerId: string, usage: any, plan: SubscriptionPlan): {
    lineItems: Array<{ description: string; amount: number }>;
    subtotal: number;
    tax: number;
    total: number;
  } {
    const lineItems = [
      {
        description: `${plan.name} Plan - Monthly Subscription`,
        amount: plan.monthlyPrice
      },
      {
        description: `Usage - ${usage.executions.toLocaleString()} executions`,
        amount: usage.cost
      }
    ];

    if (usage.overageCharges > 0) {
      lineItems.push({
        description: 'Overage charges',
        amount: usage.overageCharges
      });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;

    return { lineItems, subtotal, tax, total };
  }
}
