#!/bin/bash
# Deploy Industry-Specific Vertical
# Usage: deploy-vertical.sh <industry>

INDUSTRY=$1

if [ -z "$INDUSTRY" ]; then
  echo "Usage: deploy-vertical.sh <industry>"
  echo ""
  echo "Available industries:"
  echo "  hospitality, healthcare, legal, financial, retail,"
  echo "  manufacturing, government, education, realestate,"
  echo "  energy, transportation, media"
  exit 1
fi

if [ ! -d "products/verticals/$INDUSTRY" ]; then
  echo "❌ Industry '$INDUSTRY' not found"
  exit 1
fi

echo "========================================="
echo "DEPLOYING $INDUSTRY VERTICAL"
echo "========================================="
echo ""

# Configure domain
echo "Step 1: Configuring domain..."
./products/deployment/scripts/configure-domain.sh $INDUSTRY $INDUSTRY

# Deploy industry-specific agents
echo ""
echo "Step 2: Deploying agents..."

case $INDUSTRY in
  hospitality)
    ./products/deployment/scripts/deploy-agent.sh Advisor $INDUSTRY "$INDUSTRY:feedback_analysis,$INDUSTRY:service_recommendations"
    ./products/deployment/scripts/deploy-agent.sh Executor $INDUSTRY "$INDUSTRY:pricing_optimization,$INDUSTRY:upsell_identification"
    ./products/deployment/scripts/deploy-agent.sh Observer $INDUSTRY "$INDUSTRY:request_routing,$INDUSTRY:staff_scheduling"
    ;;
  healthcare)
    ./products/deployment/scripts/deploy-agent.sh Observer $INDUSTRY "$INDUSTRY:chart_review,$INDUSTRY:trend_identification"
    ./products/deployment/scripts/deploy-agent.sh Advisor $INDUSTRY "$INDUSTRY:symptom_analysis,$INDUSTRY:differential_diagnosis"
    ./products/deployment/scripts/deploy-agent.sh Coordinator $INDUSTRY "$INDUSTRY:eligibility_screening,$INDUSTRY:patient_matching"
    ;;
  legal)
    ./products/deployment/scripts/deploy-agent.sh Advisor $INDUSTRY "$INDUSTRY:contract_parsing,$INDUSTRY:risk_flagging"
    ./products/deployment/scripts/deploy-agent.sh Observer $INDUSTRY "$INDUSTRY:case_research,$INDUSTRY:statute_analysis"
    ./products/deployment/scripts/deploy-agent.sh Executor $INDUSTRY "$INDUSTRY:document_categorization,$INDUSTRY:privilege_screening"
    ;;
  *)
    echo "  Deploying standard agent set..."
    ./products/deployment/scripts/deploy-agent.sh Observer $INDUSTRY "$INDUSTRY:read,$INDUSTRY:query"
    ./products/deployment/scripts/deploy-agent.sh Advisor $INDUSTRY "$INDUSTRY:read,$INDUSTRY:analyze,$INDUSTRY:recommend"
    ;;
esac

echo ""
echo "========================================="
echo "✅ VERTICAL DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "Deployed for: $INDUSTRY"
echo "Configuration: products/verticals/$INDUSTRY/"
echo ""
echo "Next steps:"
echo "  1. Review configuration: cat products/verticals/$INDUSTRY/domain-spec.json"
echo "  2. Test agents: Check monitoring dashboard"
echo "  3. Customize policies as needed"
