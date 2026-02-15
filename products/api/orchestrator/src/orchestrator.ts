/**
 * Task Orchestration Engine
 * Routes tasks to agents and manages execution
 */

export interface Task {
  taskId: string;
  customerId: string;
  taskType: string;
  payload: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'queued' | 'assigned' | 'executing' | 'completed' | 'failed';
  assignedAgent?: string;
  result?: any;
  createdAt: string;
  completedAt?: string;
}

export class TaskOrchestrator {
  private taskQueue: Task[] = [];
  private executingTasks: Map<string, Task> = new Map();

  enqueue(task: Task): void {
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => {
      const priorities = { critical: 4, high: 3, normal: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
    
    console.log(`[ORCHESTRATOR] Task ${task.taskId} queued (priority: ${task.priority})`);
    
    // Trigger processing
    this.processTasks();
  }

  private async processTasks(): Promise<void> {
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      
      // Find available agent
      const agent = await this.findAvailableAgent(task.taskType);
      
      if (agent) {
        task.status = 'assigned';
        task.assignedAgent = agent;
        this.executingTasks.set(task.taskId, task);
        
        // Execute task
        this.executeTask(task);
      } else {
        // No agent available, re-queue
        this.taskQueue.push(task);
        break;
      }
    }
  }

  private async findAvailableAgent(taskType: string): Promise<string | null> {
    // In production: query agent registry for available agents
    // with matching capabilities and domain
    return `agent_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async executeTask(task: Task): Promise<void> {
    task.status = 'executing';
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Complete task
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = {
      success: true,
      data: { message: `Executed ${task.taskType}` }
    };
    
    this.executingTasks.delete(task.taskId);
    
    console.log(`[ORCHESTRATOR] Task ${task.taskId} completed by ${task.assignedAgent}`);
  }

  getTask(taskId: string): Task | undefined {
    return this.executingTasks.get(taskId) ||
           this.taskQueue.find(t => t.taskId === taskId);
  }

  getQueueStats(): {
    queued: number;
    executing: number;
    queuedByPriority: Record<string, number>;
  } {
    const queuedByPriority = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };

    for (const task of this.taskQueue) {
      queuedByPriority[task.priority]++;
    }

    return {
      queued: this.taskQueue.length,
      executing: this.executingTasks.size,
      queuedByPriority
    };
  }
}

export const orchestrator = new TaskOrchestrator();
