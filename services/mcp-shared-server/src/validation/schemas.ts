/**
 * Tool Argument Schemas
 * Schema definitions for all MCP tools
 */

import { ToolSchema } from './types.js';

export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  // Shared artifact registry tools
  'shared.artifact_registry.read': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['shared', 'chc', 'ciag', 'hospitality'],
        description: 'Tenant namespace',
      },
    },
  },
  
  'shared.artifact_registry.readById': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['shared', 'chc', 'ciag', 'hospitality'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
        description: 'Unique artifact identifier',
      },
    },
  },
  
  'shared.artifact_registry.search': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['shared', 'chc', 'ciag', 'hospitality'],
      },
      query: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 1000,
        description: 'Search query string',
      },
      maxResults: {
        type: 'number',
        required: false,
        min: 1,
        max: 100,
        description: 'Maximum number of results (default: 10)',
      },
    },
  },
  
  'shared.artifact_registry.write': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['shared', 'chc', 'ciag', 'hospitality'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
      },
      content: {
        type: 'string',
        required: true,
        description: 'Artifact content',
      },
      metadata: {
        type: 'object',
        required: false,
        description: 'Optional metadata',
      },
    },
  },
  
  // CHC artifact registry tools
  'chc.artifact_registry.read': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['chc'],
      },
    },
  },
  
  'chc.artifact_registry.readById': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['chc'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
      },
    },
  },
  
  'chc.artifact_registry.write': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['chc'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
      },
      content: {
        type: 'string',
        required: true,
      },
      metadata: {
        type: 'object',
        required: false,
      },
    },
  },
  
  // CIAG artifact registry tools
  'ciag.artifact_registry.read': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['ciag'],
      },
    },
  },
  
  'ciag.artifact_registry.readById': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['ciag'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
      },
    },
  },
  
  'ciag.artifact_registry.write': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['ciag'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
      },
      content: {
        type: 'string',
        required: true,
      },
      metadata: {
        type: 'object',
        required: false,
      },
    },
  },
  
  // Hospitality artifact registry tools
  'hospitality.artifact_registry.read': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['hospitality'],
      },
    },
  },
  
  'hospitality.artifact_registry.readById': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['hospitality'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
      },
    },
  },
  
  'hospitality.artifact_registry.write': {
    args: {
      tenant: {
        type: 'string',
        required: true,
        enum: ['hospitality'],
      },
      artifactId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 255,
      },
      content: {
        type: 'string',
        required: true,
      },
      metadata: {
        type: 'object',
        required: false,
      },
    },
  },
};
