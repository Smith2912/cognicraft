import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { getModelById, DEFAULT_MODELS, type AIModelInfo } from '../config/aiModels.js';
import type { User } from '../models/User.js';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ProjectAnalysisRequest {
  projectName: string;
  githubRepoUrl?: string;
  existingNodes?: Array<{
    title: string;
    description?: string;
    status: string;
  }>;
  projectType?: 'web-app' | 'mobile-app' | 'game' | 'mod' | 'other';
  additionalContext?: string;
}

export interface ProjectSuggestion {
  suggestedNodes: Array<{
    id: string;
    title: string;
    description: string;
    estimatedHours: number;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    tags: string[];
  }>;
  suggestedEdges: Array<{
    id: string;
    source: string;
    target: string;
    type: 'dependency' | 'sequence' | 'optional';
  }>;
  recommendations: string[];
}

class AIService {
  private openai: OpenAI | null = null;
  private genAI: GoogleGenerativeAI | null = null;
  private geminiModel: any = null;
  private activeProvider: 'openrouter' | 'gemini' | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Try OpenRouter first (preferred)
    if (config.OPENROUTER_API_KEY && config.AI_PROVIDER === 'openrouter') {
      try {
        this.openai = new OpenAI({
          apiKey: config.OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': config.OPENROUTER_SITE_URL,
            'X-Title': config.OPENROUTER_APP_NAME,
          },
        });
        this.activeProvider = 'openrouter';
        console.log(`✅ OpenRouter AI service initialized with model: ${config.OPENROUTER_MODEL}`);
      } catch (error) {
        console.error('❌ Failed to initialize OpenRouter AI:', error);
      }
    }

    // Initialize Gemini as fallback
    if (config.GEMINI_API_KEY && (!this.activeProvider || config.AI_PROVIDER === 'gemini')) {
      try {
        this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
        this.geminiModel = this.genAI.getGenerativeModel({ model: config.GEMINI_MODEL });
        
        if (!this.activeProvider) {
          this.activeProvider = 'gemini';
          console.log(`✅ Gemini AI service initialized as primary with model: ${config.GEMINI_MODEL}`);
        } else {
          console.log(`✅ Gemini AI service initialized as fallback`);
        }
      } catch (error) {
        console.error('❌ Failed to initialize Gemini AI:', error);
      }
    }

    if (!this.activeProvider) {
      console.warn('⚠️  No AI providers available - AI features will be disabled');
    }
  }

  public isAvailable(): boolean {
    return this.activeProvider !== null;
  }

  public getActiveProvider(): string {
    return this.activeProvider || 'none';
  }

  // Get the model to use for a specific user
  public getUserModel(user?: User): { model: string; provider: 'openrouter' | 'gemini' } {
    // If no user provided, use system defaults
    if (!user) {
      return {
        model: config.OPENROUTER_MODEL,
        provider: this.activeProvider === 'gemini' ? 'gemini' : 'openrouter'
      };
    }

    // Check user's AI provider preference
    const preferredProvider = user.ai_provider_preference || 'auto';
    let targetProvider: 'openrouter' | 'gemini';

    if (preferredProvider === 'auto') {
      // Use the active provider (OpenRouter first, then Gemini)
      targetProvider = this.activeProvider === 'gemini' ? 'gemini' : 'openrouter';
    } else {
      targetProvider = preferredProvider;
    }

    // Get user's preferred model or use defaults
    let modelId = user.preferred_ai_model;
    
    if (!modelId) {
      // Use appropriate default based on subscription
      if (user.subscription_tier === 'free') {
        modelId = DEFAULT_MODELS.FREE_DEVELOPMENT;
      } else {
        modelId = DEFAULT_MODELS.PREMIUM_PRODUCTION;
      }
    }

    // Validate the model exists and is compatible with the provider
    const modelInfo = getModelById(modelId);
    if (!modelInfo || modelInfo.provider !== targetProvider) {
      // Fallback to appropriate default
      if (targetProvider === 'openrouter') {
        modelId = user.subscription_tier === 'free' 
          ? DEFAULT_MODELS.FREE_DEVELOPMENT 
          : DEFAULT_MODELS.PREMIUM_PRODUCTION;
      } else {
        modelId = DEFAULT_MODELS.GEMINI_FALLBACK;
      }
    }

    return {
      model: modelId,
      provider: targetProvider
    };
  }

  public async generateResponse(messages: AIMessage[], user?: User): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('AI service is not available');
    }

    // Get user-specific model configuration
    const userModel = this.getUserModel(user);

    // Try user's preferred provider first
    if (userModel.provider === 'openrouter' && this.openai) {
      try {
        return await this.generateOpenRouterResponse(messages, userModel.model);
      } catch (error) {
        console.error('OpenRouter request failed, falling back to Gemini:', error);
        
        // Fall back to Gemini if available
        if (this.geminiModel) {
          return await this.generateGeminiResponse(messages, DEFAULT_MODELS.GEMINI_FALLBACK);
        }
        throw error;
      }
    }

    // Use Gemini
    if (userModel.provider === 'gemini' && this.geminiModel) {
      return await this.generateGeminiResponse(messages, userModel.model);
    }

    // Fallback to system default
    if (this.activeProvider === 'openrouter' && this.openai) {
      return await this.generateOpenRouterResponse(messages, config.OPENROUTER_MODEL);
    }

    if (this.activeProvider === 'gemini' && this.geminiModel) {
      return await this.generateGeminiResponse(messages, config.GEMINI_MODEL);
    }

    throw new Error('No AI provider available');
  }

  private async generateOpenRouterResponse(messages: AIMessage[], modelId?: string): Promise<AIResponse> {
    if (!this.openai) throw new Error('OpenRouter not initialized');

    const chatMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));

    const completion = await this.openai.chat.completions.create({
      model: modelId || config.OPENROUTER_MODEL,
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content || '';
    const usage = completion.usage;

    return {
      content,
      usage: usage ? {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens
      } : undefined
    };
  }

  private async generateGeminiResponse(messages: AIMessage[], modelId?: string): Promise<AIResponse> {
    if (!this.geminiModel) throw new Error('Gemini not initialized');

    // For Gemini, we use the initialized model (modelId parameter is mainly for logging/tracking)
    // Convert messages to Gemini format
    const conversation = messages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const result = await this.geminiModel.generateContent(conversation);
    const response = await result.response;
    const text = response.text();

    return {
      content: text,
      usage: {
        prompt_tokens: 0, // Gemini doesn't provide exact token counts
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  public async analyzeProject(request: ProjectAnalysisRequest, user?: User): Promise<ProjectSuggestion> {
    if (!this.isAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      const prompt = this.buildProjectAnalysisPrompt(request);
      const messages: AIMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.generateResponse(messages, user);
      return this.parseProjectSuggestion(response.content, request);

    } catch (error) {
      console.error('Error analyzing project:', error);
      throw new Error('Failed to analyze project');
    }
  }

  public async generateTaskBreakdown(taskTitle: string, description?: string): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      const prompt = `
Break down this development task into smaller, actionable subtasks:

Task: ${taskTitle}
${description ? `Description: ${description}` : ''}

Provide 3-7 concrete, specific subtasks that a developer could implement. 
Each subtask should be:
- Specific and actionable
- Implementable in 1-4 hours
- Clearly defined with technical details

Format your response as a simple numbered list:
1. First subtask
2. Second subtask
etc.
`;

      const messages: AIMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.generateResponse(messages);

      // Extract numbered list items
      const subtasks = response.content
        .split('\n')
        .filter((line: string) => /^\d+\./.test(line.trim()))
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((task: string) => task.length > 0);

      return subtasks;

    } catch (error) {
      console.error('Error generating task breakdown:', error);
      throw new Error('Failed to generate task breakdown');
    }
  }

  public async optimizeWorkflow(nodes: any[], edges: any[]): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      const nodeList = nodes.map(n => `- ${n.title}: ${n.description || 'No description'}`).join('\n');
      const edgeList = edges.map(e => `- ${e.source_node_id} → ${e.target_node_id}`).join('\n');

      const prompt = `
Analyze this project workflow and suggest optimizations:

Tasks:
${nodeList}

Dependencies:
${edgeList}

Provide 3-5 specific recommendations to improve this workflow:
- Identify potential parallelization opportunities
- Suggest better task sequencing
- Point out missing dependencies
- Recommend task consolidation or splitting
- Identify potential bottlenecks

Format your response as a numbered list of actionable recommendations.
`;

      const messages: AIMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.generateResponse(messages);

      // Extract numbered recommendations
      const recommendations = response.content
        .split('\n')
        .filter((line: string) => /^\d+\./.test(line.trim()))
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((rec: string) => rec.length > 0);

      return recommendations;

    } catch (error) {
      console.error('Error optimizing workflow:', error);
      throw new Error('Failed to optimize workflow');
    }
  }

  private buildProjectAnalysisPrompt(request: ProjectAnalysisRequest): string {
    const existingNodesText = request.existingNodes && request.existingNodes.length > 0
      ? `\n\nExisting nodes:\n${request.existingNodes.map(n => `- ${n.title}: ${n.description || n.status}`).join('\n')}`
      : '';

    return `
Analyze this ${request.projectType || 'software'} project and suggest a comprehensive task breakdown:

Project: ${request.projectName}
${request.githubRepoUrl ? `Repository: ${request.githubRepoUrl}` : ''}
${request.additionalContext ? `Context: ${request.additionalContext}` : ''}
${existingNodesText}

Please provide a JSON response with the following structure:
{
  "suggestedNodes": [
    {
      "id": "unique-id",
      "title": "Task title",
      "description": "Detailed description",
      "estimatedHours": 8,
      "priority": "high|medium|low",
      "dependencies": ["other-node-ids"],
      "tags": ["frontend", "backend", "api"]
    }
  ],
  "suggestedEdges": [
    {
      "id": "edge-id",
      "source": "source-node-id",
      "target": "target-node-id",
      "type": "dependency|sequence|optional"
    }
  ],
  "recommendations": [
    "Strategic recommendation 1",
    "Strategic recommendation 2"
  ]
}

Focus on practical, implementable tasks for a ${request.projectType || 'software'} project.
Each task should be specific, actionable, and properly scoped.
`;
  }

  private parseProjectSuggestion(aiResponse: string, request: ProjectAnalysisRequest): ProjectSuggestion {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestedNodes: parsed.suggestedNodes || [],
          suggestedEdges: parsed.suggestedEdges || [],
          recommendations: parsed.recommendations || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI response as JSON, using fallback parsing');
    }

    // Fallback: create a simple structure
    return {
      suggestedNodes: [
        {
          id: this.generateId(),
          title: `Plan ${request.projectName}`,
          description: 'Break down the project requirements and create a development plan',
          estimatedHours: 4,
          priority: 'high' as const,
          dependencies: [],
          tags: ['planning']
        }
      ],
      suggestedEdges: [],
      recommendations: [
        'Consider breaking down large tasks into smaller, more manageable pieces',
        'Define clear acceptance criteria for each task',
        'Plan for testing and quality assurance'
      ]
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

export const aiService = new AIService();
export default aiService; 