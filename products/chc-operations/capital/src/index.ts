export interface CapitalAllocation {
  allocationId: string;
  subsidiary: string;
  amount: number;
  purpose: string;
  status: 'proposed' | 'approved';
}

export class CapitalAllocationManager {
  private allocations: Map<string, CapitalAllocation> = new Map();
  
  proposeAllocation(subsidiary: string, amount: number, purpose: string): CapitalAllocation {
    const allocation: CapitalAllocation = {
      allocationId: `cap_${Date.now()}`,
      subsidiary,
      amount,
      purpose,
      status: 'proposed'
    };
    this.allocations.set(allocation.allocationId, allocation);
    return allocation;
  }
}
