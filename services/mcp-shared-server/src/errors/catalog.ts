/**
 * MCP Error Catalog
 * Complete canonical error code definitions
 */

import { ErrorDefinition } from './types.js';

export const ERROR_CATALOG: Record<string, ErrorDefinition> = {
  // Contract Version Errors
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
  
  // Authentication/Authorization Errors
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
  
  // Validation Errors
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
  
  // Tool Errors
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
  
  // Resource Errors
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
  
  // Server Errors
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
