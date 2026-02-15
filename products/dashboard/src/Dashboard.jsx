/**
 * CoreIdentity Monitoring Dashboard
 * Real-time agent monitoring and analytics
 */

import React, { useState, useEffect } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeAgents: 0,
    totalExecutions: 0,
    anomalies: 0,
    killSwitches: 0,
    successRate: 0,
    totalCost: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState([]);

  useEffect(() => {
    // In production: fetch from API
    // Mock data for demonstration
    setStats({
      activeAgents: 12,
      totalExecutions: 1547,
      anomalies: 3,
      killSwitches: 1,
      successRate: 98.7,
      totalCost: 127.42
    });

    setRecentActivity([
      { id: 1, agent: 'agent-123', action: 'ANALYZE', domain: 'hospitality', time: '2 min ago', status: 'success' },
      { id: 2, agent: 'agent-456', action: 'EXECUTE', domain: 'ciag', time: '5 min ago', status: 'success' },
      { id: 3, agent: 'agent-789', action: 'RECOMMEND', domain: 'hospitality', time: '8 min ago', status: 'success' },
    ]);

    setAnomalyAlerts([
      { id: 1, agent: 'agent-999', type: 'frequency_spike', severity: 'high', time: '1 hour ago' },
    ]);
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          CoreIdentity Monitoring
        </h1>
        <p style={{ color: '#666' }}>Real-time agent governance and analytics</p>
      </header>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <StatCard title="Active Agents" value={stats.activeAgents} color="#10b981" />
        <StatCard title="Total Executions" value={stats.totalExecutions.toLocaleString()} color="#3b82f6" />
        <StatCard title="Success Rate" value={`${stats.successRate}%`} color="#8b5cf6" />
        <StatCard 
          title="Anomalies" 
          value={stats.anomalies} 
          color={stats.anomalies > 0 ? "#ef4444" : "#10b981"} 
        />
        <StatCard 
          title="Kill Switches" 
          value={stats.killSwitches} 
          color={stats.killSwitches > 0 ? "#f59e0b" : "#10b981"} 
        />
        <StatCard title="Total Cost" value={`$${stats.totalCost}`} color="#6366f1" />
      </div>

      {/* Anomaly Alerts */}
      {anomalyAlerts.length > 0 && (
        <div style={{ 
          backgroundColor: '#fee2e2', 
          border: '2px solid #ef4444',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#991b1b' }}>
            ⚠️ Anomaly Alerts
          </h2>
          {anomalyAlerts.map(alert => (
            <div key={alert.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{alert.agent}</strong> - {alert.type} ({alert.severity}) - {alert.time}
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      <div style={{ 
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Recent Activity
        </h2>
        <div>
          {recentActivity.map(activity => (
            <div 
              key={activity.id}
              style={{
                padding: '1rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: '500' }}>{activity.agent}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  {activity.action} in {activity.domain}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  color: activity.status === 'success' ? '#10b981' : '#ef4444',
                  fontWeight: '500',
                  fontSize: '0.875rem'
                }}>
                  {activity.status.toUpperCase()}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>
                  {activity.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>
        {value}
      </div>
    </div>
  );
}
