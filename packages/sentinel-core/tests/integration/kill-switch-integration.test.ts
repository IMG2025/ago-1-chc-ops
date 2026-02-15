/**
 * Kill Switch Integration Test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { KillSwitchEnforcer } from '../../src/killswitch/enforcer.js';
import { KillSwitchRegistry } from '../../src/killswitch/registry.js';
import { SentinelAuditLogger } from '../../src/audit/logger.js';

describe('Kill Switch Integration', () => {
  it('should suspend agent and log to audit', async () => {
    const agentId = 'test-agent-123';
    
    // Suspend agent
    const result = KillSwitchEnforcer.suspendAgent(
      agentId,
      'Test suspension',
      'test-admin'
    );
    
    assert.strictEqual(result.success, true, 'Suspension should succeed');
    assert.ok(result.state, 'Should return kill switch state');
    
    // Verify kill switch is active
    const isActive = KillSwitchRegistry.isActive('agent', agentId);
    assert.strictEqual(isActive, true, 'Kill switch should be active');
    
    // Check agent
    const checkResult = KillSwitchEnforcer.checkAgent(agentId, 'test-domain');
    assert.strictEqual(checkResult.success, false, 'Agent should be blocked');
    assert.ok(checkResult.message?.includes('suspended'), 'Message should mention suspension');
    
    // Resume agent
    const resumeResult = KillSwitchEnforcer.resumeAgent(agentId, 'test-admin');
    assert.strictEqual(resumeResult.success, true, 'Resume should succeed');
    
    // Verify kill switch is inactive
    const isStillActive = KillSwitchRegistry.isActive('agent', agentId);
    assert.strictEqual(isStillActive, false, 'Kill switch should be inactive');
    
    console.log('✅ Kill switch integration test passed');
  });
  
  it('should activate global halt and block all agents', () => {
    // Activate global halt
    const result = KillSwitchEnforcer.activateGlobalHalt(
      'Test global halt',
      'test-admin'
    );
    
    assert.strictEqual(result.success, true, 'Global halt should succeed');
    
    // Check any agent - should be blocked
    const checkResult = KillSwitchEnforcer.checkAgent('any-agent', 'any-domain');
    assert.strictEqual(checkResult.success, false, 'All agents should be blocked');
    assert.ok(checkResult.message?.includes('Global'), 'Message should mention global halt');
    
    // Deactivate
    const deactivateResult = KillSwitchEnforcer.deactivateGlobalHalt('test-admin');
    assert.strictEqual(deactivateResult.success, true, 'Deactivation should succeed');
    
    console.log('✅ Global halt test passed');
  });
});
