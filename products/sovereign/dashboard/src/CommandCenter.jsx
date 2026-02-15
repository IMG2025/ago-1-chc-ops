import React, { useState } from 'react';

export default function NationalCommandCenter() {
  const [stats] = useState({
    totalSystems: 1247,
    criticalSystems: 89,
    suspendedSystems: 3,
    complianceRate: 94.2,
  });

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#0f172a', color: 'white' }}>
      <header style={{
        background: '#1e293b',
        borderBottom: '2px solid #ef4444',
        padding: '1.5rem 2rem',
      }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>
          🛡️ NATIONAL AI COMMAND CENTER
        </h1>
        <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0' }}>
          Real-time oversight of national AI systems
        </p>
      </header>
      
      <div style={{ padding: '2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}>
          <MetricCard title="Total Systems" value={stats.totalSystems} color="#3b82f6" />
          <MetricCard title="Critical Systems" value={stats.criticalSystems} color="#ef4444" />
          <MetricCard title="Compliance Rate" value={`${stats.complianceRate}%`} color="#10b981" />
          <MetricCard title="Suspended" value={stats.suspendedSystems} color="#8b5cf6" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color }) {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>
        {value}
      </div>
    </div>
  );
}
