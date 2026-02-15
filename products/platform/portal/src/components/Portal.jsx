/**
 * SmartNation Customer Portal
 * Main SaaS dashboard for customers
 */

import React, { useState, useEffect } from 'react';

export default function Portal() {
  const [customer, setCustomer] = useState(null);
  const [agents, setAgents] = useState([]);
  const [usage, setUsage] = useState({ executions: 0, cost: 0, limit: 0 });

  useEffect(() => {
    // Mock data - in production, fetch from API
    setCustomer({
      name: 'Acme Corp',
      tier: 'Enterprise',
      status: 'Active'
    });

    setAgents([
      { id: '1', name: 'Sales Analyzer', class: 'Advisor', status: 'active', executions: 1247 },
      { id: '2', name: 'Customer Support', class: 'Executor', status: 'active', executions: 3891 },
      { id: '3', name: 'Data Monitor', class: 'Observer', status: 'active', executions: 5632 },
    ]);

    setUsage({
      executions: 10770,
      cost: 247.32,
      limit: 50000
    });
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            SmartNation AI
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            {customer?.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{
            backgroundColor: customer?.status === 'Active' ? '#d1fae5' : '#fee2e2',
            color: customer?.status === 'Active' ? '#065f46' : '#991b1b',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            {customer?.tier}
          </span>
          <button style={{
            backgroundColor: '#4f46e5',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500'
          }}>
            Settings
          </button>
        </div>
      </header>

      <div style={{ padding: '2rem' }}>
        {/* Usage Stats */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            This Month's Usage
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <UsageStat
              label="Executions"
              value={usage.executions.toLocaleString()}
              sublabel={`of ${usage.limit.toLocaleString()} limit`}
              percentage={(usage.executions / usage.limit) * 100}
            />
            <UsageStat
              label="Cost"
              value={`$${usage.cost.toFixed(2)}`}
              sublabel="this billing period"
            />
            <UsageStat
              label="Active Agents"
              value={agents.filter(a => a.status === 'active').length}
              sublabel={`${agents.length} total`}
            />
          </div>
        </div>

        {/* Agents List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
              Your Agents
            </h2>
            <button style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}>
              + Deploy Agent
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Class</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Executions</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontWeight: '500' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{agent.name}</td>
                  <td style={{ padding: '1rem' }}>{agent.class}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      backgroundColor: agent.status === 'active' ? '#d1fae5' : '#fee2e2',
                      color: agent.status === 'active' ? '#065f46' : '#991b1b',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem'
                    }}>
                      {agent.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{agent.executions.toLocaleString()}</td>
                  <td style={{ padding: '1rem' }}>
                    <button style={{
                      color: '#4f46e5',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsageStat({ label, value, sublabel, percentage }) {
  return (
    <div>
      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
          {sublabel}
        </div>
      )}
      {percentage !== undefined && (
        <div style={{
          width: '100%',
          height: '0.5rem',
          backgroundColor: '#e5e7eb',
          borderRadius: '9999px',
          marginTop: '0.5rem',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(percentage, 100)}%`,
            height: '100%',
            backgroundColor: percentage > 80 ? '#ef4444' : percentage > 60 ? '#f59e0b' : '#10b981',
            transition: 'width 0.3s'
          }} />
        </div>
      )}
    </div>
  );
}
