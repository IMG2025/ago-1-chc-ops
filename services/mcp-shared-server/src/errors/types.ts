/**
 * MCP Error Types
 * Standardized error interface and categories
 */

export type ErrorCategory = 'client' | 'server' | 'auth' | 'validation' | 'tool';

export interface MCPError {
  code: string;
  message: string;
  category: ErrorCategory;
  httpStatus: number;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ErrorDefinition {
  message: string;
  category: ErrorCategory;
  httpStatus: number;
  retryable: boolean;
}
