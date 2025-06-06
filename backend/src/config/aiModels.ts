export interface AIModelInfo {
  id: string;
  name: string;
  provider: 'openrouter' | 'gemini';
  description: string;
  isFree: boolean;
  costPer1MTokens?: number; // USD per 1M tokens (null for free)
  maxTokens: number;
  capabilities: string[];
  recommendedFor: string[];
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
}

// Available AI models configuration
export const AVAILABLE_AI_MODELS: AIModelInfo[] = [
  // Free OpenRouter Models
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openrouter',
    description: 'Fast and capable model for most tasks. Great for development and testing.',
    isFree: true,
    maxTokens: 4096,
    capabilities: ['chat', 'analysis', 'coding'],
    recommendedFor: ['Development', 'Testing', 'General Use'],
    speed: 'fast',
    quality: 'good'
  },
  {
    id: 'mistralai/mistral-7b-instruct',
    name: 'Mistral 7B Instruct',
    provider: 'openrouter',
    description: 'Open-source model that\'s efficient and capable for most coding tasks.',
    isFree: true,
    maxTokens: 8192,
    capabilities: ['chat', 'analysis', 'coding'],
    recommendedFor: ['Development', 'Code Analysis', 'Task Planning'],
    speed: 'fast',
    quality: 'good'
  },
  {
    id: 'microsoft/wizardlm-2-8x22b',
    name: 'WizardLM 2 8x22B',
    provider: 'openrouter',
    description: 'Powerful open-source model with strong reasoning capabilities.',
    isFree: true,
    maxTokens: 65536,
    capabilities: ['chat', 'analysis', 'coding', 'reasoning'],
    recommendedFor: ['Complex Analysis', 'Project Planning', 'Code Review'],
    speed: 'medium',
    quality: 'excellent'
  },
  {
    id: 'nousresearch/nous-capybara-7b',
    name: 'Nous Capybara 7B',
    provider: 'openrouter',
    description: 'Fine-tuned for conversation and coding tasks.',
    isFree: true,
    maxTokens: 4096,
    capabilities: ['chat', 'coding'],
    recommendedFor: ['Development Chat', 'Code Generation'],
    speed: 'fast',
    quality: 'good'
  },
  {
    id: 'huggingfaceh4/zephyr-7b-beta',
    name: 'Zephyr 7B Beta',
    provider: 'openrouter',
    description: 'Open-source model optimized for helpful and harmless responses.',
    isFree: true,
    maxTokens: 4096,
    capabilities: ['chat', 'analysis'],
    recommendedFor: ['General Chat', 'Basic Analysis'],
    speed: 'fast',
    quality: 'basic'
  },

  // Premium OpenRouter Models (for comparison)
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    description: 'Anthropic\'s most capable model, excellent for code and complex reasoning.',
    isFree: false,
    costPer1MTokens: 3.00,
    maxTokens: 200000,
    capabilities: ['chat', 'analysis', 'coding', 'reasoning', 'long-context'],
    recommendedFor: ['Production', 'Complex Projects', 'Code Analysis'],
    speed: 'medium',
    quality: 'excellent'
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openrouter',
    description: 'OpenAI\'s latest GPT-4 model with improved performance.',
    isFree: false,
    costPer1MTokens: 10.00,
    maxTokens: 128000,
    capabilities: ['chat', 'analysis', 'coding', 'reasoning'],
    recommendedFor: ['Production', 'High-Quality Analysis'],
    speed: 'medium',
    quality: 'excellent'
  },

  // Gemini Models
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Google\'s advanced model with large context window.',
    isFree: false, // Has free tier but with limits
    costPer1MTokens: 7.00,
    maxTokens: 2048000,
    capabilities: ['chat', 'analysis', 'coding', 'long-context'],
    recommendedFor: ['Large Projects', 'Document Analysis'],
    speed: 'medium',
    quality: 'excellent'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Faster version of Gemini with good performance.',
    isFree: true, // Free tier available
    maxTokens: 1048576,
    capabilities: ['chat', 'analysis', 'coding'],
    recommendedFor: ['Development', 'Quick Analysis'],
    speed: 'fast',
    quality: 'good'
  }
];

// Helper functions
export const getFreeModels = (): AIModelInfo[] => {
  return AVAILABLE_AI_MODELS.filter(model => model.isFree);
};

export const getModelsByProvider = (provider: 'openrouter' | 'gemini'): AIModelInfo[] => {
  return AVAILABLE_AI_MODELS.filter(model => model.provider === provider);
};

export const getModelById = (id: string): AIModelInfo | undefined => {
  return AVAILABLE_AI_MODELS.find(model => model.id === id);
};

export const getRecommendedModels = (useCase: string): AIModelInfo[] => {
  return AVAILABLE_AI_MODELS.filter(model => 
    model.recommendedFor.some(rec => 
      rec.toLowerCase().includes(useCase.toLowerCase())
    )
  );
};

// Default model configurations
export const DEFAULT_MODELS = {
  FREE_DEVELOPMENT: 'openai/gpt-3.5-turbo',
  FREE_ANALYSIS: 'microsoft/wizardlm-2-8x22b',
  PREMIUM_PRODUCTION: 'anthropic/claude-3.5-sonnet',
  GEMINI_FALLBACK: 'gemini-1.5-flash'
};

export default AVAILABLE_AI_MODELS; 