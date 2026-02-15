#!/bin/bash
# Customer Onboarding Script
# Guided setup for new customers

echo "========================================="
echo "CoreIdentity Customer Onboarding"
echo "========================================="
echo ""

# Collect customer info
read -p "Customer name: " CUSTOMER_NAME
read -p "Industry (hospitality/legal/retail/other): " INDUSTRY
read -p "Primary domain name: " DOMAIN_NAME

echo ""
echo "Setting up CoreIdentity for $CUSTOMER_NAME..."
echo ""

# Step 1: Risk assessment
echo "Step 1: Running risk assessment..."
node -e "
  const { RiskAssessment } = require('./products/discovery/dist/risk-assessment.js');
  const questions = RiskAssessment.generateQuestionnaire('$INDUSTRY');
  console.log(\`Generated \${questions.length} assessment questions\`);
"

# Step 2: Domain configuration
echo "Step 2: Configuring domain..."
./products/deployment/scripts/configure-domain.sh $DOMAIN_NAME $INDUSTRY

# Step 3: Initial agent deployment
echo "Step 3: Deploying initial agents..."
./products/deployment/scripts/deploy-agent.sh Observer $DOMAIN_NAME "${DOMAIN_NAME}:read"
./products/deployment/scripts/deploy-agent.sh Advisor $DOMAIN_NAME "${DOMAIN_NAME}:read,${DOMAIN_NAME}:analyze"

echo ""
echo "========================================="
echo "✅ ONBOARDING COMPLETE"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Complete risk assessment questionnaire"
echo "  2. Review generated proposal"
echo "  3. Configure additional agents as needed"
echo "  4. Access monitoring dashboard"
echo ""
echo "Dashboard: products/dashboard/src/index.html"
echo "Documentation: docs/"
