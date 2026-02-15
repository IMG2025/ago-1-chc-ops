/**
 * Argument Validator
 * Validates tool arguments against schemas
 */

import { Schema, ValidationResult, ValidationError } from './types.js';
import { TOOL_SCHEMAS } from './schemas.js';
import { createError } from '../errors/index.js';

export function validateToolArgs(toolName: string, args: Record<string, unknown>): ValidationResult {
  const schema = TOOL_SCHEMAS[toolName];
  
  if (!schema) {
    return {
      valid: false,
      errors: [{
        field: 'tool',
        message: `No schema defined for tool: ${toolName}`,
      }],
    };
  }
  
  const errors: ValidationError[] = [];
  
  // Check required fields
  for (const [fieldName, fieldSchema] of Object.entries(schema.args)) {
    if (fieldSchema.required && !(fieldName in args)) {
      errors.push({
        field: fieldName,
        message: `Required field '${fieldName}' is missing`,
      });
      continue;
    }
    
    // Skip validation if field not present and not required
    if (!(fieldName in args)) {
      continue;
    }
    
    const value = args[fieldName];
    const fieldErrors = validateField(fieldName, value, fieldSchema);
    errors.push(...fieldErrors);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateField(fieldName: string, value: unknown, schema: Schema): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Type validation
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== schema.type) {
    errors.push({
      field: fieldName,
      message: `Expected type '${schema.type}' but got '${actualType}'`,
      value,
    });
    return errors; // Don't continue if type is wrong
  }
  
  // String-specific validation
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        field: fieldName,
        message: `String length ${value.length} is below minimum ${schema.minLength}`,
        value,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        field: fieldName,
        message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
        value,
      });
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push({
        field: fieldName,
        message: `String does not match required pattern`,
        value,
      });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: fieldName,
        message: `Value '${value}' is not in allowed values: ${schema.enum.join(', ')}`,
        value,
      });
    }
  }
  
  // Number-specific validation
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      errors.push({
        field: fieldName,
        message: `Number ${value} is below minimum ${schema.min}`,
        value,
      });
    }
    if (schema.max !== undefined && value > schema.max) {
      errors.push({
        field: fieldName,
        message: `Number ${value} exceeds maximum ${schema.max}`,
        value,
      });
    }
  }
  
  // Array-specific validation
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        field: fieldName,
        message: `Array length ${value.length} is below minimum ${schema.minItems}`,
        value,
      });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        field: fieldName,
        message: `Array length ${value.length} exceeds maximum ${schema.maxItems}`,
        value,
      });
    }
  }
  
  return errors;
}

export function getValidationErrorResponse(toolName: string, validationResult: ValidationResult) {
  const errorDetails = {
    tool: toolName,
    validationErrors: validationResult.errors,
  };
  
  // Determine which error code to use
  const firstError = validationResult.errors[0];
  let errorCode = 'INVALID_ARGUMENT_TYPE';
  
  if (firstError.message.includes('missing')) {
    errorCode = 'MISSING_REQUIRED_FIELD';
  } else if (firstError.message.includes('below minimum') || firstError.message.includes('exceeds maximum')) {
    errorCode = 'ARGUMENT_OUT_OF_RANGE';
  } else if (firstError.message.includes('not in allowed values')) {
    errorCode = 'INVALID_ENUM_VALUE';
  } else if (firstError.message.includes('pattern')) {
    errorCode = 'INVALID_PATTERN';
  } else if (firstError.message.includes('length')) {
    errorCode = firstError.message.includes('below') ? 'ARGUMENT_TOO_SHORT' : 'ARGUMENT_TOO_LONG';
  }
  
  return createError(errorCode, errorDetails);
}
