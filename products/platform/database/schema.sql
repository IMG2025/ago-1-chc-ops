-- SmartNation Platform Database Schema
-- Multi-tenant SaaS infrastructure

-- Customers table
CREATE TABLE customers (
  customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_tier VARCHAR(50) DEFAULT 'basic',
  subscription_status VARCHAR(50) DEFAULT 'active',
  billing_email VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  monthly_spend_limit DECIMAL(10,2)
);

-- Users table (customer team members)
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Agents table (customer-deployed agents)
CREATE TABLE agents (
  agent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  agent_name VARCHAR(255) NOT NULL,
  agent_class VARCHAR(50),
  domain_name VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  capabilities JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deployed_by UUID REFERENCES users(user_id)
);

-- Policies table (customer governance policies)
CREATE TABLE policies (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  policy_name VARCHAR(255) NOT NULL,
  policy_version VARCHAR(50),
  policy_rules JSONB,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(user_id)
);

-- Subscriptions table
CREATE TABLE subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  plan_name VARCHAR(100),
  monthly_price DECIMAL(10,2),
  max_agents INTEGER,
  max_executions_per_month INTEGER,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  renews_at TIMESTAMP,
  stripe_subscription_id VARCHAR(255)
);

-- Usage metrics table
CREATE TABLE usage_metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  agent_id UUID REFERENCES agents(agent_id),
  metric_type VARCHAR(50),
  metric_value DECIMAL(10,2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketplace agents (pre-built agent templates)
CREATE TABLE marketplace_agents (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  industry VARCHAR(100),
  agent_class VARCHAR(50),
  capabilities JSONB,
  price_tier VARCHAR(50),
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log (platform-level)
CREATE TABLE audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(customer_id),
  user_id UUID REFERENCES users(user_id),
  action VARCHAR(100),
  resource_type VARCHAR(100),
  resource_id UUID,
  details JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_agents_customer ON agents(customer_id);
CREATE INDEX idx_users_customer ON users(customer_id);
CREATE INDEX idx_policies_customer ON policies(customer_id);
CREATE INDEX idx_usage_customer ON usage_metrics(customer_id);
CREATE INDEX idx_usage_timestamp ON usage_metrics(recorded_at);
CREATE INDEX idx_audit_customer ON audit_log(customer_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
