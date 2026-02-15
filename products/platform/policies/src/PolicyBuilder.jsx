/**
 * Policy Builder
 * Visual policy creation and management
 */

import React, { useState } from 'react';

const POLICY_TEMPLATES = [
  {
    id: '1',
    name: 'SOC2 Baseline',
    description: 'Essential controls for SOC2 compliance',
    rules: [
      { condition: 'always', action: 'require-authorization' },
      { condition: 'tier >= 2', action: 'require-audit-log' },
      { condition: 'tier >= 3', action: 'require-human-approval' }
    ]
  },
  {
    id: '2',
    name: 'HIPAA Baseline',
    description: 'Healthcare data protection requirements',
    rules: [
      { condition: 'data.type == "PHI"', action: 'require-encryption' },
      { condition: 'data.type == "PHI"', action: 'require-audit-log' },
      { condition: 'always', action: 'enforce-minimum-access' }
    ]
  },
  {
    id: '3',
    name: 'Financial Services',
    description: 'Controls for financial data and transactions',
    rules: [
      { condition: 'action.type == "financial"', action: 'require-dual-approval' },
      { condition: 'amount > 10000', action: 'require-senior-approval' },
      { condition: 'always', action: 'full-audit-trail' }
    ]
  }
];

export default function PolicyBuilder() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customRules, setCustomRules] = useState([]);

  const addRule = () => {
    setCustomRules([...customRules, { condition: '', action: '' }]);
  };

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Policy Builder
        </h1>
        <p style={{ color: '#6b7280' }}>
          Create and manage governance policies for your agents
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Templates */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Policy Templates
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {POLICY_TEMPLATES.map(template => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  border: selectedTemplate?.id === template.id ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {template.name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  {template.description}
                </p>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  {template.rules.length} rules
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Policy Editor */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Policy Rules
          </h2>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {selectedTemplate ? (
              <>
                <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                  {selectedTemplate.name}
                </h3>
                {selectedTemplate.rules.map((rule, idx) => (
                  <div key={idx} style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.375rem',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                      <strong>Condition:</strong> <code style={{ backgroundColor: '#e5e7eb', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>{rule.condition}</code>
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong>Action:</strong> {rule.action}
                    </div>
                  </div>
                ))}
                <button
                  onClick={addRule}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                    marginTop: '1rem'
                  }}
                >
                  + Add Custom Rule
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                Select a template to get started
              </div>
            )}
          </div>

          {selectedTemplate && (
            <button
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem',
                marginTop: '1rem'
              }}
            >
              Deploy Policy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
