/**
 * Cost Accounting Ledger
 * Records all billable events
 */

import { BillingEvent } from './types.js';
import { randomUUID } from 'crypto';

const ledger: BillingEvent[] = [];

export class AccountingLedger {
  static record(params: {
    customerId: string;
    agentId: string;
    domainName: string;
    taskType: string;
    tokensUsed: number;
    cost: number;
  }): BillingEvent {
    const event: BillingEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      customerId: params.customerId,
      agentId: params.agentId,
      domainName: params.domainName,
      taskType: params.taskType,
      tokensUsed: params.tokensUsed,
      cost: params.cost,
    };
    
    ledger.push(event);
    
    console.log(
      `[ACCOUNTING] Customer ${params.customerId} | ` +
      `${params.tokensUsed} tokens | $${params.cost.toFixed(4)}`
    );
    
    return event;
  }
  
  static getEvents(filter: {
    customerId?: string;
    agentId?: string;
    startTime?: string;
    endTime?: string;
  }): BillingEvent[] {
    let results = [...ledger];
    
    if (filter.customerId) {
      results = results.filter(e => e.customerId === filter.customerId);
    }
    
    if (filter.agentId) {
      results = results.filter(e => e.agentId === filter.agentId);
    }
    
    if (filter.startTime) {
      results = results.filter(e => e.timestamp >= filter.startTime!);
    }
    
    if (filter.endTime) {
      results = results.filter(e => e.timestamp <= filter.endTime!);
    }
    
    return results;
  }
  
  static getTotalCost(filter: {
    customerId?: string;
    startTime?: string;
    endTime?: string;
  }): number {
    const events = this.getEvents(filter);
    return events.reduce((sum, e) => sum + e.cost, 0);
  }
}
