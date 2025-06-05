# OpenRouter Setup Guide for CogniCraft

## Overview

CogniCraft now uses OpenRouter to provide access to multiple Large Language Models (LLMs) instead of just Google Gemini. This gives users the flexibility to choose from over 50+ different AI models based on their needs, budget, and preferences.

## Benefits of OpenRouter

- **Multiple Model Access**: Choose from 50+ models including GPT-4, Claude, Gemini, DeepSeek, Llama, and more
- **Cost Flexibility**: Free models available, plus competitive pricing for premium models
- **No Vendor Lock-in**: Switch between models without changing your code
- **Better Availability**: Automatic fallback to other providers if one is down

## Setup Instructions

### 1. Get an OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Click "Sign Up" or "Login" (you can use Google, GitHub, or MetaMask)
3. Once logged in, go to your dashboard
4. Click on "API Keys" in the sidebar
5. Create a new API key and copy it

### 2. Configure the Backend

1. Copy the example environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit the `.env` file and add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
   ```

3. (Optional) Change the default model:
   ```
   DEFAULT_LLM_MODEL=google/gemini-2.0-flash-exp:free
   ```

### 3. Available Models

The application comes pre-configured with popular models:

#### Free Models
- **Google Gemini 2.0 Flash (Free)** - Fast responses, good for general tasks
  - Model ID: `google/gemini-2.0-flash-exp:free`
  - Context: 1M tokens

#### Premium Models
- **Claude 3.5 Sonnet** - Best for complex reasoning and coding
  - Model ID: `anthropic/claude-3.5-sonnet`
  - Pricing: $3/M input, $15/M output tokens

- **GPT-4o** - OpenAI's latest multimodal model
  - Model ID: `openai/gpt-4o`
  - Pricing: $2.5/M input, $10/M output tokens

- **DeepSeek Chat** - Efficient for coding tasks
  - Model ID: `deepseek/deepseek-chat`
  - Pricing: $0.14/M input, $0.28/M output tokens

- **Llama 3.3 70B** - Open source, good general performance
  - Model ID: `meta-llama/llama-3.3-70b-instruct`
  - Pricing: $0.8/M tokens

### 4. Usage

Once configured, users can:

1. **Select a Model**: Use the model selector in the app header to choose an LLM
2. **Start Planning**: The selected model will be used for all AI interactions
3. **Switch Models**: Change models anytime without losing your work

### 5. Cost Management

- **Free Tier**: Start with free models like Gemini 2.0 Flash
- **Usage Tracking**: Monitor your usage on the OpenRouter dashboard
- **Prepaid Credits**: Add credits to your account as needed
- **No Surprise Bills**: OpenRouter uses prepaid credits, so you control spending

### 6. Troubleshooting

**"Failed to fetch available models" error**
- Check that your API key is correctly set in the backend `.env` file
- Ensure the backend server is running and accessible

**"Failed to generate response" error**
- Verify you have credits in your OpenRouter account
- Check if the selected model is available and not experiencing downtime
- Try switching to a different model

**Model responses seem different**
- Each model has different strengths and personalities
- Adjust your prompts based on the model you're using
- Experiment to find the best model for your use case

## Additional Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Model Comparison](https://openrouter.ai/models)
- [OpenRouter Discord](https://discord.gg/openrouter)

## Privacy & Security

- Your API key is stored securely in the backend only
- Chat conversations are processed through OpenRouter's secure API
- OpenRouter doesn't train on your data by default
- Review each model's privacy policy for specific details