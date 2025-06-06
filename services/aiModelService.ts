import { apiClient } from './apiClient';

export interface AIModel {
  id: string;
  name: string;
  provider: 'openrouter' | 'gemini';
  description: string;
  isFree: boolean;
  costPer1MTokens?: number;
  maxTokens: number;
  capabilities: string[];
  recommendedFor: string[];
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
}

export interface UserAIPreferences {
  preferred_model?: string;
  provider_preference?: 'openrouter' | 'gemini' | 'auto';
  subscription_tier: 'free' | 'pro';
}

export interface ModelsResponse {
  models: AIModel[];
  user_preferences: UserAIPreferences;
}

export interface UpdatePreferencesRequest {
  preferred_ai_model?: string;
  ai_provider_preference?: 'openrouter' | 'gemini' | 'auto';
}

class AIModelService {
  /**
   * Get available AI models for the current user
   */
  async getAvailableModels(freeOnly?: boolean, provider?: 'openrouter' | 'gemini'): Promise<ModelsResponse> {
    const params = new URLSearchParams();
    if (freeOnly) params.append('free_only', 'true');
    if (provider) params.append('provider', provider);

    const response = await apiClient.get<{success: boolean; data: ModelsResponse}>(`/ai/models?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Get only free models
   */
  async getFreeModels(): Promise<ModelsResponse> {
    return this.getAvailableModels(true);
  }

  /**
   * Get models by provider
   */
  async getModelsByProvider(provider: 'openrouter' | 'gemini'): Promise<ModelsResponse> {
    return this.getAvailableModels(false, provider);
  }

  /**
   * Update user AI preferences
   */
  async updatePreferences(preferences: UpdatePreferencesRequest): Promise<UserAIPreferences> {
    const response = await apiClient.put<{success: boolean; data: UserAIPreferences}>('/ai/preferences', preferences);
    return response.data.data;
  }

  /**
   * Get current user preferences
   */
  async getUserPreferences(): Promise<UserAIPreferences> {
    const response = await this.getAvailableModels();
    return response.user_preferences;
  }

  /**
   * Test AI model with a simple request
   */
  async testModel(modelId: string): Promise<boolean> {
    try {
      // Temporarily update to the test model
      const currentPreferences = await this.getUserPreferences();
      
      await this.updatePreferences({ 
        preferred_ai_model: modelId 
      });

      // Test with a simple analysis
      const testResponse = await apiClient.post<{success: boolean; data: any}>('/ai/analyze', {
        name: 'Test Project',
        description: 'Simple test to verify AI model functionality',
        type: 'general',
        scope: 'small'
      });

      // Restore original preferences
      await this.updatePreferences({
        preferred_ai_model: currentPreferences.preferred_model
      });

      return testResponse.data.success;
    } catch (error) {
      console.error('Model test failed:', error);
      return false;
    }
  }

  /**
   * Get recommended models based on use case
   */
  async getRecommendedModels(useCase: string): Promise<AIModel[]> {
    const response = await this.getAvailableModels();
    return response.models.filter(model => 
      model.recommendedFor.some(rec => 
        rec.toLowerCase().includes(useCase.toLowerCase())
      )
    );
  }

  /**
   * Format model information for display
   */
  formatModelInfo(model: AIModel): string {
    const features = [];
    
    if (model.isFree) {
      features.push('Free');
    } else if (model.costPer1MTokens) {
      features.push(`$${model.costPer1MTokens}/1M tokens`);
    }
    
    features.push(`${model.speed} speed`);
    features.push(`${model.quality} quality`);
    features.push(`${model.maxTokens.toLocaleString()} max tokens`);
    
    return `${model.name} - ${features.join(', ')}`;
  }

  /**
   * Get cost estimate for model usage
   */
  estimateCost(model: AIModel, estimatedTokens: number): string {
    if (model.isFree) return 'Free';
    if (!model.costPer1MTokens) return 'Cost varies';
    
    const cost = (estimatedTokens / 1000000) * model.costPer1MTokens;
    if (cost < 0.01) return '< $0.01';
    return `~$${cost.toFixed(2)}`;
  }

  /**
   * Check if user can access model based on subscription
   */
  canAccessModel(model: AIModel, userTier: 'free' | 'pro'): boolean {
    if (userTier === 'pro') return true;
    return model.isFree;
  }
}

export const aiModelService = new AIModelService();
export default aiModelService; 