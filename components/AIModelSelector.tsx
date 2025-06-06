import React, { useState, useEffect } from 'react';
import { 
  aiModelService, 
  type AIModel, 
  type UserAIPreferences, 
  type ModelsResponse 
} from '../services/aiModelService';

interface AIModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onModelChanged?: (modelId: string) => void;
}

// Global flag to prevent multiple concurrent API calls across all instances
let isGloballyLoading = false;
let globalModelsCache: {
  models: AIModel[];
  userPreferences: UserAIPreferences;
  isLocalMode: boolean;
} | null = null;

// Fallback models for local/development mode
const FALLBACK_MODELS: AIModel[] = [
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
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Faster version of Gemini with good performance.',
    isFree: true,
    maxTokens: 1048576,
    capabilities: ['chat', 'analysis', 'coding'],
    recommendedFor: ['Development', 'Quick Analysis'],
    speed: 'fast',
    quality: 'good'
  },
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
  }
];

const FALLBACK_PREFERENCES: UserAIPreferences = {
  preferred_model: 'openai/gpt-3.5-turbo',
  provider_preference: 'auto',
  subscription_tier: 'free'
};

const AIModelSelector: React.FC<AIModelSelectorProps> = ({ 
  isOpen, 
  onClose, 
  onModelChanged 
}) => {
  const [models, setModels] = useState<AIModel[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserAIPreferences | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [filter, setFilter] = useState<'all' | 'free' | 'premium'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && !hasLoadedOnce) {
      loadModels();
    }
  }, [isOpen, hasLoadedOnce]);

  const loadModels = async () => {
    if (loading || isGloballyLoading) return; // Prevent concurrent calls
    
    // Use cached data if available
    if (globalModelsCache) {
      setModels(globalModelsCache.models);
      setUserPreferences(globalModelsCache.userPreferences);
      setSelectedModel(globalModelsCache.userPreferences.preferred_model || '');
      setSelectedProvider(globalModelsCache.userPreferences.provider_preference || 'auto');
      setIsLocalMode(globalModelsCache.isLocalMode);
      setHasLoadedOnce(true);
      return;
    }
    
    try {
      setLoading(true);
      isGloballyLoading = true;
      const response: ModelsResponse = await aiModelService.getAvailableModels();
      
      // Cache the successful response
      globalModelsCache = {
        models: response.models,
        userPreferences: response.user_preferences,
        isLocalMode: false
      };
      
      setModels(response.models);
      setUserPreferences(response.user_preferences);
      setSelectedModel(response.user_preferences.preferred_model || '');
      setSelectedProvider(response.user_preferences.provider_preference || 'auto');
      setIsLocalMode(false);
      setHasLoadedOnce(true);
    } catch (error) {
      console.warn('Backend AI models API not available, using fallback models for local mode:', error);
      
      // Use fallback data for local/development mode
      const fallbackData = {
        models: FALLBACK_MODELS,
        userPreferences: FALLBACK_PREFERENCES,
        isLocalMode: true
      };
      
      // Try to load preferences from localStorage
      const savedPreferences = localStorage.getItem('cognicraft_ai_preferences');
      let preferences = FALLBACK_PREFERENCES;
      
      if (savedPreferences) {
        try {
          preferences = { ...FALLBACK_PREFERENCES, ...JSON.parse(savedPreferences) };
          fallbackData.userPreferences = preferences;
        } catch (e) {
          console.warn('Failed to parse saved AI preferences, using defaults');
        }
      }
      
      // Cache the fallback response
      globalModelsCache = fallbackData;
      
      setModels(fallbackData.models);
      setUserPreferences(fallbackData.userPreferences);
      setSelectedModel(preferences.preferred_model || 'openai/gpt-3.5-turbo');
      setSelectedProvider(preferences.provider_preference || 'auto');
      setIsLocalMode(true);
      setHasLoadedOnce(true);
    } finally {
      setLoading(false);
      isGloballyLoading = false;
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (isLocalMode) {
        // Save to localStorage in local mode
        const preferences: UserAIPreferences = {
          preferred_model: selectedModel,
          provider_preference: selectedProvider,
          subscription_tier: 'free' // Default to free in local mode
        };
        
        localStorage.setItem('cognicraft_ai_preferences', JSON.stringify(preferences));
        setUserPreferences(preferences);
        
        console.log('[Local Mode] AI preferences saved to localStorage:', preferences);
      } else {
        // Save via backend API when authenticated
        await aiModelService.updatePreferences({
          preferred_ai_model: selectedModel,
          ai_provider_preference: selectedProvider
        });
      }
      
      if (onModelChanged) {
        onModelChanged(selectedModel);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestModel = async (modelId: string) => {
    try {
      setTestingModel(modelId);
      
      if (isLocalMode) {
        // Simulate test in local mode
        await new Promise(resolve => setTimeout(resolve, 1000));
        alert('Model test simulated successfully! (Local mode)');
      } else {
        const success = await aiModelService.testModel(modelId);
        if (success) {
          alert('Model test successful!');
        } else {
          alert('Model test failed. Please try a different model.');
        }
      }
    } catch (error) {
      console.error('Model test failed:', error);
      alert('Model test failed. Please try again.');
    } finally {
      setTestingModel(null);
    }
  };

  const filteredModels = models.filter(model => {
    if (filter === 'free') return model.isFree;
    if (filter === 'premium') return !model.isFree;
    return true;
  });

  const getModelIcon = (provider: string) => {
    return provider === 'openrouter' ? '🚀' : '🤖';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'basic': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getSpeedColor = (speed: string) => {
    switch (speed) {
      case 'fast': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'slow': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Model Selection</h2>
            <p className="text-gray-600 mt-1">
              Choose your preferred AI model for project analysis and planning
              {isLocalMode && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Local Mode
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading models...</span>
            </div>
          ) : (
            <>
              {/* Local Mode Notice */}
              {isLocalMode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-yellow-900 mb-2">🔧 Development Mode</h3>
                  <p className="text-yellow-800 text-sm">
                    Running in local mode. AI model preferences will be saved locally. 
                    Sign in to sync preferences across devices and access the full backend features.
                  </p>
                </div>
              )}

              {/* Current Preferences */}
              {userPreferences && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-blue-900 mb-2">Current Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Model:</span>
                      <span className="ml-2 font-medium">
                        {models.find(m => m.id === userPreferences.preferred_model)?.name || 'Default'}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700">Provider:</span>
                      <span className="ml-2 font-medium capitalize">
                        {userPreferences.provider_preference}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700">Plan:</span>
                      <span className="ml-2 font-medium capitalize">
                        {userPreferences.subscription_tier}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Provider Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider Preference
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto (Best Available)</option>
                  <option value="openrouter">OpenRouter (Multiple Models)</option>
                  <option value="gemini">Google Gemini</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Auto will use the best available provider based on your selection
                </p>
              </div>

              {/* Filter Options */}
              <div className="mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Filter:</span>
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 rounded text-sm ${
                      filter === 'all' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    All Models ({models.length})
                  </button>
                  <button
                    onClick={() => setFilter('free')}
                    className={`px-3 py-1 rounded text-sm ${
                      filter === 'free' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Free Models ({models.filter(m => m.isFree).length})
                  </button>
                  <button
                    onClick={() => setFilter('premium')}
                    className={`px-3 py-1 rounded text-sm ${
                      filter === 'premium' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Premium Models ({models.filter(m => !m.isFree).length})
                  </button>
                </div>
              </div>

              {/* Model List */}
              <div className="space-y-3">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedModel === model.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedModel(model.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getModelIcon(model.provider)}</span>
                          <h4 className="text-lg font-medium text-gray-900">
                            {model.name}
                          </h4>
                          {model.isFree && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              Free
                            </span>
                          )}
                          {!model.isFree && model.costPer1MTokens && (
                            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                              ${model.costPer1MTokens}/1M tokens
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3">{model.description}</p>
                        
                        <div className="flex items-center gap-3 text-xs mb-2">
                          <span className={`px-2 py-1 rounded ${getSpeedColor(model.speed)}`}>
                            {model.speed} speed
                          </span>
                          <span className={`font-medium ${getQualityColor(model.quality)}`}>
                            {model.quality} quality
                          </span>
                          <span className="text-gray-500">
                            {model.maxTokens.toLocaleString()} max tokens
                          </span>
                        </div>
                        
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">Best for: </span>
                          <span className="text-xs text-gray-700">
                            {model.recommendedFor.join(', ')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <input
                          type="radio"
                          checked={selectedModel === model.id}
                          onChange={() => setSelectedModel(model.id)}
                          className="text-blue-600"
                        />
                        {model.id !== userPreferences?.preferred_model && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestModel(model.id);
                            }}
                            disabled={testingModel === model.id}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
                          >
                            {testingModel === model.id ? 'Testing...' : 'Test'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {userPreferences?.subscription_tier === 'free' && !isLocalMode && (
              <span>Free plan: Limited to free models. 
                <a href="#" className="text-blue-600 hover:underline ml-1">Upgrade to Pro</a>
              </span>
            )}
            {isLocalMode && (
              <span>Local mode: All models available for testing</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedModel}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIModelSelector; 