#!/bin/bash
# Domain Configuration Script
# Set up a new domain with policies

DOMAIN_NAME=$1
INDUSTRY=$2

if [ -z "$DOMAIN_NAME" ]; then
  echo "Usage: configure-domain.sh <domain-name> [industry]"
  echo "Example: configure-domain.sh hospitality hospitality"
  exit 1
fi

echo "Configuring domain: $DOMAIN_NAME"

# Create domain directory
mkdir -p domains/$DOMAIN_NAME

# Create domain spec
cat > domains/$DOMAIN_NAME/spec.json << EOF_SPEC
{
  "domainName": "$DOMAIN_NAME",
  "industry": "${INDUSTRY:-general}",
  "riskTiers": {
    "tier0": ["read", "query", "retrieve"],
    "tier1": ["analyze", "recommend", "draft"],
    "tier2": ["execute", "modify", "create"],
    "tier3": ["approve", "finalize", "commit"],
    "tier4": ["regulated", "irreversible", "critical"]
  },
  "allowedAgentClasses": ["Observer", "Advisor", "Executor", "Coordinator", "Auditor"],
  "requiresHumanApproval": ["tier3", "tier4"],
  "auditEnabled": true,
  "anomalyDetectionEnabled": true
}
EOF_SPEC

# Create policy template
cat > domains/$DOMAIN_NAME/policies.json << EOF_POLICY
{
  "version": "1.0.0",
  "policies": [
    {
      "policyId": "${DOMAIN_NAME}-baseline",
      "description": "Baseline governance for $DOMAIN_NAME domain",
      "rules": [
        {
          "ruleId": "auth-required",
          "condition": "always",
          "action": "require-authorization",
          "failMode": "deny"
        },
        {
          "ruleId": "audit-all",
          "condition": "always",
          "action": "log-to-audit",
          "failMode": "deny"
        },
        {
          "ruleId": "tier2-gate",
          "condition": "taskType >= tier2",
          "action": "require-elevated-scope",
          "failMode": "deny"
        }
      ]
    }
  ]
}
EOF_POLICY

echo "✅ Domain $DOMAIN_NAME configured"
echo "Created: domains/$DOMAIN_NAME/spec.json"
echo "Created: domains/$DOMAIN_NAME/policies.json"
