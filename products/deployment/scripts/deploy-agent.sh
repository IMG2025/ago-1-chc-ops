#!/bin/bash
# Agent Deployment Script
# Deploy a new AI agent with governance

AGENT_CLASS=$1
DOMAIN=$2
CAPABILITIES=$3

if [ -z "$AGENT_CLASS" ] || [ -z "$DOMAIN" ]; then
  echo "Usage: deploy-agent.sh <agent-class> <domain> <capabilities>"
  echo "Example: deploy-agent.sh Executor hospitality 'hospitality:analyze,hospitality:execute'"
  exit 1
fi

echo "Deploying $AGENT_CLASS agent to $DOMAIN domain..."

# Create agent identity
AGENT_ID=$(node -e "
  const { AgentRegistry } = require('../../packages/nexus-core/dist/lifecycle/registry.js');
  const identity = AgentRegistry.create({
    agentClass: '$AGENT_CLASS',
    domainName: '$DOMAIN',
    createdBy: 'deployment-script'
  });
  console.log(identity.agentId);
")

echo "Agent created: $AGENT_ID"

# Grant capabilities
if [ -n "$CAPABILITIES" ]; then
  IFS=',' read -ra CAPS <<< "$CAPABILITIES"
  for cap in "${CAPS[@]}"; do
    echo "Granting capability: $cap"
    node -e "
      const { AgentRegistry } = require('../../packages/nexus-core/dist/lifecycle/registry.js');
      AgentRegistry.grantCapability('$AGENT_ID', '$cap');
    "
  done
fi

# Update to authorized state
node -e "
  const { AgentRegistry } = require('../../packages/nexus-core/dist/lifecycle/registry.js');
  AgentRegistry.updateState('$AGENT_ID', 'authorized');
"

echo "✅ Agent $AGENT_ID deployed and authorized"
echo "Agent Class: $AGENT_CLASS"
echo "Domain: $DOMAIN"
echo "Capabilities: $CAPABILITIES"
