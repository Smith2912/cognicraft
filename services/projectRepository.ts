import { NodeData, EdgeData, ChatMessage as UiChatMessage, Project as LegacyProject, User as LegacyUser } from '../types.js';
import { projectService } from './projectService.js';

export interface HistoryState {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
}

export interface ProjectSnapshot {
  nodes: NodeData[];
  edges: EdgeData[];
  chatMessages: UiChatMessage[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  history: HistoryState[];
  historyIndex: number;
}

export interface BackendSaveContext {
  isAuthenticated: boolean;
  isOnline: boolean;
  hasBackendProject: boolean;
}

class ProjectRepository {
  private localSaveTimers = new Map<string, number>();
  private backendSaveTimers = new Map<string, number>();
  private pendingSnapshots = new Map<string, ProjectSnapshot>();
  private pendingCanvas = new Map<string, Pick<ProjectSnapshot, 'nodes' | 'edges' | 'selectedNodeIds' | 'selectedEdgeId'>>();

  private localDebounceMs = 250;
  private backendDebounceMs = 1200;

  public getProjectScopedKey(baseKey: string, projectId: string): string {
    return `${baseKey}_${projectId}`;
  }

  public loadProjectSnapshot(projectId: string): ProjectSnapshot {
    const nodesKey = this.getProjectScopedKey('plannerNodes', projectId);
    const edgesKey = this.getProjectScopedKey('plannerEdges', projectId);
    const chatKey = this.getProjectScopedKey('plannerChatMessages', projectId);
    const selectedNodesKey = this.getProjectScopedKey('plannerSelectedNodeIds', projectId);
    const selectedEdgeKey = this.getProjectScopedKey('plannerSelectedEdgeId', projectId);
    const historyKey = this.getProjectScopedKey('plannerHistory', projectId);
    const historyIndexKey = this.getProjectScopedKey('plannerHistoryIndex', projectId);

    const nodes: NodeData[] = localStorage.getItem(nodesKey)
      ? JSON.parse(localStorage.getItem(nodesKey)!)
      : [];
    const edges: EdgeData[] = localStorage.getItem(edgesKey)
      ? JSON.parse(localStorage.getItem(edgesKey)!)
      : [];
    const chatMessages: UiChatMessage[] = localStorage.getItem(chatKey)
      ? JSON.parse(localStorage.getItem(chatKey)!)
      : [];
    const selectedNodeIds: string[] = localStorage.getItem(selectedNodesKey)
      ? JSON.parse(localStorage.getItem(selectedNodesKey)!)
      : [];
    const selectedEdgeId: string | null = localStorage.getItem(selectedEdgeKey)
      ? JSON.parse(localStorage.getItem(selectedEdgeKey)!)
      : null;
    const history: HistoryState[] = localStorage.getItem(historyKey)
      ? JSON.parse(localStorage.getItem(historyKey)!)
      : [];
    const historyIndexRaw = localStorage.getItem(historyIndexKey);
    const historyIndex = historyIndexRaw ? parseInt(historyIndexRaw, 10) : history.length - 1;

    return {
      nodes,
      edges,
      chatMessages,
      selectedNodeIds,
      selectedEdgeId,
      history,
      historyIndex,
    };
  }

  public saveProjectSnapshotDebounced(projectId: string, snapshot: ProjectSnapshot): void {
    this.pendingSnapshots.set(projectId, snapshot);

    if (this.localSaveTimers.has(projectId)) {
      window.clearTimeout(this.localSaveTimers.get(projectId));
    }

    const timer = window.setTimeout(() => {
      const pending = this.pendingSnapshots.get(projectId);
      if (!pending) return;

      this.saveProjectSnapshot(projectId, pending);
      this.pendingSnapshots.delete(projectId);
      this.localSaveTimers.delete(projectId);
    }, this.localDebounceMs);

    this.localSaveTimers.set(projectId, timer);
  }

  public saveProjectSnapshot(projectId: string, snapshot: ProjectSnapshot): void {
    localStorage.setItem(this.getProjectScopedKey('plannerNodes', projectId), JSON.stringify(snapshot.nodes));
    localStorage.setItem(this.getProjectScopedKey('plannerEdges', projectId), JSON.stringify(snapshot.edges));
    localStorage.setItem(this.getProjectScopedKey('plannerChatMessages', projectId), JSON.stringify(snapshot.chatMessages));
    localStorage.setItem(this.getProjectScopedKey('plannerSelectedNodeIds', projectId), JSON.stringify(snapshot.selectedNodeIds));
    localStorage.setItem(this.getProjectScopedKey('plannerSelectedEdgeId', projectId), JSON.stringify(snapshot.selectedEdgeId));
    localStorage.setItem(this.getProjectScopedKey('plannerHistory', projectId), JSON.stringify(snapshot.history));
    localStorage.setItem(this.getProjectScopedKey('plannerHistoryIndex', projectId), snapshot.historyIndex.toString());
  }

  public scheduleBackendCanvasSave(
    projectId: string,
    canvasState: Pick<ProjectSnapshot, 'nodes' | 'edges' | 'selectedNodeIds' | 'selectedEdgeId'>,
    context: BackendSaveContext
  ): void {
    if (!context.isAuthenticated || !context.isOnline || !context.hasBackendProject) return;

    this.pendingCanvas.set(projectId, canvasState);

    if (this.backendSaveTimers.has(projectId)) {
      window.clearTimeout(this.backendSaveTimers.get(projectId));
    }

    const timer = window.setTimeout(async () => {
      const pending = this.pendingCanvas.get(projectId);
      if (!pending) return;

      try {
        await projectService.saveCanvasState(projectId, {
          nodes: pending.nodes,
          edges: pending.edges,
          selected_node_ids: pending.selectedNodeIds,
          selected_edge_id: pending.selectedEdgeId ?? undefined,
        });
      } catch (error) {
        console.error('[ProjectRepository] Failed to save canvas to backend:', error);
      } finally {
        this.pendingCanvas.delete(projectId);
        this.backendSaveTimers.delete(projectId);
      }
    }, this.backendDebounceMs);

    this.backendSaveTimers.set(projectId, timer);
  }

  public flushProjectSaves(projectId: string): void {
    if (this.localSaveTimers.has(projectId)) {
      window.clearTimeout(this.localSaveTimers.get(projectId));
      this.localSaveTimers.delete(projectId);
      const pendingSnapshot = this.pendingSnapshots.get(projectId);
      if (pendingSnapshot) {
        this.saveProjectSnapshot(projectId, pendingSnapshot);
        this.pendingSnapshots.delete(projectId);
      }
    }

    if (this.backendSaveTimers.has(projectId)) {
      window.clearTimeout(this.backendSaveTimers.get(projectId));
      this.backendSaveTimers.delete(projectId);
    }
  }

  public deleteProjectData(projectId: string): void {
    const keysToRemove = [
      'plannerNodes',
      'plannerEdges',
      'plannerChatMessages',
      'plannerSelectedNodeIds',
      'plannerSelectedEdgeId',
      'plannerHistory',
      'plannerHistoryIndex',
    ];

    keysToRemove.forEach(baseKey => {
      localStorage.removeItem(this.getProjectScopedKey(baseKey, projectId));
    });
  }

  public loadProjects(): LegacyProject[] {
    const saved = localStorage.getItem('plannerProjects');
    if (!saved) return [];

    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error('[ProjectRepository] Failed to parse stored projects:', error);
      return [];
    }
  }

  public saveProjects(projects: LegacyProject[]): void {
    localStorage.setItem('plannerProjects', JSON.stringify(projects));
  }

  public loadCurrentProjectId(): string | null {
    return localStorage.getItem('plannerCurrentProjectId');
  }

  public saveCurrentProjectId(projectId: string): void {
    localStorage.setItem('plannerCurrentProjectId', projectId);
  }

  public loadUser(): LegacyUser | null {
    const stored = localStorage.getItem('plannerUser');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('[ProjectRepository] Failed to parse stored user:', error);
      return null;
    }
  }

  public saveUser(user: LegacyUser): void {
    localStorage.setItem('plannerUser', JSON.stringify(user));
  }
}

export const projectRepository = new ProjectRepository();
