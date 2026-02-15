# CoreIdentity Architecture Documentation

## System Overview

CoreIdentity is a production-ready governance and orchestration platform for autonomous agents, consisting of three core components:

### 1. MCP Server (Multi-tenant Communication Protocol)
**Status: 100% Complete**

The MCP Server provides the communication layer for all agent interactions.

**Components:**
- **Error Canon** - 24 standardized error codes across 5 categories
- **Args Validation** - Schema validation for all 12 tools
- **RBAC** - Role-based access control with scope hierarchy
- **Audit Logging** - Complete execution audit trail

### 2. Sentinel Core (Governance Layer)
**Status: ~95% Complete**

Sentinel provides governance, security, and compliance enforcement.

**Components:**
- **Authorization System** - Multi-domain authorization (chc, ciag, hospitality)
- **Kill Switches** - 3-level emergency control (agent, domain, global)
- **Audit Trail** - Immutable logging of all governance decisions
- **Anomaly Detection** - Behavioral monitoring (frequency, domain, scope)

**Security Features:**
- Cross-domain spoofing prevention
- Scope validation and enforcement
- Fail-closed authorization
- Auto-suspension on anomalies

### 3. Nexus Core (Orchestration Layer)
**Status: ~95% Complete**

Nexus manages agent lifecycle, execution, and resource tracking.

**Components:**
- **Agent Runtime** - Execution contexts, memory segmentation, model abstraction
- **Lifecycle Management** - Create/authorize/operate/suspend/retire workflow
- **Performance Telemetry** - Execution metrics, cost tracking, analytics
- **Economic Accounting** - Cost ledger, customer billing, invoice generation

## Data Flow

```
User Request
    ↓
MCP Server (args validation, RBAC)
    ↓
Sentinel (authorization, kill switch check)
    ↓
Nexus (execution context, memory, model)
    ↓
Agent Execution
    ↓
Telemetry (metrics, cost tracking)
    ↓
Audit Trail (complete history)
```

## Agent Lifecycle

```
1. CREATE
   - Identity issued (unique ID)
   - Class assigned (Observer/Advisor/Executor/Coordinator/Auditor)
   - Zero capabilities granted
   - State: created

2. AUTHORIZE
   - Capabilities granted explicitly
   - Authorization rules bound
   - State: authorized

3. OPERATE
   - Inline governance enforcement
   - Behavioral monitoring
   - Resource tracking
   - State: operating

4. SUSPEND (optional)
   - Automatic (anomaly detected) or manual
   - Kill switch activated
   - State: suspended

5. RETIRE
   - Identity archived
   - Audit trail preserved
   - Resources cleaned up
   - State: retired
```

## Multi-Tenancy

Isolation at all levels:
- **Domain isolation** - chc, ciag, hospitality cannot cross-contaminate
- **Execution isolation** - Per-agent execution contexts
- **Memory isolation** - Per-agent memory segments
- **Billing isolation** - Per-customer cost tracking

## Scalability

**Current Design:**
- In-memory storage (development)
- Single-node execution

**Production Path:**
- Persistent storage (PostgreSQL, Redis)
- Distributed execution (Kubernetes)
- Multi-region deployment
- Auto-scaling

## Security Model

**Defense in Depth:**
1. MCP RBAC (scope validation)
2. Sentinel Authorization (policy enforcement)
3. Kill Switches (emergency control)
4. Anomaly Detection (behavioral monitoring)
5. Audit Trail (complete forensics)

**Fail-Closed:**
- Authorization denies by default
- Kill switches block on activation
- Anomalies trigger auto-suspension

## Monitoring & Observability

**Metrics:**
- Execution count, duration, success rate
- Token usage, cost per agent/domain/customer
- Anomaly count, severity distribution
- Kill switch activations

**Audit Trail:**
- Every authorization decision
- Every execution
- Every kill switch action
- Complete forensic replay capability

## Cost Model

**Token-Based Pricing:**
- $0.003 per 1K tokens (Claude Sonnet baseline)
- Real-time cost calculation
- Per-agent, per-domain, per-customer tracking
- Automated invoice generation

## Compliance

**Audit Requirements:**
- Immutable audit log (append-only)
- Complete decision trail (who, what, when, why)
- Forensic replay capability
- Export for regulatory review

**Data Retention:**
- Active agents: Real-time monitoring
- Retired agents: Archived with audit trail
- Metrics: Configurable retention
- Audit logs: Long-term retention (regulatory requirement)
