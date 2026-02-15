# Cole Hospitality Deployment Checklist

## Pre-Deployment

- [ ] Confirm deployment window with Cole
- [ ] Backup existing systems
- [ ] Prepare rollback plan
- [ ] Test deployment scripts in staging

## Deployment Steps

- [ ] Run `./products/deployment/scripts/quick-deploy.sh`
- [ ] Verify 3 agents created (Observer, Advisor, Executor)
- [ ] Verify domain configuration in `domains/hospitality/`
- [ ] Test authorization system (run sample tasks)
- [ ] Verify audit trail logging
- [ ] Test kill switches (suspend/resume agent)

## Post-Deployment

- [ ] Start monitoring dashboard
- [ ] Train Cole team on dashboard usage
- [ ] Document any issues encountered
- [ ] Schedule weekly check-ins
- [ ] Monitor for anomalies first 48 hours

## Success Criteria

- [ ] All 3 agents operational
- [ ] Authorization working (denies unauthorized actions)
- [ ] Audit trail capturing all decisions
- [ ] Kill switches functional
- [ ] Dashboard showing real-time data
- [ ] No critical errors in first 24 hours

## Rollback Plan

If issues occur:
1. Activate kill switch: `KillSwitchEnforcer.suspendDomain('hospitality', 'issue detected', 'admin')`
2. Review audit trail for root cause
3. Fix configuration
4. Resume: `KillSwitchEnforcer.resumeDomain('hospitality', 'admin')`
