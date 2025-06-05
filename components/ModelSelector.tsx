import * as React from 'react';
import { useEffect, useState } from 'react';
import { LLMModel, llmService } from '../services/llmService';

interface ModelSelectorProps {
  onModelChange?: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange }) => {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(llmService.getSelectedModel());
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const availableModels = await llmService.getAvailableModels();
      setModels(availableModels);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load models:', error);
      setLoading(false);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    llmService.setSelectedModel(modelId);
    setIsOpen(false);
    onModelChange?.(modelId);
  };

  const currentModel = models.find((m: LLMModel) => m.id === selectedModel);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-darkTextSecondary">
        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="text-sm">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md bg-darkCard hover:bg-darkSurface transition-colors duration-200 border border-darkBorder"
      >
        <svg className="w-4 h-4 text-darkAccent" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="text-sm text-darkTextPrimary">
          {currentModel?.name || 'Select Model'}
        </span>
        <svg 
          className={`w-4 h-4 text-darkTextSecondary transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-80 bg-darkCard border border-darkBorder rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model.id)}
                className={`w-full text-left px-4 py-3 hover:bg-darkSurface transition-colors duration-200 ${
                  model.id === selectedModel ? 'bg-darkSurface' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-darkTextPrimary">
                      {model.name}
                    </div>
                    {model.description && (
                      <div className="text-xs text-darkTextSecondary mt-1">
                        {model.description}
                      </div>
                    )}
                    {model.capabilities && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {model.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="text-xs px-2 py-0.5 bg-darkBg rounded-full text-darkTextSecondary"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {model.pricing && (
                    <div className="text-xs text-darkTextSecondary ml-3">
                      {model.pricing.prompt === 0 ? (
                        <span className="text-green-400 font-medium">Free</span>
                      ) : (
                        <span>${model.pricing.prompt}/M tokens</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};