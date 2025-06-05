# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Features

- **Multiple LLM Support**: Choose from 50+ AI models through OpenRouter integration
- **Visual Project Planning**: Create and organize tasks with an intuitive node-based canvas
- **AI-Powered Assistant**: Get help breaking down projects and generating development briefs
- **Real-time Collaboration**: Work with AI to plan complex software projects
- **Export to Markdown**: Generate comprehensive project documentation

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
   
2. Set up the backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```
   
3. Configure OpenRouter:
   - Get your API key from [OpenRouter.ai](https://openrouter.ai/)
   - Add it to `backend/.env`: `OPENROUTER_API_KEY=your-key-here`
   - See [OPENROUTER_SETUP.md](./OPENROUTER_SETUP.md) for detailed instructions
   
4. Run the backend:
   ```bash
   cd backend
   npm run dev
   ```
   
5. Run the frontend (in a new terminal):
   ```bash
   npm run dev
   ```

## Deploy

This project has been designed to deploy with the Bolt DIY deployment
platform.

[![Deploy with Bolt](https://imagedelivery.net/T0n1xG6x93C3KYL5C3dvcw/58ed6187-4e0a-481e-8166-d2ef06850c00/public)](https://www.diy.bolt.new/share/66fbacf3-e5d1-410a-ad86-04e7d78c59ce)

## Model Selection

CogniCraft supports multiple AI models through OpenRouter:

- **Free Models**: Google Gemini 2.0 Flash (default)
- **Premium Models**: GPT-4o, Claude 3.5 Sonnet, DeepSeek, Llama 3.3, and more
- **Easy Switching**: Change models anytime from the header dropdown

See [OPENROUTER_SETUP.md](./OPENROUTER_SETUP.md) for the complete list of available models and their capabilities.
