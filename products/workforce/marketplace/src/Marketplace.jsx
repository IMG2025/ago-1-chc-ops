/**
 * AI Workforce Marketplace
 * Browse and deploy AI agents with one click
 */

import React, { useState, useEffect } from 'react';

export default function Marketplace() {
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deployedAgents, setDeployedAgents] = useState([]);

  useEffect(() => {
    // Load agent catalog
    // In production: fetch from API
    const mockAgents = generateMockAgents();
    setAgents(mockAgents);
    
    const cats = ['all', ...new Set(mockAgents.map(a => a.category))];
    setCategories(cats);
  }, []);

  const filteredAgents = agents.filter(agent => {
    const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory;
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const deployAgent = (agent) => {
    setDeployedAgents([...deployedAgents, agent]);
    alert(`Deploying ${agent.name}... \n\nAgent will be ready in 30 seconds!`);
  };

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1.5rem 2rem'
      }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          🤖 AI Workforce Marketplace
        </h1>
        <p style={{ color: '#6b7280' }}>
          Browse and deploy 100+ pre-built AI agents in minutes
        </p>
      </header>

      <div style={{ padding: '2rem' }}>
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
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: selectedCategory === cat ? '#4f46e5' : '#e5e7eb',
                  color: selectedCategory === cat ? 'white' : '#374151',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontWeight: '500'
                }}
              >
                {cat.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <StatCard title="Total Agents" value="100+" color="#4f46e5" />
          <StatCard title="Categories" value={categories.length - 1} color="#10b981" />
          <StatCard title="Your Deployed" value={deployedAgents.length} color="#f59e0b" />
          <StatCard title="Avg Savings" value="$45K/year" color="#8b5cf6" />
        </div>

        {/* Agent Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {filteredAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onDeploy={deployAgent} />
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '4rem',
            color: '#6b7280'
          }}>
            No agents found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, onDeploy }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 10px 15px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>
            {agent.name}
          </h3>
          <span style={{
            backgroundColor: getCategoryColor(agent.category),
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: '500'
          }}>
            {agent.category}
          </span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {agent.description}
        </p>
      </div>

      {/* Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.5rem',
        fontSize: '0.75rem'
      }}>
        <div style={{ backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '0.25rem' }}>
          <div style={{ color: '#6b7280' }}>Response Time</div>
          <div style={{ fontWeight: 'bold' }}>{agent.metrics.responseTime}</div>
        </div>
        <div style={{ backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '0.25rem' }}>
          <div style={{ color: '#6b7280' }}>Accuracy</div>
          <div style={{ fontWeight: 'bold' }}>{agent.metrics.accuracy}</div>
        </div>
      </div>

      {/* Pricing */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '0.5rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4f46e5' }}>
            ${agent.pricing.base}/mo
          </div>
          {agent.pricing.perUnit && (
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              + ${agent.pricing.perUnit}/{agent.pricing.unit}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeploy(agent);
          }}
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem'
          }}
        >
          Deploy
        </button>
      </div>

      {/* ROI */}
      <div style={{
        backgroundColor: '#d1fae5',
        color: '#065f46',
        padding: '0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        textAlign: 'center'
      }}>
        💰 ROI: {agent.metrics.roi}
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>
        {value}
      </div>
    </div>
  );
}

function getCategoryColor(category) {
  const colors = {
    'customer-facing': '#3b82f6',
    'operations': '#10b981',
    'analysis': '#8b5cf6',
    'content': '#f59e0b',
    'hr': '#ec4899',
    'legal': '#6366f1',
    'healthcare': '#ef4444',
    'retail': '#14b8a6',
    'manufacturing': '#f97316',
    'financial': '#0ea5e9',
  };
  return colors[category] || '#6b7280';
}

function generateMockAgents() {
  return [
    {
      id: '1',
      name: 'Customer Service Representative',
      category: 'customer-facing',
      description: 'Handles support tickets, FAQs, and basic troubleshooting',
      pricing: { base: 500, perUnit: 0.05, unit: 'interaction' },
      metrics: { responseTime: '30s', accuracy: '94%', roi: '300%' }
    },
    {
      id: '2',
      name: 'Sales Development Rep',
      category: 'customer-facing',
      description: 'Lead qualification and meeting scheduling',
      pricing: { base: 1500, perUnit: 2, unit: 'lead' },
      metrics: { responseTime: '< 1hr', accuracy: '89%', roi: '400%' }
    },
    {
      id: '3',
      name: 'Data Entry Specialist',
      category: 'operations',
      description: 'Extract, transform, and load data',
      pricing: { base: 300, perUnit: 0.01, unit: 'record' },
      metrics: { responseTime: '500/hr', accuracy: '99%', roi: '600%' }
    },
    {
      id: '4',
      name: 'Business Intelligence Analyst',
      category: 'analysis',
      description: 'Data analysis and report generation',
      pricing: { base: 1800 },
      metrics: { responseTime: 'Daily', accuracy: '89%', roi: '250%' }
    },
    {
      id: '5',
      name: 'Content Writer',
      category: 'content',
      description: 'Blog posts and marketing copy',
      pricing: { base: 800, perUnit: 0.10, unit: 'word' },
      metrics: { responseTime: '2K words/day', accuracy: '92%', roi: '350%' }
    },
    {
      id: '6',
      name: 'Recruiting Coordinator',
      category: 'hr',
      description: 'Resume screening and interview scheduling',
      pricing: { base: 1200, perUnit: 5, unit: 'candidate' },
      metrics: { responseTime: '3x faster', accuracy: '88%', roi: '450%' }
    },
    {
      id: '7',
      name: 'Contract Review Assistant',
      category: 'legal',
      description: 'Contract analysis and risk flagging',
      pricing: { base: 2000, perUnit: 10, unit: 'contract' },
      metrics: { responseTime: '10x faster', accuracy: '96%', roi: '500%' }
    },
    {
      id: '8',
      name: 'Medical Coder',
      category: 'healthcare',
      description: 'ICD-10 coding and claim preparation',
      pricing: { base: 1500, perUnit: 1, unit: 'chart' },
      metrics: { responseTime: '5 min', accuracy: '97%', roi: '400%' }
    },
  ];
}
