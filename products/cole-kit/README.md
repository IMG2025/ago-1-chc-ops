# Cole Hospitality Deployment Kit

Complete deployment package for Cole Hospitality pilot.

## Quick Start

```bash
# Deploy complete governance stack
cd ~/work/ago-1-chc-ops
./products/deployment/scripts/quick-deploy.sh

# Start monitoring dashboard
cd products/dashboard
npx serve src
# Visit http://localhost:3000
```

## What Gets Deployed

1. **Hospitality Domain**
   - Risk tier definitions
   - Policy framework
   - Agent authorization rules

2. **Three Agents**
   - Observer (read-only monitoring)
   - Advisor (recommendations)
   - Executor (operational actions)

3. **Governance Controls**
   - Authorization system (all requests validated)
   - Kill switches (3-level emergency control)
   - Audit trail (complete decision history)
   - Anomaly detection (behavioral monitoring)

## Testing the Deployment

```bash
# Check agent status
node -e "
  const { AgentRegistry } = require('./packages/nexus-core/dist/lifecycle/registry.js');
  const agents = AgentRegistry.getAll({ domainName: 'hospitality' });
  console.log('Active agents:', agents.length);
  agents.forEach(a => console.log(\`  - \${a.agentId} (\${a.agentClass})\`));
"

# View domain configuration
cat domains/hospitality/spec.json

# Check audit trail
node -e "
  const { SentinelAuditLogger } = require('./packages/sentinel-core/dist/audit/logger.js');
  SentinelAuditLogger.query({ domainName: 'hospitality', limit: 10 })
    .then(events => console.log(\`Audit events: \${events.length}\`));
"
```

## Monitoring

Access real-time dashboard:
- Agent activity
- Execution metrics
- Anomaly alerts
- Cost tracking

## Support

For issues or questions:
- Email: support@coreidentity.ai
- Slack: #cole-pilot
