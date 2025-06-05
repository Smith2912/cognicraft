import { apiClient, ApiResponse } from './apiClient.js';
import { API_CONFIG, buildUrl } from './config.js';
import { NodeData, NodeStatus } from '../types.js';

export interface AiChatRequest {
  message: string;
  context?: {
    projectName?: string;
    projectType?: string;
    nodes?: NodeData[];
    selectedNodeId?: string;
  };
}

export interface AiChatResponse {
  response: string;
  actions?: AiAction[];
}

export interface AiAction {
  type: 'createNode' | 'updateNode' | 'createSubtask' | 'updateDescription';
  data: {
    id?: string;
    title?: string;
    description?: string;
    x?: number;
    y?: number;
    status?: string;
    parentId?: string;
    [key: string]: any;
  };
}

export interface ProjectAnalysisRequest {
  projectName: string;
  projectType: string;
  additionalContext?: string;
  existingNodes?: NodeData[];
}

export interface ProjectAnalysisResponse {
  analysis: string;
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    type: string;
  }>;
}

export interface TaskBreakdownRequest {
  taskTitle: string;
  taskDescription: string;
  projectContext?: string;
  maxSubtasks?: number;
}

export interface TaskBreakdownResponse {
  breakdown: string;
  subtasks: Array<{
    title: string;
    description: string;
    estimatedTime?: string;
    dependencies?: string[];
  }>;
}

export interface WorkflowOptimizationResponse {
  analysis: string;
  suggestions: Array<{
    type: 'connection' | 'reorder' | 'group' | 'split';
    description: string;
    nodeIds?: string[];
    priority: 'high' | 'medium' | 'low';
  }>;
}

class BackendAiService {
  // Check if AI service is available
  public async checkStatus(): Promise<boolean> {
    try {
      const response: ApiResponse<{ status: string; models: string[] }> = await apiClient.get(
        API_CONFIG.ENDPOINTS.AI_STATUS
      );
      return response.data.status === 'available';
    } catch (error) {
      console.error('AI service status check failed:', error);
      return false;
    }
  }

  // General AI chat
  public async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const response: ApiResponse<AiChatResponse> = await apiClient.post(
      API_CONFIG.ENDPOINTS.AI_CHAT,
      request
    );
    return response.data;
  }

  // Analyze project and suggest tasks
  public async analyzeProject(request: ProjectAnalysisRequest): Promise<ProjectAnalysisResponse> {
    const response: ApiResponse<ProjectAnalysisResponse> = await apiClient.post(
      API_CONFIG.ENDPOINTS.AI_ANALYZE_PROJECT,
      request
    );
    return response.data;
  }

  // Break down task into subtasks
  public async breakDownTask(request: TaskBreakdownRequest): Promise<TaskBreakdownResponse> {
    const response: ApiResponse<TaskBreakdownResponse> = await apiClient.post(
      API_CONFIG.ENDPOINTS.AI_BREAK_DOWN_TASK,
      request
    );
    return response.data;
  }

  // Optimize workflow for a project
  public async optimizeWorkflow(projectId: string, nodes: NodeData[]): Promise<WorkflowOptimizationResponse> {
    const response: ApiResponse<WorkflowOptimizationResponse> = await apiClient.post(
      buildUrl(API_CONFIG.ENDPOINTS.AI_OPTIMIZE_WORKFLOW, { projectId }),
      { nodes }
    );
    return response.data;
  }

  // Generate node description using AI
  public async generateNodeDescription(
    nodeTitle: string,
    projectContext?: string,
    existingDescription?: string
  ): Promise<string> {
    const response = await this.chat({
      message: `Generate a detailed description for a project task titled "${nodeTitle}".`,
      context: {
        projectType: projectContext || 'software development',
      },
    });

    // Extract description from AI response
    return response.response || `Detailed implementation for ${nodeTitle}`;
  }

  // Suggest subtasks for a node
  public async suggestSubtasks(
    nodeTitle: string,
    nodeDescription?: string,
    projectContext?: string,
    maxSubtasks: number = 5
  ): Promise<Array<{ title: string; description: string }>> {
    const breakdown = await this.breakDownTask({
      taskTitle: nodeTitle,
      taskDescription: nodeDescription || '',
      projectContext,
      maxSubtasks,
    });

    return breakdown.subtasks;
  }

  // Create nodes from AI suggestions
  public async createNodesFromAnalysis(
    analysis: ProjectAnalysisResponse,
    startX: number = 100,
    startY: number = 100
  ): Promise<NodeData[]> {
    const nodes: NodeData[] = [];
    let currentY = startY;

    for (const task of analysis.suggestedTasks) {
      const node: NodeData = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: task.title,
        description: task.description,
        x: startX,
        y: currentY,
        width: 200,
        height: 150,
        status: NodeStatus.ToDo,
        iconId: this.getIconForTaskType(task.type),
        tags: [task.priority, task.type],
        githubIssueUrl: '',
      };

      nodes.push(node);
      currentY += 200; // Space nodes vertically
    }

    return nodes;
  }

  // Helper to determine icon based on task type
  private getIconForTaskType(taskType: string): string {
    const iconMap: Record<string, string> = {
      'frontend': 'frontend',
      'backend': 'api',
      'database': 'database',
      'deployment': 'gear',
      'testing': 'bug',
      'documentation': 'github',
      'feature': 'feature',
      'api': 'api',
      'ui': 'frontend',
      'ux': 'frontend',
    };

    return iconMap[taskType.toLowerCase()] || 'github';
  }

  // Parse AI response for actions
  public parseAiActions(aiResponse: string): AiAction[] {
    const actions: AiAction[] = [];

    try {
      // Look for JSON blocks in the response
      const jsonMatches = aiResponse.match(/```json\s*([\s\S]*?)\s*```/g);
      
      if (jsonMatches) {
        for (const match of jsonMatches) {
          const jsonContent = match.replace(/```json\s*/, '').replace(/\s*```/, '');
          
          try {
            const parsed = JSON.parse(jsonContent);
            
            // Handle different action formats
            if (Array.isArray(parsed)) {
              actions.push(...parsed);
            } else if (parsed.type && parsed.data) {
              actions.push(parsed);
            }
          } catch (parseError) {
            console.warn('Failed to parse JSON action:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing AI actions:', error);
    }

    return actions;
  }
}

// Export singleton instance
export const backendAiService = new BackendAiService(); 