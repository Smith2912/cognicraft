import { apiClient, ApiResponse } from './apiClient.js';
import { API_CONFIG, buildUrl } from './config.js';
import { NodeData, EdgeData } from '../types.js';

export interface Project {
  id: string;
  name: string;
  github_repo_url?: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithCanvas extends Project {
  nodes: NodeData[];
  edges: EdgeData[];
  chat_messages: ChatMessage[];
  history_state: {
    current_index: number;
    total_snapshots: number;
  };
}

export interface ChatMessage {
  id: string;
  project_id: string;
  sender_type: 'user' | 'ai';
  user_id?: string;
  text_content: string;
  timestamp: string;
  is_error: boolean;
  ai_action_parsed?: any;
  created_at: string;
}

export interface CreateProjectRequest {
  name: string;
  github_repo_url?: string;
  team_member_usernames?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  github_repo_url?: string;
  team_member_usernames?: string[];
}

export interface CanvasState {
  nodes: NodeData[];
  edges: EdgeData[];
  selected_node_ids: string[];
  selected_edge_id?: string;
}

class ProjectService {
  // Get all projects for current user
  public async getProjects(): Promise<Project[]> {
    const response: ApiResponse<{ projects: Project[] }> = await apiClient.get(
      API_CONFIG.ENDPOINTS.PROJECTS
    );
    return response.data.projects;
  }

  // Get specific project with canvas data
  public async getProject(projectId: string): Promise<ProjectWithCanvas> {
    const response: ApiResponse<ProjectWithCanvas> = await apiClient.get(
      buildUrl(API_CONFIG.ENDPOINTS.PROJECT_DETAIL, { id: projectId })
    );
    return response.data;
  }

  // Create new project
  public async createProject(projectData: CreateProjectRequest): Promise<Project> {
    const response: ApiResponse<{ project: Project }> = await apiClient.post(
      API_CONFIG.ENDPOINTS.PROJECTS,
      projectData
    );
    return response.data.project;
  }

  // Update project
  public async updateProject(projectId: string, updates: UpdateProjectRequest): Promise<Project> {
    const response: ApiResponse<{ project: Project }> = await apiClient.put(
      buildUrl(API_CONFIG.ENDPOINTS.PROJECT_DETAIL, { id: projectId }),
      updates
    );
    return response.data.project;
  }

  // Delete project
  public async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(
      buildUrl(API_CONFIG.ENDPOINTS.PROJECT_DETAIL, { id: projectId })
    );
  }

  // Save canvas state (nodes + edges + selection)
  public async saveCanvasState(projectId: string, canvasState: CanvasState): Promise<number> {
    const response: ApiResponse<{ message: string; new_history_sequence: number }> = 
      await apiClient.put(
        buildUrl(API_CONFIG.ENDPOINTS.PROJECT_CANVAS, { id: projectId }),
        canvasState
      );
    return response.data.new_history_sequence;
  }

  // Get canvas state only (without full project data)
  public async getCanvasState(projectId: string): Promise<{ nodes: NodeData[]; edges: EdgeData[] }> {
    const response: ApiResponse<{ nodes: NodeData[]; edges: EdgeData[] }> = await apiClient.get(
      buildUrl(API_CONFIG.ENDPOINTS.PROJECT_CANVAS, { id: projectId })
    );
    return response.data;
  }

  // Create single node
  public async createNode(projectId: string, nodeData: Partial<NodeData>): Promise<NodeData> {
    const response: ApiResponse<NodeData> = await apiClient.post(
      buildUrl(API_CONFIG.ENDPOINTS.PROJECT_NODES, { id: projectId }),
      nodeData
    );
    return response.data;
  }

  // Update single node
  public async updateNode(projectId: string, nodeId: string, nodeData: Partial<NodeData>): Promise<NodeData> {
    const response: ApiResponse<NodeData> = await apiClient.put(
      buildUrl(API_CONFIG.ENDPOINTS.PROJECT_NODE_DETAIL, { id: projectId, nodeId }),
      nodeData
    );
    return response.data;
  }

  // Delete single node (and related edges)
  public async deleteNode(projectId: string, nodeId: string): Promise<void> {
    await apiClient.delete(
      buildUrl(API_CONFIG.ENDPOINTS.PROJECT_NODE_DETAIL, { id: projectId, nodeId })
    );
  }

  // Migration helper: Import localStorage data
  public async migrateLocalStorageData(): Promise<{ success: boolean; migratedProjects: number }> {
    try {
      const localProjects = this.getLocalStorageProjects();
      let migratedCount = 0;

      for (const localProject of localProjects) {
        try {
          // Create project
          const project = await this.createProject({
            name: localProject.name,
            github_repo_url: localProject.githubRepo,
          });

          // Save canvas state if exists
          if (localProject.nodes.length > 0 || localProject.edges.length > 0) {
            await this.saveCanvasState(project.id, {
              nodes: localProject.nodes,
              edges: localProject.edges,
              selected_node_ids: [],
              selected_edge_id: undefined,
            });
          }

          migratedCount++;
        } catch (error) {
          console.error(`Failed to migrate project "${localProject.name}":`, error);
        }
      }

      return { success: true, migratedProjects: migratedCount };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, migratedProjects: 0 };
    }
  }

  // Helper to get localStorage projects
  private getLocalStorageProjects(): any[] {
    try {
      const projectsData = localStorage.getItem('cognicraft_projects');
      if (!projectsData) return [];

      const projects = JSON.parse(projectsData);
      return Array.isArray(projects) ? projects : [];
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const projectService = new ProjectService(); 