/**
 * Digital Labor API Gateway
 * REST API for task submission and orchestration
 */

import express from 'express';

const app = express();
app.use(express.json());

// API Routes
app.post('/v1/tasks', async (req, res) => {
  const { customerId, taskType, payload, priority } = req.body;
  
  // Validate request
  if (!customerId || !taskType || !payload) {
    return res.status(400).json({
      error: 'Missing required fields: customerId, taskType, payload'
    });
  }

  // Create task
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Submit to orchestrator
  const task = {
    taskId,
    customerId,
    taskType,
    payload,
    priority: priority || 'normal',
    status: 'queued',
    createdAt: new Date().toISOString()
  };

  // In production: save to database and queue
  // await taskQueue.enqueue(task);

  res.status(202).json({
    taskId,
    status: 'queued',
    estimatedCompletion: new Date(Date.now() + 5000).toISOString()
  });
});

app.get('/v1/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  
  // In production: query database
  // const task = await database.tasks.findById(taskId);
  
  res.json({
    taskId,
    status: 'completed',
    result: {
      success: true,
      data: { message: 'Task completed successfully' }
    },
    completedAt: new Date().toISOString()
  });
});

app.get('/v1/customers/:customerId/usage', async (req, res) => {
  const { customerId } = req.params;
  
  // In production: aggregate from database
  res.json({
    customerId,
    period: 'current_month',
    totalTasks: 1247,
    totalCost: 247.32,
    tasksPerDay: 41,
    averageLatency: 1.2
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;
