import axios from 'axios';
import { config } from '../config/env';

export interface LLMModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing?: {
    prompt: number; // cost per million tokens
    completion: number; // cost per million tokens
  };
  capabilities?: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  userId?: string;
  projectId?: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finishReason?: string;
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class LLMService {
  private openRouterApiKey: string;
  private openRouterBaseUrl: string = 'https://openrouter.ai/api/v1';
  
  // Popular models with their configurations
  private availableModels: LLMModel[] = [
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Most intelligent model from Anthropic',
      contextLength: 200000,
      pricing: { prompt: 3, completion: 15 },
      capabilities: ['coding', 'analysis', 'creative-writing', 'math']
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      description: 'OpenAI\'s latest multimodal model',
      contextLength: 128000,
      pricing: { prompt: 2.5, completion: 10 },
      capabilities: ['coding', 'analysis', 'vision', 'reasoning']
    },
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Gemini 2.0 Flash (Free)',
      description: 'Google\'s fast model - Free tier',
      contextLength: 1048576,
      pricing: { prompt: 0, completion: 0 },
      capabilities: ['general', 'coding', 'fast-responses']
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek Chat',
      description: 'Efficient coding and reasoning model',
      contextLength: 64000,
      pricing: { prompt: 0.14, completion: 0.28 },
      capabilities: ['coding', 'math', 'reasoning']
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B',
      description: 'Meta\'s latest open model',
      contextLength: 131072,
      pricing: { prompt: 0.8, completion: 0.8 },
      capabilities: ['general', 'coding', 'multilingual']
    },
    {
      id: 'qwen/qwen-2.5-72b-instruct',
      name: 'Qwen 2.5 72B',
      description: 'Strong multilingual and coding model',
      contextLength: 131072,
      pricing: { prompt: 0.35, completion: 0.4 },
      capabilities: ['coding', 'multilingual', 'reasoning']
    },
    {
      id: 'mistralai/mistral-large',
      name: 'Mistral Large',
      description: 'Mistral\'s flagship model',
      contextLength: 128000,
      pricing: { prompt: 2, completion: 6 },
      capabilities: ['coding', 'analysis', 'multilingual']
    }
  ];

  constructor() {
    this.openRouterApiKey = config.OPENROUTER_API_KEY || '';
    if (!this.openRouterApiKey) {
      console.warn('OpenRouter API key not configured. LLM features will be limited.');
    }
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): LLMModel[] {
    return this.availableModels;
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): LLMModel | undefined {
    return this.availableModels.find(model => model.id === modelId);
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!this.openRouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: false // For now, we'll handle non-streaming responses
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': config.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'CogniCraft'
          }
        }
      );

      return {
        id: response.data.id,
        model: response.data.model,
        choices: response.data.choices.map((choice: any) => ({
          message: {
            role: choice.message.role,
            content: choice.message.content
          },
          finishReason: choice.finish_reason
        })),
        usage: response.data.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      throw new Error('Failed to generate response from LLM');
    }
  }

  /**
   * Stream a chat completion response
   * Returns an async generator that yields chunks of the response
   */
  async *streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!this.openRouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': config.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'CogniCraft'
          },
          responseType: 'stream'
        }
      );

      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming from OpenRouter API:', error);
      throw new Error('Failed to stream response from LLM');
    }
  }

  /**
   * Check if the service has a valid API key
   */
  isConfigured(): boolean {
    return !!this.openRouterApiKey;
  }
}

export const llmService = new LLMService();