/**
 * End-to-End Integration Test
 * Tests complete workflow: Create agent → Authorize → Execute → Monitor → Retire
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Sentinel imports
import { KillSwitchEnforcer } from '../../src/killswitch/enforcer.js';
import { SentinelAuditLogger } from '../../src/audit/logger.js';
import { AnomalyMonitor } from '../../src/anomaly/monitor.js';

// Nexus imports
import { AgentRegistry } from '../../../nexus-core/src/lifecycle/registry.js';
import { ContextManager } from '../../../nexus-core/src/runtime/context.js';
import { MemoryManager } from '../../../nexus-core/src/runtime/memory.js';
import { TelemetryCollector } from '../../../nexus-core/src/telemetry/collector.js';
import { AccountingLedger } from '../../../nexus-core/src/accounting/ledger.js';

describe('End-to-End Agent Lifecycle', () => {
  it('should create, execute, monitor, and retire an agent', async () => {
    // Step 1: Create agent identity
    const identity = AgentRegistry.create({
      agentClass: 'Executor',
      domainName: 'ciag',
      createdBy: 'test-user',
    });
    
    assert.ok(identity.agentId, 'Agent ID should be created');
    assert.strictEqual(identity.state, 'created', 'Initial state should be created');
    assert.strictEqual(identity.capabilities.length, 0, 'Should start with zero capabilities');
    
    // Step 2: Create execution context
    const context = ContextManager.create(identity.agentId, 'ciag');
    assert.strictEqual(context.status, 'initializing', 'Context should be initializing');
    
    // Step 3: Grant capabilities
    AgentRegistry.grantCapability(identity.agentId, 'ciag:analyze');
    AgentRegistry.updateState(identity.agentId, 'authorized');
    
    const updatedIdentity = AgentRegistry.get(identity.agentId);
    assert.ok(updatedIdentity, 'Should retrieve agent identity');
    assert.strictEqual(updatedIdentity!.state, 'authorized', 'State should be authorized');
    assert.strictEqual(updatedIdentity!.capabilities.length, 1, 'Should have 1 capability');
    
    // Step 4: Write to memory
    MemoryManager.write(identity.agentId, 'short-term', 'lastTask', { taskType: 'ANALYZE' });
    const memory = MemoryManager.read(identity.agentId, 'short-term', 'lastTask');
    assert.deepStrictEqual(memory, { taskType: 'ANALYZE' }, 'Should read memory correctly');
    
    // Step 5: Update context to operating
    ContextManager.updateStatus(identity.agentId, 'active');
    AgentRegistry.updateState(identity.agentId, 'operating');
    
    // Step 6: Record execution metrics
    const startTime = new Date().toISOString();
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate execution
    const endTime = new Date().toISOString();
    
    TelemetryCollector.record({
      agentId: identity.agentId,
      domainName: 'ciag',
      taskType: 'ANALYZE',
      startTime,
      endTime,
      success: true,
      tokensUsed: 1000,
    });
    
    // Step 7: Record billing event
    AccountingLedger.record({
      customerId: 'customer-test',
      agentId: identity.agentId,
      domainName: 'ciag',
      taskType: 'ANALYZE',
      tokensUsed: 1000,
      cost: 0.003,
    });
    
    // Step 8: Log to audit trail
    await SentinelAuditLogger.logAuthorization({
      agentId: identity.agentId,
      domainName: 'ciag',
      taskType: 'ANALYZE',
      scopes: ['ciag:analyze'],
      decision: 'allowed',
      policiesEvaluated: ['policy-1'],
    });
    
    // Step 9: Monitor for anomalies
    const anomaly = await AnomalyMonitor.monitor({
      agentId: identity.agentId,
      domainName: 'ciag',
      taskType: 'ANALYZE',
      scopes: ['ciag:analyze'],
      authorized: true,
    });
    
    assert.strictEqual(anomaly, null, 'No anomaly should be detected for normal behavior');
    
    // Step 10: Retire agent
    AgentRegistry.retire(identity.agentId, 'test-user', 'Test complete');
    ContextManager.destroy(identity.agentId);
    MemoryManager.clearAll(identity.agentId);
    
    const retiredIdentity = AgentRegistry.get(identity.agentId);
    assert.strictEqual(retiredIdentity!.state, 'retired', 'Agent should be retired');
    assert.ok(retiredIdentity!.retiredAt, 'Should have retirement timestamp');
    
    console.log('✅ End-to-end workflow test passed');
  });
});
