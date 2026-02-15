### Repository Structure

```
.
./scripts
./scripts/_attic
./scripts/_archive
./src
./src/contracts
./src/diagnostics
./node_modules
./dist
./docs
./packages
./packages/sentinel-core
./packages/nexus-core
./domains
./schemas
./data
./services
./services/mcp-shared-server
./artifacts
```

### Package Information

- **Name:** `ago-1-chc-ops`
- **Version:** `0.1.0`

### Available Scripts

```json
{
  "build": "tsc -p tsconfig.json",
  "start": "node dist/index.js",
  "test": "./scripts/audit_no_deep_imports_sentinel_core.sh && ./scripts/audit_sentinel_core_frozen_surface.sh && ./scripts/audit_nexus_core_frozen_surface.sh && ./scripts/audit_sentinel_nexus_handshake_frozen_surface.sh && ./scripts/audit_no_deep_imports_nexus_core.sh && npm run build && ./scripts/smoke_authorize.sh && ./scripts/smoke_authorize_hospitality.sh && ./scripts/smoke_authorize_chc.sh && ./scripts/smoke_list_domains.sh && ./scripts/audit_smoke_list_domains_contract_v1.sh && ./scripts/audit_mount_canonical_specs.sh && ./scripts/audit_domain_executor_alignment_v1.sh && ./scripts/audit_domain_spec_schema_v1.sh && ./scripts/audit_executor_spec_schema_v1.sh && ./scripts/audit_executor_action_scopes_canonical_v1.sh && ./scripts/audit_mount_contract_v1.sh && ./scripts/audit_executor_surface_lock_v1.sh && ./scripts/audit_registry_contract_v1.sh && ./scripts/smoke_action_scope_subset_gate.sh && ./scripts/smoke_cross_domain_scope_spoofing.sh && ./scripts/audit_authorization_contract_v1.sh && ./scripts/audit_cli_contract_v1.sh",
  "mcp:shared": "node services/mcp-shared-server/server.mjs",
  "mcp:smoke": "node scripts/mcp_smoke_phase3.mjs",
  "mcp:smoke6": "node scripts/mcp_smoke_phase6.mjs",
  "mcp:smoke11": "node scripts/mcp_smoke_phase11.mjs",
  "mcp:smoke14": "node scripts/mcp_smoke_phase14.mjs",
  "mcp:smoke16": "node scripts/mcp_smoke_phase16.mjs",
  "mcp:smoke17": "node scripts/mcp_smoke_phase17.mjs",
  "mcp:smoke19": "node scripts/mcp_smoke_phase19.mjs",
  "mcp:smoke20": "node scripts/mcp_smoke_phase20.mjs",
  "mcp:smoke21": "node scripts/mcp_smoke_phase21.mjs",
  "mcp:smoke21b": "node scripts/mcp_smoke_phase21b.mjs",
  "mcp:smoke21c": "node scripts/mcp_smoke_phase21c.mjs"
}
```

### Dependency Installation

```
✓ Dependencies installed successfully
```

### Build Status

```
✗ Build failed
```

**Compiled Outputs:** 21 files in `dist/`

```
dist/registry.js
dist/index.js
dist/plugin.js
dist/executor.js
dist/contracts/plugin.js
dist/contracts/index.js
dist/contracts/executor.js
dist/contracts/registry.js
dist/executors.js
dist/diagnostics/listDomains.js
dist/authorize.js
dist/errors.js
dist/mcp/envelopes.js
dist/mcp/policy.js
dist/mcp/gateway.js
dist/mcp/index.js
dist/mcp/transports/httpTransport.js
dist/mcp/transports/index.js
dist/mcp/client.js
dist/mcp/phase3_compile_proof.js
```

### Test Execution

```
✗ Tests failed
```

**Test Files Found:** 0

**Automation Scripts:** 283 files in `scripts/`

**Source Files:** 13 files in `src/`


### Overall Status

**❌ REPOSITORY NEEDS ATTENTION**

- Build: ❌ Failed
- Review build errors above


---


## Repository: ago-1-core

**Path:** `/data/data/com.termux/files/home/work/ago-1-core`

