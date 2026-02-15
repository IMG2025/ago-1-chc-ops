#!/bin/bash
# Quick Deployment Script for Cole Hospitality
# Deploys complete governance stack in one command

echo "========================================="
echo "COLE HOSPITALITY QUICK DEPLOY"
echo "========================================="
echo ""

# Configure hospitality domain
echo "Step 1: Configuring hospitality domain..."
./products/deployment/scripts/configure-domain.sh hospitality hospitality

# Deploy Observer agent (read-only monitoring)
echo ""
echo "Step 2: Deploying Observer agent..."
./products/deployment/scripts/deploy-agent.sh Observer hospitality "hospitality:read,hospitality:query"

# Deploy Advisor agent (recommendations)
echo ""
echo "Step 3: Deploying Advisor agent..."
./products/deployment/scripts/deploy-agent.sh Advisor hospitality "hospitality:read,hospitality:analyze,hospitality:recommend"

# Deploy Executor agent (operational actions)
echo ""
echo "Step 4: Deploying Executor agent..."
./products/deployment/scripts/deploy-agent.sh Executor hospitality "hospitality:read,hospitality:analyze,hospitality:execute"

echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "Deployed:"
echo "  • Hospitality domain configuration"
echo "  • 1 Observer agent (monitoring)"
echo "  • 1 Advisor agent (recommendations)"
echo "  • 1 Executor agent (operations)"
echo ""
echo "Next steps:"
echo "  1. Review: cat domains/hospitality/spec.json"
echo "  2. Monitor: Access monitoring dashboard"
echo "  3. Test: Run sample tasks"
