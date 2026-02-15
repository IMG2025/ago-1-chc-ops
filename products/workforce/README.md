# SmartNation AI Workforce Catalog

Complete marketplace of 100+ pre-built, governance-ready AI agents.

## Quick Start

### Browse Marketplace
```bash
cd products/workforce/marketplace
npx serve src
# Visit http://localhost:3000
```

### Deploy an Agent
```bash
./products/workforce/deployment/deploy-agent-from-catalog.sh customer-service-rep-v1 hospitality
```

### Build Custom Agent
```typescript
import { CoreIdentityAgent } from '@coreidentity/agent-sdk';

class MyCustomAgent extends CoreIdentityAgent {
  constructor() {
    super(metadata, capabilities);
  }
  
  async execute(task) {
    // Your agent logic
  }
}
```

## Agent Categories

- **Customer-Facing** (10 agents): Support, sales, account management
- **Operations** (10 agents): Data entry, scheduling, automation
- **Analysis** (10 agents): BI, financial, market research
- **Content** (10 agents): Writing, social media, video editing
- **HR** (10 agents): Recruiting, onboarding, performance
- **Legal** (10 agents): Contract review, compliance, research
- **Specialized** (50+ agents): Industry-specific agents

## Pricing

- **Base Subscription**: $300-$3,500/month per agent
- **Usage Fees**: $0.01-$10 per unit (varies by agent)
- **Volume Discounts**: Available for 10+ agents

## Revenue Model

Year 1: 1,000 customers × 3 agents × $1,000/mo = $36M ARR
Year 2: 5,000 customers × 4 agents × $1,200/mo = $288M ARR
Year 3: 20,000 customers × 5 agents × $1,500/mo = $1.8B ARR

## Documentation

- Agent SDK: `/sdk/README.md`
- Marketplace: `/marketplace/README.md`
- Billing: `/billing/README.md`
