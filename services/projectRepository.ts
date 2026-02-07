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
  hasCorruptData?: boolean;
  corruptKeys?: string[];
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
  private lastLocalHash = new Map<string, string>();
  private lastBackendHash = new Map<string, string>();

  private localDebounceMs = 400;
  private backendDebounceMs = 1500;

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

    const corruptKeys: string[] = [];

    const safeParse = <T>(key: string, fallback: T): T => {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        corruptKeys.push(key);
        return fallback;
      }
    };

    const nodes = safeParse<NodeData[]>(nodesKey, []).filter(Boolean);
    const edges = safeParse<EdgeData[]>(edgesKey, []).filter(Boolean);
    const chatMessages = safeParse<UiChatMessage[]>(chatKey, []).filter(Boolean);
    const selectedNodeIds = safeParse<string[]>(selectedNodesKey, []).filter(Boolean);
    const selectedEdgeId = safeParse<string | null>(selectedEdgeKey, null);
    const history = safeParse<HistoryState[]>(historyKey, []).filter(Boolean);
    const historyIndexRaw = localStorage.getItem(historyIndexKey);
    const parsedIndex = historyIndexRaw ? parseInt(historyIndexRaw, 10) : history.length - 1;
    const historyIndex = Number.isFinite(parsedIndex) ? parsedIndex : history.length - 1;

    return {
      nodes,
      edges,
      chatMessages,
      selectedNodeIds,
      selectedEdgeId,
      history,
      historyIndex,
      hasCorruptData: corruptKeys.length > 0,
      corruptKeys,
    };
  }

  private hashSnapshot(snapshot: ProjectSnapshot): string {
    return JSON.stringify({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      selectedNodeIds: snapshot.selectedNodeIds,
      selectedEdgeId: snapshot.selectedEdgeId,
      historyIndex: snapshot.historyIndex,
    });
  }

  private hashCanvas(snapshot: Pick<ProjectSnapshot, 'nodes' | 'edges' | 'selectedNodeIds' | 'selectedEdgeId'>): string {
    return JSON.stringify({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      selectedNodeIds: snapshot.selectedNodeIds,
      selectedEdgeId: snapshot.selectedEdgeId,
    });
  }

  public saveProjectSnapshotDebounced(projectId: string, snapshot: ProjectSnapshot): void {
    const hash = this.hashSnapshot(snapshot);
    if (this.lastLocalHash.get(projectId) === hash) return;

    this.pendingSnapshots.set(projectId, snapshot);

    if (this.localSaveTimers.has(projectId)) {
      window.clearTimeout(this.localSaveTimers.get(projectId));
    }

    const timer = window.setTimeout(() => {
      const pending = this.pendingSnapshots.get(projectId);
      if (!pending) return;

      this.saveProjectSnapshot(projectId, pending);
      this.lastLocalHash.set(projectId, this.hashSnapshot(pending));
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

    const hash = this.hashCanvas(canvasState);
    if (this.lastBackendHash.get(projectId) === hash) return;

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
        this.lastBackendHash.set(projectId, this.hashCanvas(pending));
      } catch (error) {
        console.error('[ProjectRepository] Failed to save canvas to backend:', error);
      } finally {
        this.pendingCanvas.delete(projectId);
        this.backendSaveTimers.delete(projectId);
      }
    }, this.backendDebounceMs);

    this.backendSaveTimers.set(projectId, timer);
  }

  public flushProjectSaves(projectId: string, context?: BackendSaveContext): void {
    if (this.localSaveTimers.has(projectId)) {
      window.clearTimeout(this.localSaveTimers.get(projectId));
      this.localSaveTimers.delete(projectId);
      const pendingSnapshot = this.pendingSnapshots.get(projectId);
      if (pendingSnapshot) {
        this.saveProjectSnapshot(projectId, pendingSnapshot);
        this.lastLocalHash.set(projectId, this.hashSnapshot(pendingSnapshot));
        this.pendingSnapshots.delete(projectId);
      }
    }

    if (this.backendSaveTimers.has(projectId)) {
      window.clearTimeout(this.backendSaveTimers.get(projectId));
      this.backendSaveTimers.delete(projectId);

      const pendingCanvas = this.pendingCanvas.get(projectId);
      if (pendingCanvas && context?.isAuthenticated && context?.isOnline && context?.hasBackendProject) {
        projectService.saveCanvasState(projectId, {
          nodes: pendingCanvas.nodes,
          edges: pendingCanvas.edges,
          selected_node_ids: pendingCanvas.selectedNodeIds,
          selected_edge_id: pendingCanvas.selectedEdgeId ?? undefined,
        }).then(() => {
          this.lastBackendHash.set(projectId, this.hashCanvas(pendingCanvas));
        }).catch(error => {
          console.error('[ProjectRepository] Failed to flush backend canvas:', error);
        });
      }
      this.pendingCanvas.delete(projectId);
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

    this.pendingSnapshots.delete(projectId);
    this.pendingCanvas.delete(projectId);
    this.lastLocalHash.delete(projectId);
    this.lastBackendHash.delete(projectId);
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
