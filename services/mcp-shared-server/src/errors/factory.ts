/**
 * MCP Error Factory
 * Functions for creating standardized errors
 */

import { MCPError, ErrorCategory } from './types.js';
import { ERROR_CATALOG } from './catalog.js';

export function createError(
  code: string,
  details?: Record<string, unknown>
): MCPError {
  const definition = ERROR_CATALOG[code];
  
  if (!definition) {
    console.error(`Unknown error code: ${code}`);
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

export function createErrorWithMessage(
  code: string,
  message: string,
  details?: Record<string, unknown>
): MCPError {
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
