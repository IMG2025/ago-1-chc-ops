/**
 * Agent Marketplace
 * Browse and deploy pre-built agent templates
 */

import React, { useState } from 'react';

const AGENT_TEMPLATES = [
  {
    id: '1',
    name: 'Customer Support Advisor',
    description: 'Analyzes customer inquiries and suggests responses',
    industry: 'General',
    class: 'Advisor',
    capabilities: ['read', 'analyze', 'recommend'],
    price: 'Free',
    rating: 4.8,
    downloads: 1247
  },
  {
    id: '2',
    name: 'Sales Data Analyzer',
    description: 'Monitors sales metrics and identifies trends',
    industry: 'Sales',
    class: 'Observer',
    capabilities: ['read', 'query', 'analyze'],
    price: 'Free',
    rating: 4.6,
    downloads: 892
  },
  {
    id: '3',
    name: 'Hospitality Guest Experience',
    description: 'Manages guest requests and service optimization',
    industry: 'Hospitality',
    class: 'Executor',
    capabilities: ['read', 'analyze', 'execute'],
    price: '$99/mo',
    rating: 4.9,
    downloads: 234
  },
  {
    id: '4',
    name: 'Legal Document Reviewer',
    description: 'Reviews contracts and identifies risks',
    industry: 'Legal',
    class: 'Advisor',
    capabilities: ['read', 'analyze', 'flag-risks'],
    price: '$199/mo',
    rating: 4.7,
    downloads: 156
  },
];

export default function Marketplace() {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAgents = AGENT_TEMPLATES.filter(agent => {
    const matchesFilter = filter === 'all' || agent.industry.toLowerCase() === filter;
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Agent Marketplace
        </h1>
        <p style={{ color: '#6b7280' }}>
          Browse and deploy pre-built AI agents for your business
        </p>
      </header>

      {/* Search and Filters */}
      <div style={{ 
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <input
          type="text"
          placeholder="Search agents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            marginBottom: '1rem'
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', 'general', 'hospitality', 'legal', 'sales'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: filter === f ? '#4f46e5' : '#e5e7eb',
                color: filter === f ? 'white' : '#374151',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: '500'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1.5rem'
      }}>
        {filteredAgents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280'
        }}>
          No agents found matching your criteria
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>
            {agent.name}
          </h3>
          <span style={{
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: '500'
          }}>
            {agent.class}
          </span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {agent.description}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {agent.capabilities.map(cap => (
          <span key={cap} style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.75rem'
          }}>
            {cap}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          ⭐ {agent.rating} • {agent.downloads} downloads
        </div>
        <div style={{ fontWeight: 'bold', color: '#4f46e5' }}>
          {agent.price}
        </div>
      </div>

      <button style={{
        backgroundColor: '#4f46e5',
        color: 'white',
        padding: '0.75rem',
        borderRadius: '0.375rem',
        border: 'none',
        cursor: 'pointer',
        fontWeight: '500',
        width: '100%'
      }}>
        Deploy Agent
      </button>
    </div>
  );
}
