# AI Model Selection Feature

## Overview

CogniCraft now supports user-configurable AI models with a focus on **free, high-quality options**. Users can select their preferred AI model and provider, with automatic cost protection for free tier users.

## 🆓 Available Free Models

### OpenRouter Free Models
1. **GPT-3.5 Turbo** - Fast and capable for most development tasks
2. **Mistral 7B Instruct** - Excellent for code analysis and task planning  
3. **WizardLM 2 8x22B** - Powerful reasoning for complex project planning
4. **Nous Capybara 7B** - Fine-tuned for conversation and coding
5. **Zephyr 7B Beta** - Optimized for helpful responses

### Gemini Free Models
- **Gemini 1.5 Flash** - Fast version with good performance

## 🏗️ Architecture

### Backend Components

#### 1. Database Schema (`User` model)
```typescript
interface UserAttributes {
  // ... existing fields
  preferred_ai_model?: string;
  ai_provider_preference?: 'openrouter' | 'gemini' | 'auto';
}
```

#### 2. AI Models Configuration (`aiModels.ts`)
```typescript
interface AIModelInfo {
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
```

#### 3. Enhanced AI Service
- User-specific model selection per request
- Automatic fallback to appropriate defaults
- Subscription tier validation
- Provider preference handling

#### 4. API Routes (`/ai/*`)
- `GET /ai/models` - Get available models for user
- `PUT /ai/preferences` - Update user AI preferences  
- `POST /ai/analyze` - Analyze project with user's preferred model

### Frontend Components

#### 1. AI Model Service (`aiModelService.ts`)
```typescript
class AIModelService {
  async getAvailableModels(): Promise<ModelsResponse>
  async updatePreferences(preferences: UpdatePreferencesRequest): Promise<UserAIPreferences>
  async testModel(modelId: string): Promise<boolean>
  formatModelInfo(model: AIModel): string
  estimateCost(model: AIModel, estimatedTokens: number): string
}
```

#### 2. AI Model Selector Component (`AIModelSelector.tsx`)
- Beautiful modal interface for model selection
- Real-time filtering (all/free/premium)
- Provider preference settings
- Model testing capabilities
- Cost information display
- Subscription tier restrictions

## 🚀 Usage

### Basic Integration

```typescript
import AIModelSelector from './components/AIModelSelector';
import { aiModelService } from './services/aiModelService';

function App() {
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  const handleModelChanged = (modelId: string) => {
    console.log('Model updated to:', modelId);
    // Refresh any AI-dependent components
  };

  return (
    <div>
      <button onClick={() => setShowModelSelector(true)}>
        🤖 Change AI Model
      </button>
      
      <AIModelSelector
        isOpen={showModelSelector}
        onClose={() => setShowModelSelector(false)}
        onModelChanged={handleModelChanged}
      />
    </div>
  );
}
```

### Getting Current Model Info

```typescript
const loadModelInfo = async () => {
  const preferences = await aiModelService.getUserPreferences();
  const models = await aiModelService.getAvailableModels();
  const currentModel = models.models.find(m => m.id === preferences.preferred_model);
  
  if (currentModel) {
    const info = aiModelService.formatModelInfo(currentModel);
    console.log('Current model:', info);
  }
};
```

### Testing Models

```typescript
const testModel = async (modelId: string) => {
  const success = await aiModelService.testModel(modelId);
  if (success) {
    console.log('Model test successful!');
  } else {
    console.log('Model test failed');
  }
};
```

## 🔒 Security & Cost Protection

### Free Tier Protection
- Free users can only select free models
- API validates model selection against subscription tier
- Automatic fallback to free models if premium selected

### Model Validation
- Server-side validation of model IDs
- Provider compatibility checking
- Graceful fallback to defaults on invalid selections

### Cost Management
- Clear cost information displayed for premium models
- Usage estimation tools
- Free model recommendations

## 🎯 Default Model Strategy

### Free Users
- **Default**: GPT-3.5 Turbo (fast, reliable)
- **Analysis**: WizardLM 2 8x22B (better reasoning)
- **Fallback**: Gemini 1.5 Flash

### Pro Users  
- **Default**: Claude 3.5 Sonnet (premium quality)
- **Development**: GPT-3.5 Turbo (cost-effective)
- **Production**: Claude 3.5 Sonnet or GPT-4 Turbo

## 📊 Model Recommendations

### By Use Case

**General Development**
- GPT-3.5 Turbo (free, fast)
- Mistral 7B Instruct (free, good quality)

**Complex Project Planning**  
- WizardLM 2 8x22B (free, excellent reasoning)
- Claude 3.5 Sonnet (premium, best quality)

**Code Analysis**
- Mistral 7B Instruct (free, code-focused)
- Claude 3.5 Sonnet (premium, superior analysis)

**Quick Tasks**
- GPT-3.5 Turbo (free, fastest)
- Gemini 1.5 Flash (free, fast)

### By Speed vs Quality

**Speed Priority**
1. GPT-3.5 Turbo (free)
2. Gemini 1.5 Flash (free)
3. Nous Capybara 7B (free)

**Quality Priority**
1. WizardLM 2 8x22B (free)
2. Claude 3.5 Sonnet (premium)
3. GPT-4 Turbo (premium)

**Balanced**
1. Mistral 7B Instruct (free)
2. GPT-3.5 Turbo (free)

## 🔧 Configuration

### Environment Variables

```bash
# Backend (.env)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-1.5-pro
```

### Database Migration

```sql
-- Add AI preference columns
ALTER TABLE users 
ADD COLUMN preferred_ai_model VARCHAR(255) DEFAULT 'openai/gpt-3.5-turbo',
ADD COLUMN ai_provider_preference VARCHAR(20) DEFAULT 'auto';

-- Update existing users with defaults
UPDATE users 
SET preferred_ai_model = CASE 
  WHEN subscription_tier = 'free' THEN 'openai/gpt-3.5-turbo'
  ELSE 'anthropic/claude-3.5-sonnet'
END;
```

## 🧪 Testing

### Model Testing Flow
1. User selects a model in the UI
2. Clicks "Test" button
3. System temporarily switches to test model
4. Sends simple analysis request
5. Restores original model
6. Reports success/failure

### API Testing

```bash
# Get available models
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/ai/models

# Update preferences  
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preferred_ai_model": "mistralai/mistral-7b-instruct"}' \
  http://localhost:3001/ai/preferences

# Test analysis with user model
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "description": "Test project"}' \
  http://localhost:3001/ai/analyze
```

## 🚀 Future Enhancements

### Planned Features
- [ ] Usage analytics per model
- [ ] Cost tracking and budgets
- [ ] Model performance metrics
- [ ] Custom model fine-tuning
- [ ] Team model preferences
- [ ] A/B testing between models

### Integration Opportunities
- [ ] Model recommendations based on project type
- [ ] Automatic model switching based on task complexity
- [ ] Integration with project templates
- [ ] Model-specific prompt optimization

## 📈 Benefits

### For Users
- **Cost Control**: Access to powerful free models
- **Flexibility**: Choose the right model for each task
- **Transparency**: Clear information about model capabilities
- **Testing**: Try before committing to a model

### For Development
- **Scalability**: Support for multiple AI providers
- **Monetization**: Clear upgrade path to premium models
- **Analytics**: Track model usage and preferences
- **Reliability**: Fallback systems ensure AI always works

## 🎉 Getting Started

1. **For Free Users**: Start with GPT-3.5 Turbo or try WizardLM 2 for complex tasks
2. **For Pro Users**: Claude 3.5 Sonnet offers the best quality for production work
3. **For Developers**: Mistral 7B Instruct excels at code analysis
4. **For Testing**: Use the built-in test feature to compare models

The AI model selection feature puts the power of choice in users' hands while maintaining cost protection and ensuring reliable AI functionality across all subscription tiers. 