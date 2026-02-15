/**
 * CoreIdentity JavaScript SDK
 * Client library for Digital Labor Network
 */

export interface TaskSubmission {
  taskType: string;
  payload: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface Task {
  taskId: string;
  status: 'queued' | 'assigned' | 'executing' | 'completed' | 'failed';
  result?: any;
  createdAt: string;
  completedAt?: string;
}

export class CoreIdentityClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.coreidentity.ai') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async submitTask(submission: TaskSubmission): Promise<Task> {
    return this.request('/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(submission)
    });
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request(`/v1/tasks/${taskId}`);
  }

  async waitForCompletion(
    taskId: string,
    timeout: number = 300000,
    pollInterval: number = 2000
  ): Promise<Task> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const task = await this.getTask(taskId);

      if (task.status === 'completed' || task.status === 'failed') {
        return task;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Task ${taskId} did not complete within ${timeout}ms`);
  }

  async getUsage(): Promise<any> {
    return this.request('/v1/usage');
  }
}

// Example usage
async function example() {
  const client = new CoreIdentityClient('your_api_key');

  // Submit task
  const task = await client.submitTask({
    taskType: 'analyze_data',
    payload: { data: [1, 2, 3, 4, 5] },
    priority: 'high'
  });

  console.log('Task submitted:', task.taskId);

  // Wait for completion
  const result = await client.waitForCompletion(task.taskId);
  console.log('Task completed:', result);
}
