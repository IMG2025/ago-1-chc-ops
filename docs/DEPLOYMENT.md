# CoreIdentity Deployment Guide

## Prerequisites

- Node.js 18+
- npm 9+
- TypeScript 5+

## Installation

```bash
# Clone repository
git clone <repo-url>
cd ago-1-chc-ops

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

## Configuration

### Environment Variables

```bash
# MCP Server
MCP_PORT=3000
MCP_HOST=localhost

# Database (production)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Model API Keys
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...

# Monitoring
SENTRY_DSN=https://...
```

### Domain Configuration

Edit `domains/` to configure available domains:
- chc
- ciag
- hospitality

## Running Services

### MCP Server

```bash
npm run mcp:shared
```

### Integration Tests

```bash
npm test
```

## Production Deployment

### 1. Build for Production

```bash
npm run build
```

### 2. Deploy to Infrastructure

```bash
# Example: Deploy to Kubernetes
kubectl apply -f deployment/k8s/
```

### 3. Health Checks

```bash
# Check MCP server
curl http://localhost:3000/health

# Check metrics
curl http://localhost:3000/metrics
```

## Monitoring

### Key Metrics to Track

- Agent execution count
- Authorization success/failure rate
- Kill switch activations
- Anomaly detections
- Cost per customer
- System latency

### Alerts to Configure

- High anomaly rate (> 5% of executions)
- Kill switch activations
- Authorization failure spike
- High cost per customer (> budget)
- System errors

## Backup & Recovery

### Data to Backup

- Agent identities (registry)
- Audit trail (immutable logs)
- Kill switch states
- Customer billing data

### Recovery Procedures

1. Restore database from backup
2. Verify audit trail integrity
3. Reconcile kill switch states
4. Resume operations

## Scaling

### Horizontal Scaling

- Load balance MCP servers
- Shard by domain (chc, ciag, hospitality)
- Replicate read-only data

### Vertical Scaling

- Increase memory for telemetry storage
- Increase CPU for analytics
- Increase disk for audit logs

## Security Hardening

### Production Checklist

- [ ] Enable HTTPS/TLS
- [ ] Rotate API keys regularly
- [ ] Encrypt data at rest
- [ ] Encrypt data in transit
- [ ] Enable audit logging
- [ ] Configure kill switches
- [ ] Set up anomaly alerts
- [ ] Review RBAC permissions
- [ ] Penetration testing
- [ ] Compliance review
