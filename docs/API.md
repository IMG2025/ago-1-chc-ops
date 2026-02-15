# CoreIdentity API Reference

## MCP Server API

### Tool: shared.artifact_registry.read

**Description:** Read all artifacts from shared registry

**Arguments:**
```typescript
{
  tenant: 'shared' | 'chc' | 'ciag' | 'hospitality' // required
}
```

**Returns:**
```typescript
{
  artifacts: Array<{
    id: string;
    content: string;
    metadata: object;
  }>
}
```

### Tool: shared.artifact_registry.readById

**Description:** Read specific artifact by ID

**Arguments:**
```typescript
{
  tenant: string; // required
  artifactId: string; // required
}
```

## Sentinel API

### KillSwitchEnforcer.suspendAgent()

**Description:** Suspend a specific agent

**Arguments:**
```typescript
{
  agentId: string;
  reason: string;
  suspendedBy: string;
}
```

**Returns:**
```typescript
{
  success: boolean;
  message: string;
  state: KillSwitchState;
}
```

### SentinelAuditLogger.logAuthorization()

**Description:** Log authorization decision

**Arguments:**
```typescript
{
  agentId: string;
  domainName: string;
  taskType: string;
  scopes: string[];
  decision: 'allowed' | 'denied';
  reason?: string;
}
```

## Nexus API

### AgentRegistry.create()

**Description:** Create new agent identity

**Arguments:**
```typescript
{
  agentClass: 'Observer' | 'Advisor' | 'Executor' | 'Coordinator' | 'Auditor';
  domainName: string;
  createdBy: string;
}
```

**Returns:**
```typescript
{
  agentId: string;
  agentClass: string;
  domainName: string;
  state: 'created';
  capabilities: [];
}
```

### TelemetryCollector.record()

**Description:** Record execution metrics

**Arguments:**
```typescript
{
  agentId: string;
  domainName: string;
  taskType: string;
  startTime: string;
  endTime: string;
  success: boolean;
  tokensUsed: number;
}
```

### BillingCalculator.generateInvoice()

**Description:** Generate customer invoice

**Arguments:**
```typescript
{
  customerId: string;
  periodStart: string;
  periodEnd: string;
  taxRate?: number;
}
```

**Returns:**
```typescript
{
  invoiceId: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}
```
