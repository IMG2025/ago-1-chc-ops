/**
 * SmartNation Productivity Analytics Dashboard
 */

import React, { useState } from 'react';

interface ProductivityMetrics {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  averageTaskTime: number; // minutes
  costSavings: number;
  humanHoursReplaced: number;
}

interface AgentPerformance {
  agentId: string;
  agentName: string;
  category: string;
  tasksCompleted: number;
  averageAccuracy: number;
  utilizationRate: number;
  costPerTask: number;
  roi: number;
}

export default function ProductivityDashboard() {
  const [metrics] = useState<ProductivityMetrics>({
    totalAgents: 127,
    activeAgents: 98,
    totalTasks: 45230,
    completedTasks: 43891,
    averageTaskTime: 8.3,
    costSavings: 2450000,
    humanHoursReplaced: 12500
  });

  const [agentPerformance] = useState<AgentPerformance[]>([
    {
      agentId: 'agt_cs_001',
      agentName: 'Customer Service Rep #1',
      category: 'Customer-Facing',
      tasksCompleted: 8934,
      averageAccuracy: 94.2,
      utilizationRate: 87,
      costPerTask: 0.23,
      roi: 1250
    },
    {
      agentId: 'agt_sales_002',
      agentName: 'Sales Development Rep #2',
      category: 'Sales',
      tasksCompleted: 3421,
      averageAccuracy: 91.8,
      utilizationRate: 76,
      costPerTask: 0.89,
      roi: 890
    },
    {
      agentId: 'agt_ops_003',
      agentName: 'Data Entry Specialist #3',
      category: 'Operations',
      tasksCompleted: 12450,
      averageAccuracy: 99.1,
      utilizationRate: 95,
      costPerTask: 0.12,
      roi: 2100
    }
  ]);

  const completionRate = ((metrics.completedTasks / metrics.totalTasks) * 100).toFixed(1);
  const activeRate = ((metrics.activeAgents / metrics.totalAgents) * 100).toFixed(0);

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        SmartNation Productivity Analytics
      </h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        Real-time digital workforce performance and ROI tracking
      </p>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <MetricCard
          title="Active Agents"
          value={`${metrics.activeAgents} / ${metrics.totalAgents}`}
          subtitle={`${activeRate}% utilization`}
          color="#10b981"
        />
        <MetricCard
          title="Tasks Completed"
          value={metrics.completedTasks.toLocaleString()}
          subtitle={`${completionRate}% completion rate`}
          color="#3b82f6"
        />
        <MetricCard
          title="Cost Savings"
          value={`$${(metrics.costSavings / 1000000).toFixed(2)}M`}
          subtitle="vs. human labor cost"
          color="#8b5cf6"
        />
        <MetricCard
          title="Human Hours Replaced"
          value={metrics.humanHoursReplaced.toLocaleString()}
          subtitle={`Avg ${metrics.averageTaskTime} min/task`}
          color="#f59e0b"
        />
      </div>

      {/* Agent Performance Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Agent Performance
        </h2>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b' }}>
                  Agent
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b' }}>
                  Category
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>
                  Tasks
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>
                  Accuracy
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>
                  Utilization
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>
                  Cost/Task
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#64748b' }}>
                  ROI
                </th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map((agent) => (
                <tr key={agent.agentId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>
                    {agent.agentName}
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>
                    {agent.category}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {agent.tasksCompleted.toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      backgroundColor: agent.averageAccuracy > 95 ? '#dcfce7' : '#fef3c7',
                      color: agent.averageAccuracy > 95 ? '#166534' : '#854d0e',
                      fontSize: '0.875rem'
                    }}>
                      {agent.averageAccuracy}%
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {agent.utilizationRate}%
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    ${agent.costPerTask.toFixed(2)}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                    {agent.roi}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Labor Cost Optimization */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginTop: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Labor Cost Optimization
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>
              Traditional Human Labor
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
              $4.2M / year
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
              Based on equivalent human workforce
            </p>
          </div>
          
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>
              Digital Labor Cost
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
              $1.75M / year
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
              58% cost reduction with digital workforce
            </p>
          </div>
        </div>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f0fdf4',
          borderRadius: '0.375rem',
          borderLeft: '4px solid #10b981'
        }}>
          <div style={{ fontWeight: '600', color: '#166534', marginBottom: '0.25rem' }}>
            Annual Savings: $2.45M
          </div>
          <div style={{ fontSize: '0.875rem', color: '#15803d' }}>
            Digital workforce ROI achieved in 4.2 months
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, color }: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
        {subtitle}
      </div>
    </div>
  );
}
