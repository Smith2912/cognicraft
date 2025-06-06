import React, { useState } from 'react';
import AIModelSelector from '../AIModelSelector';
import { aiModelService } from '../../services/aiModelService';

/**
 * Example component showing how to integrate AI Model Selection
 * This demonstrates best practices for:
 * 1. Adding model selector to app settings/preferences
 * 2. Triggering model updates 
 * 3. Showing current model info to users
 */
const AIModelIntegrationExample: React.FC = () => {
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [modelInfo, setModelInfo] = useState<string>('Loading...');

  // Load current model info on component mount
  React.useEffect(() => {
    loadCurrentModelInfo();
  }, []);

  const loadCurrentModelInfo = async () => {
    try {
      const preferences = await aiModelService.getUserPreferences();
      setCurrentModel(preferences.preferred_model || 'Default');
      
      if (preferences.preferred_model) {
        const models = await aiModelService.getAvailableModels();
        const model = models.models.find(m => m.id === preferences.preferred_model);
        if (model) {
          setModelInfo(aiModelService.formatModelInfo(model));
        }
      }
    } catch (error) {
      console.error('Failed to load model info:', error);
      setModelInfo('Unable to load model information');
    }
  };

  const handleModelChanged = (newModelId: string) => {
    setCurrentModel(newModelId);
    loadCurrentModelInfo(); // Refresh model info
    
    // You might want to show a success message or trigger other updates
    console.log('AI model updated to:', newModelId);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">AI Model Integration Example</h1>
      
      {/* Current Model Display */}
      <div className="bg-gray-50 border rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Current AI Model</h3>
        <p className="text-gray-700 text-sm">{modelInfo}</p>
        <button
          onClick={() => setShowModelSelector(true)}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          Change Model
        </button>
      </div>

      {/* Settings Section Example */}
      <div className="border rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">AI Model Preferences</span>
            <button
              onClick={() => setShowModelSelector(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Configure
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Current Model</span>
            <span className="text-gray-500 text-sm">{currentModel}</span>
          </div>
        </div>
      </div>

      {/* Header Integration Example */}
      <div className="border rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Header Integration</h3>
        <div className="flex items-center justify-between bg-white border rounded p-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">CogniCraft</span>
            <span className="text-sm text-gray-500">AI: {currentModel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModelSelector(true)}
              className="text-gray-600 hover:text-gray-800 text-sm"
              title="Change AI Model"
            >
              🤖 Model
            </button>
            <button className="text-gray-600 hover:text-gray-800 text-sm">
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Usage in Project Analysis */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Project Analysis Usage</h3>
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-blue-800 text-sm mb-2">
            <strong>Pro Tip:</strong> Different models excel at different tasks:
          </p>
          <ul className="text-blue-700 text-xs space-y-1">
            <li>• <strong>GPT-3.5 Turbo</strong>: Fast, good for general development planning</li>
            <li>• <strong>Mistral 7B</strong>: Excellent for code analysis and task breakdown</li>
            <li>• <strong>WizardLM 2</strong>: Best for complex project planning and architecture</li>
            <li>• <strong>Claude 3.5 Sonnet</strong>: Premium option for production projects</li>
          </ul>
        </div>
      </div>

      {/* AI Model Selector Modal */}
      <AIModelSelector
        isOpen={showModelSelector}
        onClose={() => setShowModelSelector(false)}
        onModelChanged={handleModelChanged}
      />
    </div>
  );
};

export default AIModelIntegrationExample; 