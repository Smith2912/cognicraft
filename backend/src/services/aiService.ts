import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

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
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    if (config.GEMINI_API_KEY) {
      try {
        this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        console.log('✅ Gemini AI service initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Gemini AI:', error);
      }
    } else {
      console.warn('⚠️  GEMINI_API_KEY not provided - AI features will be disabled');
    }
  }

  public isAvailable(): boolean {
    return this.model !== null;
  }

  public async generateResponse(messages: AIMessage[]): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      // Convert messages to Gemini format
      const conversation = messages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      const result = await this.model.generateContent(conversation);
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

    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  public async analyzeProject(request: ProjectAnalysisRequest): Promise<ProjectSuggestion> {
    if (!this.isAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      const prompt = this.buildProjectAnalysisPrompt(request);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the AI response into structured format
      return this.parseProjectSuggestion(text, request);

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

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract numbered list items
      const subtasks = text
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

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract numbered recommendations
      const recommendations = text
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
    const existingNodesText = request.existingNodes?.length 
      ? request.existingNodes.map(n => `- ${n.title}: ${n.description || 'No description'}`).join('\n')
      : 'None';

    return `
Analyze this ${request.projectType || 'software'} project and suggest a comprehensive development plan:

Project: ${request.projectName}
${request.githubRepoUrl ? `Repository: ${request.githubRepoUrl}` : ''}
${request.additionalContext ? `Context: ${request.additionalContext}` : ''}

Existing tasks:
${existingNodesText}

Please suggest 8-15 development tasks that would complete this project. For each task:
- Provide a clear, specific title
- Write a detailed description (2-3 sentences)
- Estimate hours needed (realistic development time)
- Assign priority (high/medium/low)
- List dependencies (titles of other tasks that must be completed first)
- Add relevant tags (e.g., "frontend", "backend", "testing", "deployment")

Also suggest logical connections between tasks and provide 3-5 high-level recommendations for the project.

Format your response as JSON with this structure:
{
  "suggestedNodes": [
    {
      "title": "Task Title",
      "description": "Detailed description",
      "estimatedHours": 8,
      "priority": "high",
      "dependencies": ["Other Task Title"],
      "tags": ["frontend", "api"]
    }
  ],
  "connections": [
    {
      "source": "Source Task Title",
      "target": "Target Task Title",
      "type": "dependency"
    }
  ],
  "recommendations": [
    "High-level recommendation 1",
    "High-level recommendation 2"
  ]
}
`;
  }

  private parseProjectSuggestion(aiResponse: string, request: ProjectAnalysisRequest): ProjectSuggestion {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Generate UUIDs for nodes and edges
        const suggestedNodes = parsed.suggestedNodes.map((node: any) => ({
          id: this.generateId(),
          ...node
        }));

        const suggestedEdges = (parsed.connections || []).map((conn: any) => ({
          id: this.generateId(),
          source: this.findNodeIdByTitle(suggestedNodes, conn.source),
          target: this.findNodeIdByTitle(suggestedNodes, conn.target),
          type: conn.type || 'dependency'
        })).filter((edge: any) => edge.source && edge.target);

        return {
          suggestedNodes,
          suggestedEdges,
          recommendations: parsed.recommendations || []
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', error);
    }

    // Fallback: return empty suggestions
    return {
      suggestedNodes: [],
      suggestedEdges: [],
      recommendations: ['Unable to parse AI suggestions. Please try again.']
    };
  }

  private findNodeIdByTitle(nodes: any[], title: string): string | null {
    const node = nodes.find(n => n.title === title);
    return node ? node.id : null;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Export singleton instance
export const aiService = new AIService(); 