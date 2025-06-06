# OpenRouter Setup Guide for CogniCraft

## 🤖 Why OpenRouter?

OpenRouter provides access to the best AI models through a single API, including:
- **Claude 3.5 Sonnet** (Anthropic) - Excellent for code and reasoning
- **GPT-4 Turbo** (OpenAI) - Great all-around performance  
- **Gemini Pro** (Google) - Good balance of speed and quality
- **Claude 3 Opus** (Anthropic) - Best for complex tasks
- **Many more models** with competitive pricing

## 🚀 Quick Setup

### 1. Get Your OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai)
2. Sign up or log in to your account
3. Go to [API Keys](https://openrouter.ai/keys)
4. Click **"Create Key"**
5. Give it a name like "CogniCraft Development"
6. Copy the API key (starts with `sk-or-v1-...`)

### 2. Configure Backend

Add these to your `backend/.env` file:

```env
# AI Configuration
AI_PROVIDER=openrouter

# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your_actual_api_key_here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_SITE_URL=https://cognicraft.ai
OPENROUTER_APP_NAME=CogniCraft

# Optional: Gemini fallback
GEMINI_API_KEY=your_gemini_key_here
```

### 3. Test the Integration

```bash
# Start the backend
cd backend
npm run dev

# In another terminal, test the AI endpoint
curl -X GET http://localhost:3001/api/v1/ai/status
```

You should see:
```json
{
  "available": true,
  "message": "AI service is available"
}
```

## 🎯 Recommended Models

### For Development Planning (Default)
```env
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```
- **Best for:** Code analysis, project planning, task breakdown
- **Speed:** Fast
- **Cost:** Medium

### For High-Quality Analysis
```env
OPENROUTER_MODEL=anthropic/claude-3-opus-20240229
```
- **Best for:** Complex project analysis, detailed planning
- **Speed:** Slower
- **Cost:** Higher

### For Speed & Cost Efficiency
```env
OPENROUTER_MODEL=openai/gpt-3.5-turbo
```
- **Best for:** Quick suggestions, simple tasks
- **Speed:** Very fast
- **Cost:** Low

### For Balanced Performance
```env
OPENROUTER_MODEL=openai/gpt-4-turbo
```
- **Best for:** General use, good balance
- **Speed:** Medium
- **Cost:** Medium

## 💰 Cost Management

### Free Tier
- OpenRouter provides **$1 free credit** for new accounts
- Perfect for testing and small projects

### Usage Monitoring
1. Visit [OpenRouter Dashboard](https://openrouter.ai/activity)
2. Monitor your usage and costs
3. Set up billing alerts

### Cost Optimization Tips
- Use `gpt-3.5-turbo` for development/testing
- Switch to `claude-3.5-sonnet` for production
- Monitor token usage in the dashboard

## 🔄 Fallback Configuration

CogniCraft supports automatic fallback to Gemini if OpenRouter fails:

```env
# Primary provider
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...

# Fallback provider
GEMINI_API_KEY=your_gemini_key
```

## 🛠️ Advanced Configuration

### Custom Models
OpenRouter supports many models. Check [available models](https://openrouter.ai/models) and update:

```env
# For Anthropic's latest
OPENROUTER_MODEL=anthropic/claude-3-5-sonnet-20241022

# For OpenAI's latest
OPENROUTER_MODEL=openai/gpt-4o

# For Google's latest
OPENROUTER_MODEL=google/gemini-pro-1.5
```

### Multiple Environments

#### Development
```env
AI_PROVIDER=openrouter
OPENROUTER_MODEL=openai/gpt-3.5-turbo  # Cheap for testing
```

#### Production
```env
AI_PROVIDER=openrouter
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet  # Best quality
```

## 🐛 Troubleshooting

### "AI service is not available"
1. Check your API key in `.env`
2. Verify the key works: `curl -H "Authorization: Bearer sk-or-v1-..." https://openrouter.ai/api/v1/auth/key`
3. Check the backend logs for error messages

### Rate Limiting
- OpenRouter has rate limits per model
- Free tier: ~200 requests/day
- If rate limited, requests will fall back to Gemini

### Model Not Found
- Check [OpenRouter models](https://openrouter.ai/models) for exact names
- Model names are case-sensitive
- Include the provider prefix (e.g., `anthropic/claude-3.5-sonnet`)

### High Costs
- Switch to cheaper models for development
- Use shorter prompts when possible
- Monitor usage in the OpenRouter dashboard

## 🔐 Security Best Practices

1. **Never commit API keys** - Use `.env` files
2. **Rotate keys regularly** - Generate new keys periodically
3. **Use separate keys** - Different keys for dev/prod
4. **Monitor usage** - Watch for unexpected activity
5. **Set spending limits** - Configure billing alerts

## 📊 Model Comparison

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| GPT-3.5 Turbo | ⚡⚡⚡ | ⭐⭐ | 💰 | Testing, simple tasks |
| GPT-4 Turbo | ⚡⚡ | ⭐⭐⭐⭐ | 💰💰 | General use |
| Claude 3.5 Sonnet | ⚡⚡ | ⭐⭐⭐⭐⭐ | 💰💰 | Code, reasoning |
| Claude 3 Opus | ⚡ | ⭐⭐⭐⭐⭐ | 💰💰💰 | Complex analysis |

## 🆘 Support

- **OpenRouter Docs:** https://openrouter.ai/docs
- **CogniCraft Issues:** Create a GitHub issue
- **Discord/Community:** [Link to community]

---

## ✅ Quick Verification

After setup, test these features in CogniCraft:

1. **Project Analysis** - Create a new project and use AI analysis
2. **Task Breakdown** - Ask AI to break down a complex task
3. **Workflow Optimization** - Get AI suggestions for task flow
4. **Chat Assistant** - Ask questions about your project

If all work correctly, you're ready to go! 🎉 