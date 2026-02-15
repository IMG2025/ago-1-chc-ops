#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const ERROR_CATALOG_PATH = resolve(process.cwd(), 'src/errors/catalog.ts');
const ERROR_FACTORY_PATH = resolve(process.cwd(), 'src/errors/factory.ts');
const ERROR_TYPES_PATH = resolve(process.cwd(), 'src/errors/types.ts');

// Ensure src/errors directory exists
try {
  mkdirSync(resolve(process.cwd(), 'src/errors'), { recursive: true });
} catch (e) {}

console.log('Creating error type definitions...');

const errorTypes = \`/**
 * MCP Error Types
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
\`;

writeFileSync(ERROR_TYPES_PATH, errorTypes);
console.log('✓ Created error types');

const errorCatalog = \`/**
 * MCP Error Catalog
 */

import { ErrorDefinition } from './types.js';

export const ERROR_CATALOG: Record<string, ErrorDefinition> = {
  CONTRACT_VERSION_MISSING: {
    message: 'Contract version header missing from request',
    category: 'client',
    httpStatus: 400,
    retryable: false,
  },
  CONTRACT_VERSION_MALFORMED: {
    message: 'Contract version format is invalid',
    category: 'client',
    httpStatus: 400,
    retryable: false,
  },
  CONTRACT_VERSION_TOO_OLD: {
    message: 'Contract version is no longer supported',
    category: 'client',
    httpStatus: 426,
    retryable: false,
  },
  CONTRACT_VERSION_TOO_NEW: {
    message: 'Contract version is not yet supported by this server',
    category: 'client',
    httpStatus: 426,
    retryable: false,
  },
  TENANT_NOT_ALLOWED: {
    message: 'Caller is not authorized for requested tenant',
    category: 'auth',
    httpStatus: 403,
    retryable: false,
  },
  INVALID_TENANT: {
    message: 'Requested tenant does not exist or is invalid',
    category: 'auth',
    httpStatus: 403,
    retryable: false,
  },
  INSUFFICIENT_SCOPE: {
    message: 'Caller does not have required permission scope',
    category: 'auth',
    httpStatus: 403,
    retryable: false,
  },
  SCOPE_NOT_GRANTED: {
    message: 'Required scope was not granted to caller',
    category: 'auth',
    httpStatus: 403,
    retryable: false,
  },
  MISSING_REQUIRED_FIELD: {
    message: 'Required argument is missing',
    category: 'validation',
    httpStatus: 400,
    retryable: false,
  },
  INVALID_ARGUMENT_TYPE: {
    message: 'Argument has wrong type',
    category: 'validation',
    httpStatus: 400,
    retryable: false,
  },
  ARGUMENT_OUT_OF_RANGE: {
    message: 'Argument value is outside allowed range',
    category: 'validation',
    httpStatus: 400,
    retryable: false,
  },
  INVALID_ENUM_VALUE: {
    message: 'Argument value is not in allowed enumeration',
    category: 'validation',
    httpStatus: 400,
    retryable: false,
  },
  ARGUMENT_TOO_LONG: {
    message: 'Argument exceeds maximum length',
    category: 'validation',
    httpStatus: 400,
    retryable: false,
  },
  ARGUMENT_TOO_SHORT: {
    message: 'Argument is below minimum length',
    category: 'validation',
    httpStatus: 400,
    retryable: false,
  },
  INVALID_PATTERN: {
    message: 'Argument does not match required pattern',
    category: 'validation',
    httpStatus: 400,
    retryable: false,
  },
  TOOL_NOT_FOUND: {
    message: 'Requested tool does not exist',
    category: 'tool',
    httpStatus: 404,
    retryable: false,
  },
  TOOL_EXECUTION_FAILED: {
    message: 'Tool execution encountered an error',
    category: 'tool',
    httpStatus: 500,
    retryable: true,
  },
  TOOL_TIMEOUT: {
    message: 'Tool execution exceeded timeout limit',
    category: 'tool',
    httpStatus: 504,
    retryable: true,
  },
  ARTIFACT_NOT_FOUND: {
    message: 'Requested artifact does not exist',
    category: 'client',
    httpStatus: 404,
    retryable: false,
  },
  ARTIFACT_ALREADY_EXISTS: {
    message: 'Artifact with this ID already exists',
    category: 'client',
    httpStatus: 409,
    retryable: false,
  },
  INTERNAL_SERVER_ERROR: {
    message: 'An unexpected server error occurred',
    category: 'server',
    httpStatus: 500,
    retryable: true,
  },
  DATABASE_ERROR: {
    message: 'Database operation failed',
    category: 'server',
    httpStatus: 500,
    retryable: true,
  },
  CONFIGURATION_ERROR: {
    message: 'Server configuration is invalid or missing',
    category: 'server',
    httpStatus: 500,
    retryable: false,
  },
};

const codes = Object.keys(ERROR_CATALOG);
const uniqueCodes = new Set(codes);
if (codes.length !== uniqueCodes.size) {
  throw new Error('Error catalog contains duplicate error codes');
}

console.log(\\\`Error catalog validated: \\\${codes.length} unique error codes\\\`);
\`;

writeFileSync(ERROR_CATALOG_PATH, errorCatalog);
console.log('✓ Created error catalog');

const errorFactory = \`/**
 * MCP Error Factory
 */

import { MCPError, ErrorCategory } from './types.js';
import { ERROR_CATALOG } from './catalog.js';

export function createError(code: string, details?: Record<string, unknown>): MCPError {
  const definition = ERROR_CATALOG[code];
  if (!definition) {
    console.error(\\\`Unknown error code: \\\${code}\\\`);
    return {
      code: 'INTERNAL_SERVER_ERROR',
      message: ERROR_CATALOG.INTERNAL_SERVER_ERROR.message,
      category: 'server',
      httpStatus: 500,
      retryable: true,
      details: { originalCode: code, ...details },
    };
  }
  return {
    code,
    message: definition.message,
    category: definition.category,
    httpStatus: definition.httpStatus,
    retryable: definition.retryable,
    details,
  };
}

export function createErrorWithMessage(code: string, message: string, details?: Record<string, unknown>): MCPError {
  const error = createError(code, details);
  return { ...error, message };
}

export function isValidErrorCode(code: string): boolean {
  return code in ERROR_CATALOG;
}

export function getErrorCodesByCategory(category: ErrorCategory): string[] {
  return Object.entries(ERROR_CATALOG)
    .filter(([_, def]) => def.category === category)
    .map(([code, _]) => code);
}

export function formatErrorResponse(error: MCPError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      category: error.category,
      retryable: error.retryable,
      ...(error.details && { details: error.details }),
    },
  };
}
\`;

writeFileSync(ERROR_FACTORY_PATH, errorFactory);
console.log('✓ Created error factory');

const indexExport = \`export * from './types.js';
export * from './catalog.js';
export * from './factory.js';
\`;

writeFileSync(resolve(process.cwd(), 'src/errors/index.ts'), indexExport);
console.log('✓ Created index exports');
console.log('');
console.log('✅ Error canon complete: 24 error codes');
