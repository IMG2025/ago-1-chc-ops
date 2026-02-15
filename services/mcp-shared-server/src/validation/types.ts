/**
 * Validation Schema Types
 */

export type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface BaseSchema {
  type: SchemaType;
  required?: boolean;
  description?: string;
}

export interface StringSchema extends BaseSchema {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: string[];
}

export interface NumberSchema extends BaseSchema {
  type: 'number';
  min?: number;
  max?: number;
}

export interface BooleanSchema extends BaseSchema {
  type: 'boolean';
}

export interface ObjectSchema extends BaseSchema {
  type: 'object';
  properties?: Record<string, Schema>;
}

export interface ArraySchema extends BaseSchema {
  type: 'array';
  items?: Schema;
  minItems?: number;
  maxItems?: number;
}

export type Schema = StringSchema | NumberSchema | BooleanSchema | ObjectSchema | ArraySchema;

export interface ToolSchema {
  args: Record<string, Schema>;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
