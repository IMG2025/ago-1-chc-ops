/**
 * Model Abstraction Layer
 * Unified interface for different LLM providers
 */

import { ModelConfig } from './types.js';

export interface ModelRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  latency: number;
}

export class ModelAbstraction {
  private config: ModelConfig;
  
  constructor(config: ModelConfig) {
    this.config = config;
  }
  
  async complete(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    
    // In production, this would call actual LLM APIs
    // For now, return mock response
    
    const response: ModelResponse = {
      text: `[Mock response from ${this.config.provider}/${this.config.modelName}]`,
      usage: {
        inputTokens: request.prompt.length / 4, // rough estimate
        outputTokens: 100,
        totalTokens: (request.prompt.length / 4) + 100,
      },
      model: this.config.modelName,
      latency: Date.now() - startTime,
    };
    
    console.log(
      `[MODEL] ${this.config.provider}/${this.config.modelName} | ` +
      `${response.usage.totalTokens} tokens | ` +
      `${response.latency}ms`
    );
    
    return response;
  }
  
  static createAnthropic(modelName: string = 'claude-sonnet-4-20250514'): ModelAbstraction {
    return new ModelAbstraction({
      provider: 'anthropic',
      modelName,
      temperature: 0.7,
      maxTokens: 4096,
    });
  }
  
  static createOpenAI(modelName: string = 'gpt-4'): ModelAbstraction {
    return new ModelAbstraction({
      provider: 'openai',
      modelName,
      temperature: 0.7,
      maxTokens: 4096,
    });
  }
}
