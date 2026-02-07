import React, { useState, useCallback, useEffect, useRef, useReducer, useMemo } from 'react';
import { NodeData, EdgeData, NodeStatus, Point, ChatMessage, User as LegacyUser, Project as LegacyProject } from './types';
import { NODE_WIDTH, NODE_HEIGHT, GRID_SIZE } from './constants';
import { appReducer, createInitialAppState, HistoryState, StateUpdater } from './appReducer';
import { getAiProvider } from './services/aiProvider';
import { buildChatPrompt } from './services/aiPrompts';
import { generatePlanMarkdown } from './services/markdownService';
import { autoLayoutNodes } from './services/layoutService';
import { parseAiActionsFromResponse } from './services/aiActions';

// New backend service imports
import { 
  authService, 
  projectService,
  projectRepository,
  openclawService,
  apiClient,
  type Project as BackendProject,
  type User as BackendUser
} from './services/index.js';

import NodePlannerCanvas, { NodePlannerCanvasHandle } from './components/NodePlannerCanvas';
import NodeEditorSidebar from './components/NodeEditorSidebar';
import ChatPanel from './components/ChatPanel';
import Header from './components/Header';
import LeftControlsToolbar from './components/LeftControlsToolbar';
import SettingsPanel from './components/SettingsPanel';
import ContextMenu from './components/ContextMenu';
import MainLayout from './components/layout/MainLayout';
import Toast, { ToastMessage, ToastType } from './components/Toast';

const generateId = (prefix: string = 'id'): string => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

// Convert BackendUser to LegacyUser format for compatibility
const convertBackendUserToLegacy = (backendUser: BackendUser): LegacyUser => ({
  username: backendUser.username,
  avatarUrl: `https://github.com/${backendUser.username}.png`
});

interface ContextMenuState {
  clientX: number;
  clientY: number;
  kind: 'canvas' | 'edge';
  svgX?: number;
  svgY?: number;
  edgeId?: string;
}

const App: React.FC = () => {
  // Backend integration state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<LegacyUser | null>(null);
  const [backendProjects, setBackendProjects] = useState<BackendProject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Migration state hooks removed in Phase 3
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Legacy state (for backward compatibility during transition)
  const [projects, setProjects] = useState<LegacyProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [appState, dispatch] = useReducer(appReducer, undefined, createInitialAppState);
  const { nodes, edges, selectedNodeIds, selectedEdgeId, history, historyIndex } = appState;
  const [connectingInfo, setConnectingInfo] = useState<{ sourceId: string; sourceHandle: 'top' | 'bottom' | 'left' | 'right'; mousePosition: Point } | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [currentAiMessageId, setCurrentAiMessageId] = useState<string | null>(null);

  const [showGrid, setShowGrid] = useState<boolean>(true);
  const canvasRef = useRef<NodePlannerCanvasHandle>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const aiProvider = useRef(getAiProvider()).current;
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [copiedNodes, setCopiedNodes] = useState<NodeData[] | null>(null);
  const [copiedEdges, setCopiedEdges] = useState<EdgeData[] | null>(null);
  const [pasteCount, setPasteCount] = useState(0);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const pushToast = useCallback((type: ToastType, title: string, description?: string, ttl = 4500) => {
    const id = generateId('toast');
    setToasts(prev => [...prev, { id, type, title, description }]);
    window.setTimeout(() => dismissToast(id), ttl);
  }, [dismissToast]);

  // State for tracking processed AI messages to prevent duplicate action processing
  const [processedAiMessageIds, setProcessedAiMessageIds] = useState<Set<string>>(new Set());
  const [recentlyCreatedNodes, setRecentlyCreatedNodes] = useState<Map<string, number>>(new Map());
  const [recentOpenclawActions, setRecentOpenclawActions] = useState<Array<{ action: string; payload?: any; timestamp: number }>>([]);
  const openclawPollRef = useRef<number | null>(null);
  const openclawSocketRef = useRef<WebSocket | null>(null);

  const [apiHealthy, setApiHealthy] = useState<boolean>(true);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [requireAiApproval, setRequireAiApproval] = useState<boolean>(() => {
    const stored = localStorage.getItem('cognicraft_require_ai_approval');
    return stored === 'true';
  });
  const [pendingAiActions, setPendingAiActions] = useState<Array<{ id: string; projectId: string; actions: AiAction[] }>>([]);

  const checkApiHealth = useCallback(async () => {
    if (isCheckingHealth) return;
    setIsCheckingHealth(true);
    try {
      const ok = await apiClient.health();
      setApiHealthy(ok);
      if (!ok) {
        pushToast('warning', 'Backend unavailable', 'Unable to reach the API. Some features may not work.');
      }
    } finally {
      setIsCheckingHealth(false);
    }
  }, [isCheckingHealth, pushToast]);

  // Reset processed messages when switching projects
  useEffect(() => {
    setProcessedAiMessageIds(new Set());
    setRecentlyCreatedNodes(new Map());
  }, [currentProjectId]);

  // Clean up old node creation timestamps every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentlyCreatedNodes(prev => {
        const updated = new Map(prev);
        for (const [title, timestamp] of updated.entries()) {
          if (now - timestamp > 30000) { // Remove entries older than 30 seconds
            updated.delete(title);
          }
        }
        return updated;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Initialize authentication and online status
  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      console.log('[App] Initializing application...');
      
      try {
        // Check authentication status
        const isUserAuthenticated = await authService.isAuthenticated();
        
        if (isMounted) {
          setIsAuthenticated(isUserAuthenticated);
          
          if (isUserAuthenticated) {
            // Load user data
            const userData = await authService.getCurrentUser();
            if (userData && isMounted) {
              setCurrentUser(convertBackendUserToLegacy(userData));
              console.log('[App] User authenticated:', userData.username);
              
              // Load backend projects
              try {
                const projects = await projectService.getProjects();
                if (isMounted) {
                  setBackendProjects(projects);
                  console.log('[App] Loaded', projects.length, 'backend projects');
                }
              } catch (error) {
                console.error('[App] Failed to load backend projects:', error);
              }
            }
          } else {
            console.log('[App] User not authenticated - running in local mode');
          }
          
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[App] Authentication check failed:', error);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    };

    // Handle online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    initializeApp();

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    apiClient.setErrorHandler((error) => {
      if (error.status === 0) {
        pushToast('error', 'Network error', error.message);
        return;
      }
      if (error.status === 401) {
        pushToast('warning', 'Session expired', 'Please log in again.');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setBackendProjects([]);
        return;
      }
      if (error.status >= 500) {
        pushToast('error', 'Server error', error.message);
      }
    });

    return () => apiClient.setErrorHandler(undefined);
  }, [pushToast]);

  useEffect(() => {
    localStorage.setItem('cognicraft_require_ai_approval', requireAiApproval ? 'true' : 'false');
  }, [requireAiApproval]);

  useEffect(() => {
    if (!isOnline) {
      setApiHealthy(false);
      return;
    }
    checkApiHealth();
  }, [isOnline, checkApiHealth]);

  // Load project data with backend integration
  const loadProjectData = useCallback(async (projectId: string) => {
    console.log(`[App] Loading data for project: ${projectId}`);
    
    try {
      if (isAuthenticated && isOnline) {
        // Try to load from backend first
        try {
          const backendProject = backendProjects.find(p => p.id === projectId);
          if (backendProject) {
            console.log('[App] Loading project data from backend');
            try {
              const remote = await projectService.getProject(projectId);
              if (remote?.canvas) {
                const remoteNodes = (remote.canvas.nodes || []).map((node: any) => ({
                  id: node.id,
                  x: node.x_position ?? node.x ?? GRID_SIZE * 2,
                  y: node.y_position ?? node.y ?? GRID_SIZE * 2,
                  title: node.title || 'New Task',
                  description: node.description || '',
                  status: node.status || NodeStatus.ToDo,
                  width: node.width || NODE_WIDTH,
                  height: node.height || NODE_HEIGHT,
                  tags: Array.isArray(node.tags) ? node.tags : [],
                  iconId: node.icon_id || node.iconId || 'github',
                  githubIssueUrl: node.github_issue_url || node.githubIssueUrl || undefined,
                }));

                const remoteEdges = (remote.canvas.edges || []).map((edge: any) => ({
                  id: edge.id,
                  sourceId: edge.source_node_id || edge.sourceId,
                  targetId: edge.target_node_id || edge.targetId,
                  sourceHandle: edge.source_handle || edge.sourceHandle,
                  targetHandle: edge.target_handle || edge.targetHandle,
                }));

                if (remoteNodes.length || remoteEdges.length) {
                  dispatch({
                    type: 'INIT_PROJECT_STATE',
                    payload: {
                      nodes: remoteNodes,
                      edges: remoteEdges,
                      selectedNodeIds: [],
                      selectedEdgeId: null,
                      history: [{ nodes: remoteNodes, edges: remoteEdges, selectedNodeIds: [], selectedEdgeId: null }],
                      historyIndex: 0,
                    },
                  });
                  setChatMessages([{
                    id: generateId('ai-greet'), sender: 'ai',
                    text: "Hello! I'm your AI planning assistant. How can I help you structure your project today?",
                    timestamp: Date.now()
                  }]);
                  setConnectingInfo(null);
                  if (canvasRef.current) canvasRef.current.fitView(remoteNodes);
                  return;
                }
              }
            } catch (error) {
              console.warn('[App] Failed to load project data from backend, falling back to localStorage:', error);
            }
          }
        } catch (error) {
          console.warn('[App] Failed to load from backend, falling back to localStorage:', error);
        }
      }
      
      // Load from ProjectRepository (localStorage)
      let snapshot = projectRepository.loadProjectSnapshot(projectId);

      if (snapshot.hasCorruptData) {
        pushToast('warning', 'Corrupted local data detected', 'Some saved data could not be loaded.');
        const shouldReset = window.confirm(
          'CogniCraft detected corrupted local data for this project. Reset local data and start fresh?'
        );
        if (shouldReset) {
          projectRepository.deleteProjectData(projectId);
          snapshot = projectRepository.loadProjectSnapshot(projectId);
          pushToast('info', 'Local data reset', 'Corrupted local project data was cleared.');
        }
      }

      const initialNodes: NodeData[] = (snapshot.nodes || []).map((node: NodeData) => ({
          ...node,
          width: node.width || NODE_WIDTH,
          height: node.height || NODE_HEIGHT,
          tags: Array.isArray(node.tags) ? node.tags : [],
          iconId: node.iconId || 'github',
          githubIssueUrl: node.githubIssueUrl || undefined,
      }));
      const initialEdges: EdgeData[] = snapshot.edges || [];
      const initialSelectedNodes: string[] = snapshot.selectedNodeIds || [];
      const initialSelectedEdge: string | null = snapshot.selectedEdgeId ?? null;
      const initialChat: ChatMessage[] = snapshot.chatMessages && snapshot.chatMessages.length > 0 ? snapshot.chatMessages : [{
          id: generateId('ai-greet'), sender: 'ai',
          text: "Hello! I'm your AI planning assistant. How can I help you structure your project today?",
          timestamp: Date.now()
      }];

      const loadedHistory: HistoryState[] = snapshot.history || [];
      let initialHistory: HistoryState[];
      let initialHistoryIndex: number;

      if (loadedHistory.length > 0) {
          initialHistory = loadedHistory;
          initialHistoryIndex = Number.isFinite(snapshot.historyIndex) ? snapshot.historyIndex : initialHistory.length - 1;
          if (initialHistoryIndex < 0 || initialHistoryIndex >= initialHistory.length) {
               initialHistoryIndex = initialHistory.length - 1;
          }
      } else {
          initialHistory = [{ nodes: initialNodes, edges: initialEdges, selectedNodeIds: initialSelectedNodes, selectedEdgeId: initialSelectedEdge }];
          initialHistoryIndex = 0;
      }
      
      dispatch({
        type: 'INIT_PROJECT_STATE',
        payload: {
          nodes: initialNodes,
          edges: initialEdges,
          selectedNodeIds: initialSelectedNodes,
          selectedEdgeId: initialSelectedEdge,
          history: initialHistory,
          historyIndex: initialHistoryIndex,
        },
      });
      setChatMessages(initialChat.map(m => ({...m, isProcessing: false})));
      setConnectingInfo(null); 
      if (canvasRef.current) canvasRef.current.fitView(initialNodes);

    } catch (error) {
      console.error('[App] Failed to load project data:', error);
      // Initialize with empty state on error
      const initialHistory = [{ nodes: [], edges: [], selectedNodeIds: [], selectedEdgeId: null }];
      dispatch({
        type: 'INIT_PROJECT_STATE',
        payload: {
          nodes: [],
          edges: [],
          selectedNodeIds: [],
          selectedEdgeId: null,
          history: initialHistory,
          historyIndex: 0,
        },
      });
      setChatMessages([{
        id: generateId('ai-greet'), sender: 'ai',
        text: "Hello! I'm your AI planning assistant. How can I help you structure your project today?",
        timestamp: Date.now()
      }]);
      setConnectingInfo(null);
    }
     }, [isAuthenticated, isOnline, backendProjects, pushToast]);

  // Initialize projects (after authentication is determined)
  useEffect(() => {
    if (isLoading) return; // Wait for auth to complete
    
    const initializeProjects = () => {
      console.log('[App] Initializing projects...');
      
      // Load legacy localStorage projects for backward compatibility
      const savedProjects = projectRepository.loadProjects();
      const savedCurrentProjectId = projectRepository.loadCurrentProjectId();

      let loadedProjects: LegacyProject[] = [];
      if (savedProjects.length > 0) {
        loadedProjects = savedProjects.map((p: LegacyProject) => ({
          ...p,
          githubRepoUrl: p.githubRepoUrl || '',
          teamMemberUsernames: Array.isArray(p.teamMemberUsernames) ? p.teamMemberUsernames : []
        }));
      }

      if (isAuthenticated && backendProjects.length > 0) {
        const backendAsLegacy: LegacyProject[] = backendProjects.map(p => {
          const teamMembers = Array.isArray(p.team_members)
            ? p.team_members
            : (Array.isArray(p.team_member_usernames)
              ? p.team_member_usernames.map(username => ({ username, role: 'editor' as const }))
              : []);

          return {
            id: p.id,
            name: p.name,
            ownerUsername: currentUser?.username || 'local',
            createdAt: p.created_at ? Date.parse(p.created_at) : Date.now(),
            githubRepoUrl: p.github_repo_url || '',
            teamMemberUsernames: teamMembers.map(member => member.username),
            teamMembers,
          };
        });

        const merged = new Map<string, LegacyProject>();
        loadedProjects.forEach(p => merged.set(p.id, p));
        backendAsLegacy.forEach(p => merged.set(p.id, p));
        loadedProjects = Array.from(merged.values());
      }

      setProjects(loadedProjects);

      // Determine active project
      let activeProjectId = savedCurrentProjectId;
      if (loadedProjects.length > 0) {
        if (!activeProjectId || !loadedProjects.find(p => p.id === activeProjectId)) {
          console.log("[App Init] No valid current project ID found, defaulting to first project.");
          activeProjectId = loadedProjects[0].id; 
        }
      } else { 
        console.log("[App Init] No projects found, creating default project.");
        const defaultProjectName = "Default Project";
        const newProject: LegacyProject = {
          id: generateId('project'),
          name: defaultProjectName,
          ownerUsername: currentUser?.username || 'local',
          createdAt: Date.now(),
          githubRepoUrl: '',
          teamMemberUsernames: [],
        };
        setProjects([newProject]);
        activeProjectId = newProject.id;
      }
      
      console.log(`[App Init] Setting current project ID to: ${activeProjectId}`);
      setCurrentProjectId(activeProjectId);
      if(activeProjectId) {
        loadProjectData(activeProjectId);
      }
    };

    initializeProjects();
  }, [isLoading, currentUser?.username, loadProjectData, isAuthenticated, backendProjects]);

  // Auto-save project data with backend integration
  useEffect(() => {
    if (!currentProjectId) return;

    projectRepository.saveProjectSnapshotDebounced(currentProjectId, {
      nodes,
      edges,
      chatMessages,
      selectedNodeIds,
      selectedEdgeId,
      history,
      historyIndex,
    });

    projectRepository.scheduleBackendCanvasSave(
      currentProjectId,
      { nodes, edges, selectedNodeIds, selectedEdgeId },
      {
        isAuthenticated,
        isOnline,
        hasBackendProject: !!backendProjects.find(p => p.id === currentProjectId),
      }
    );
  }, [
    nodes,
    edges,
    chatMessages,
    selectedNodeIds,
    selectedEdgeId,
    history,
    historyIndex,
    currentProjectId,
    isAuthenticated,
    isOnline,
    backendProjects,
  ]);

  useEffect(() => { projectRepository.saveProjects(projects); }, [projects]);
  useEffect(() => { if (currentProjectId) projectRepository.saveCurrentProjectId(currentProjectId); }, [currentProjectId]);
  useEffect(() => { currentUser && projectRepository.saveUser(currentUser); }, [currentUser]);

  useEffect(() => {
    const flushSnapshot = () => {
      if (!currentProjectId) return;
      projectRepository.saveProjectSnapshot(currentProjectId, {
        nodes,
        edges,
        chatMessages,
        selectedNodeIds,
        selectedEdgeId,
        history,
        historyIndex,
      });
      projectRepository.flushProjectSaves(currentProjectId, {
        isAuthenticated,
        isOnline,
        hasBackendProject: !!backendProjects.find(p => p.id === currentProjectId),
      });
    };

    const handleBeforeUnload = () => {
      flushSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSnapshot();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    currentProjectId,
    nodes,
    edges,
    chatMessages,
    selectedNodeIds,
    selectedEdgeId,
    history,
    historyIndex,
    isAuthenticated,
    isOnline,
    backendProjects,
  ]);

  const setNodesInternal = useCallback((updater: StateUpdater<NodeData[]>) => {
    if (!currentProjectId) return;
    dispatch({ type: 'SET_NODES', updater });
  }, [currentProjectId]);

  const setEdgesInternal = useCallback((updater: StateUpdater<EdgeData[]>) => {
    if (!currentProjectId) return;
    dispatch({ type: 'SET_EDGES', updater });
  }, [currentProjectId]);

  const setSelectedNodeIdsInternal = useCallback((updater: StateUpdater<string[]>) => {
    if (!currentProjectId) return;
    dispatch({ type: 'SET_SELECTED_NODE_IDS', updater });
  }, [currentProjectId]);

  const setSelectedEdgeIdInternal = useCallback((updater: StateUpdater<string | null>) => {
    if (!currentProjectId) return;
    dispatch({ type: 'SET_SELECTED_EDGE_ID', updater });
  }, [currentProjectId]);

  const commitHistory = useCallback(() => {
    dispatch({ type: 'COMMIT_HISTORY' });
  }, []);

  const copySelectedNodes = useCallback(() => {
    if (!selectedNodeIds.length) return;
    const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
    const selectedEdges = edges.filter(edge =>
      selectedNodeIds.includes(edge.sourceId) && selectedNodeIds.includes(edge.targetId)
    );
    if (!selectedNodes.length) return;
    setCopiedNodes(selectedNodes);
    setCopiedEdges(selectedEdges);
    setPasteCount(0);
  }, [edges, nodes, selectedNodeIds]);

  const pasteCopiedNodes = useCallback(() => {
    if (!copiedNodes || copiedNodes.length === 0) return;
    const offset = GRID_SIZE * 2 + pasteCount * GRID_SIZE;
    const idMap = new Map<string, string>();

    const newNodes: NodeData[] = copiedNodes.map(node => {
      const newId = generateId('node');
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        x: node.x + offset,
        y: node.y + offset
      };
    });

    const newEdges: EdgeData[] = (copiedEdges || [])
      .map(edge => {
        const sourceId = idMap.get(edge.sourceId);
        const targetId = idMap.get(edge.targetId);
        if (!sourceId || !targetId) return null;
        return {
          ...edge,
          id: generateId('edge'),
          sourceId,
          targetId
        };
      })
      .filter(Boolean) as EdgeData[];

    setNodesInternal(prev => [...prev, ...newNodes]);
    if (newEdges.length) {
      setEdgesInternal(prev => [...prev, ...newEdges]);
    }
    setSelectedNodeIdsInternal(newNodes.map(node => node.id));
    setSelectedEdgeIdInternal(null);
    setPasteCount(count => count + 1);
    commitHistory();
  }, [copiedEdges, copiedNodes, commitHistory, pasteCount, setEdgesInternal, setNodesInternal, setSelectedEdgeIdInternal, setSelectedNodeIdsInternal]);

  const applyOpenClawAction = useCallback((action: { action: string; payload?: any }) => {
    const payload = action.payload || {};

    if (action.action === 'CREATE_NODE') {
      const newNode: NodeData = {
        id: payload.id || generateId('node'),
        x: payload.x ?? GRID_SIZE * 2,
        y: payload.y ?? GRID_SIZE * 2,
        title: payload.title || 'New Task',
        description: payload.description || 'Describe your task here...',
        status: payload.status || NodeStatus.ToDo,
        width: payload.width || NODE_WIDTH,
        height: payload.height || NODE_HEIGHT,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        iconId: payload.iconId || 'github',
        githubIssueUrl: payload.githubIssueUrl || undefined,
      };
      setNodesInternal(prev => [...prev, newNode]);
      commitHistory();
      return;
    }

    if (action.action === 'UPDATE_NODE') {
      const nodeId = payload.nodeId || payload.id;
      if (!nodeId) return;
      setNodesInternal(prev => prev.map(node => node.id === nodeId ? {
        ...node,
        title: payload.title ?? node.title,
        description: payload.description ?? node.description,
        status: payload.status ?? node.status,
        x: payload.x ?? node.x,
        y: payload.y ?? node.y,
        width: payload.width ?? node.width,
        height: payload.height ?? node.height,
        tags: Array.isArray(payload.tags) ? payload.tags : node.tags,
        iconId: payload.iconId ?? node.iconId,
        githubIssueUrl: payload.githubIssueUrl ?? node.githubIssueUrl,
      } : node));
      commitHistory();
      return;
    }

    if (action.action === 'CREATE_EDGE') {
      const newEdge: EdgeData = {
        id: payload.id || generateId('edge'),
        sourceId: payload.sourceNodeId,
        targetId: payload.targetNodeId,
        sourceHandle: payload.sourceHandle,
        targetHandle: payload.targetHandle,
      };
      if (!newEdge.sourceId || !newEdge.targetId) return;
      setEdgesInternal(prev => [...prev, newEdge]);
      commitHistory();
      return;
    }

    if (action.action === 'CREATE_SUBTASKS') {
      const parentNodeId = payload.parentNodeId;
      const parentNodeTitle = payload.parentNodeTitle;
      const subtasks = Array.isArray(payload.subtasks) ? payload.subtasks : [];
      if (subtasks.length === 0) return;

      const parentNode = parentNodeId
        ? nodes.find(n => n.id === parentNodeId)
        : nodes.find(n => n.title === parentNodeTitle);
      if (!parentNode) return;

      const createdNodes: NodeData[] = [];
      const createdEdges: EdgeData[] = [];
      const baseX = parentNode.x;
      const baseY = parentNode.y + (parentNode.height || NODE_HEIGHT) + GRID_SIZE * 2;

      subtasks.forEach((task: any, index: number) => {
        const nodeId = task.id || generateId('node');
        const newNode: NodeData = {
          id: nodeId,
          x: task.x ?? baseX,
          y: task.y ?? baseY + index * GRID_SIZE * 2,
          title: task.title || `Subtask ${index + 1}`,
          description: task.description || '',
          status: task.status || NodeStatus.ToDo,
          width: task.width || NODE_WIDTH,
          height: task.height || NODE_HEIGHT,
          tags: Array.isArray(task.tags) ? task.tags : [],
          iconId: task.iconId || 'github',
          githubIssueUrl: task.githubIssueUrl || undefined,
        };
        createdNodes.push(newNode);
        createdEdges.push({
          id: generateId('edge'),
          sourceId: parentNode.id,
          targetId: nodeId,
          sourceHandle: task.sourceHandle,
          targetHandle: task.targetHandle,
        });
      });

      setNodesInternal(prev => [...prev, ...createdNodes]);
      setEdgesInternal(prev => [...prev, ...createdEdges]);
      commitHistory();
    }
  }, [GRID_SIZE, NODE_HEIGHT, NODE_WIDTH, commitHistory, nodes, setEdgesInternal, setNodesInternal]);

  const previousProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousProjectIdRef.current && previousProjectIdRef.current !== currentProjectId) {
      projectRepository.flushProjectSaves(previousProjectIdRef.current, {
        isAuthenticated,
        isOnline,
        hasBackendProject: !!backendProjects.find(p => p.id === previousProjectIdRef.current),
      });
    }
    previousProjectIdRef.current = currentProjectId;
  }, [currentProjectId, isAuthenticated, isOnline, backendProjects]);

  useEffect(() => {
    if (!currentProjectId) return;

    const addRecent = (action: { action: string; payload?: any }) => {
      setRecentOpenclawActions(prev => [{ ...action, timestamp: Date.now() }, ...prev].slice(0, 25));
    };

    const onAction = (action: any) => {
      applyOpenClawAction(action);
      addRecent(action);
    };

    let pollingEnabled = false;
    try {
      const socket = openclawService.connectWebSocket(currentProjectId, onAction);
      openclawSocketRef.current = socket;

      socket.addEventListener('close', () => {
        if (pollingEnabled) return;
        pollingEnabled = true;
        const interval = window.setInterval(async () => {
          try {
            const actions = await openclawService.pollActions(currentProjectId);
            actions.forEach(a => onAction(a));
          } catch (error) {
            console.warn('[OpenClaw] Poll failed:', error);
          }
        }, 2000);
        openclawPollRef.current = interval;
      });
    } catch {
      pollingEnabled = true;
    }

    if (pollingEnabled) {
      const interval = window.setInterval(async () => {
        try {
          const actions = await openclawService.pollActions(currentProjectId);
          actions.forEach(a => onAction(a));
        } catch (error) {
          console.warn('[OpenClaw] Poll failed:', error);
        }
      }, 2000);
      openclawPollRef.current = interval;
    }

    return () => {
      if (openclawPollRef.current) {
        window.clearInterval(openclawPollRef.current);
        openclawPollRef.current = null;
      }
      if (openclawSocketRef.current) {
        openclawSocketRef.current.close();
        openclawSocketRef.current = null;
      }
    };
  }, [currentProjectId, applyOpenClawAction]);

  // History management is handled in appReducer.

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!currentProjectId) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const key = event.key.toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey;

      if (hasModifier && key === 'c') {
        event.preventDefault();
        copySelectedNodes();
        return;
      }

      if (hasModifier && key === 'v') {
        event.preventDefault();
        pasteCopiedNodes();
        return;
      }

      if (selectedEdgeId && (event.key === 'Delete' || event.key === 'Backspace')) {
        setEdgesInternal(prevEdges => prevEdges.filter(edge => edge.id !== selectedEdgeId));
        setSelectedEdgeIdInternal(null); 
        commitHistory(); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, currentProjectId, commitHistory, copySelectedNodes, pasteCopiedNodes, setEdgesInternal, setSelectedEdgeIdInternal]);


  const calculateNewNodePosition = useCallback((parentNode?: NodeData, existingSubtasks?: NodeData[], specificPoint?: Point) => {
    if (specificPoint) {
      return {
        x: Math.round(specificPoint.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(specificPoint.y / GRID_SIZE) * GRID_SIZE,
      };
    }
    
    let newX = GRID_SIZE * 2;
    let newY = GRID_SIZE * 2;

    if (parentNode) {
        newX = parentNode.x;
        let potentialY = parentNode.y + (parentNode.height || NODE_HEIGHT) + GRID_SIZE * 2;

        if (existingSubtasks && existingSubtasks.length > 0) {
            const directSubtaskIds = new Set(edges.filter(e => e.sourceId === parentNode.id).map(e => e.targetId));
            const relevantSubtasks = existingSubtasks.filter(st => directSubtaskIds.has(st.id));

            if (relevantSubtasks.length > 0) {
                potentialY = Math.max(...relevantSubtasks.map(sn => sn.y + (sn.height || NODE_HEIGHT))) + GRID_SIZE * 1.5;
                
                const subtasksAtSameLevel = relevantSubtasks.filter(sn => Math.abs(sn.y - potentialY) < GRID_SIZE / 2);
                if (subtasksAtSameLevel.length > 0) {
                    newX = Math.max(...subtasksAtSameLevel.map(sn => sn.x + (sn.width || NODE_WIDTH))) + GRID_SIZE * 1.5;
                }
            }
        }
        newY = potentialY;
    } else if (nodes.length > 0) {
        const XOffset = GRID_SIZE * 1.5;
        let lastNode = nodes.reduce((latest, current) => (current.y > latest.y || (current.y === latest.y && current.x > latest.x)) ? current : latest, nodes[0] || {x:0,y:0,width:0,height:0, title:"", description:"", status: NodeStatus.ToDo, id:"", iconId: "github"});
        
        newX = lastNode.x + (lastNode.width || NODE_WIDTH) + XOffset;
        newY = lastNode.y;
    }
    return {
        x: Math.round(newX / GRID_SIZE) * GRID_SIZE,
        y: Math.round(newY / GRID_SIZE) * GRID_SIZE
    };
  }, [nodes, edges, GRID_SIZE, NODE_WIDTH, NODE_HEIGHT]);

  const createNodeAtPosition = useCallback((position: Point) => {
    if (!currentProjectId) return;
    const { x, y } = calculateNewNodePosition(undefined, undefined, position);
    const newNode: NodeData = {
      id: generateId('node'),
      x, y,
      title: 'New Task',
      description: 'Describe your task here...',
      status: NodeStatus.ToDo,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      tags: [],
      iconId: 'github',
      githubIssueUrl: undefined,
    };
    setNodesInternal(prev => [...prev, newNode]);
    setSelectedNodeIdsInternal([newNode.id]);
    setSelectedEdgeIdInternal(null);
    commitHistory();
  }, [calculateNewNodePosition, currentProjectId, commitHistory]);

  const manuallyAddNode = useCallback(() => {
    if (!currentProjectId) return;
    const { x, y } = calculateNewNodePosition();
    const newNode: NodeData = {
      id: generateId('node'),
      x, y,
      title: 'New Node',
      description: 'Enter description...',
      status: NodeStatus.ToDo,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      tags: [],
      iconId: 'github'
    };
    setNodesInternal(prev => [...prev, newNode]);
    setSelectedNodeIdsInternal([newNode.id]);
    setSelectedEdgeIdInternal(null);
    commitHistory();
  }, [calculateNewNodePosition, currentProjectId, commitHistory]);

  const handleClearCanvas = useCallback(() => {
    if (!currentProjectId) return;
    if (window.confirm('Are you sure you want to clear the entire canvas? This action cannot be undone.')) {
      setNodesInternal([]);
      setEdgesInternal([]);
      setSelectedNodeIdsInternal([]);
      setSelectedEdgeIdInternal(null);
      commitHistory();
    }
  }, [currentProjectId, commitHistory]);

  const handleAddNodeFromAI = useCallback((title: string, description: string, projectId: string, status: NodeStatus = NodeStatus.ToDo, tags: string[] = [], iconId: string = 'github', githubIssueUrl?: string): NodeData | null => {
    console.log("[handleAddNodeFromAI] Called with projectId:", projectId, "Title:", title);
    if (!projectId) {
      console.error("[handleAddNodeFromAI] Aborting: Null or invalid projectId provided:", projectId);
      return null;
    }

    // Check if a node with the same title was recently created (within 30 seconds)
    const now = Date.now();
    const recentTimestamp = recentlyCreatedNodes.get(title.toLowerCase());
    if (recentTimestamp && (now - recentTimestamp) < 30000) {
      console.warn("[handleAddNodeFromAI] Duplicate node creation prevented for title:", title, "Recent timestamp:", recentTimestamp);
      return null;
    }

    // Check if a node with the same title already exists
    const existingNode = nodes.find(node => node.title.toLowerCase() === title.toLowerCase());
    if (existingNode) {
      console.warn("[handleAddNodeFromAI] Node with same title already exists:", title, "Existing node ID:", existingNode.id);
      return existingNode; // Return existing node instead of creating duplicate
    }

    const { x, y } = calculateNewNodePosition(); 
    const newNode: NodeData = {
      id: generateId('node'), x, y, title, description, status,
      width: NODE_WIDTH, height: NODE_HEIGHT, tags: tags, iconId: iconId || 'github',
      githubIssueUrl: githubIssueUrl || undefined, 
    };
    console.log("[handleAddNodeFromAI] Creating node:", newNode.id, "for project:", projectId);
    
    // Track this node creation
    setRecentlyCreatedNodes(prev => new Map([...prev, [title.toLowerCase(), now]]));
    
    setNodesInternal(prev => [...prev, newNode]);
    setSelectedNodeIdsInternal([newNode.id]); 
    setSelectedEdgeIdInternal(null); 
    // Note: history commit is typically called by the caller (processAiResponseForAction) after all parts of an AI action are done.
    return newNode;
  }, [calculateNewNodePosition, recentlyCreatedNodes, nodes]);

  const handleUpdateNode = useCallback((updatedNode: NodeData) => {
    if (!currentProjectId) return;
    setNodesInternal(prev => 
      prev.map(node => node.id === updatedNode.id ? updatedNode : node)
    );
    commitHistory();
  }, [currentProjectId, commitHistory]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!currentProjectId) return;
    if (window.confirm('Are you sure you want to delete this node?')) {
      setNodesInternal(prev => prev.filter(node => node.id !== nodeId));
      setEdgesInternal(prev => prev.filter(edge => 
        edge.sourceId !== nodeId && edge.targetId !== nodeId
      ));
      setSelectedNodeIdsInternal(prev => prev.filter(id => id !== nodeId));
      commitHistory();
    }
  }, [currentProjectId, commitHistory]);
  
  const handleAddSubtaskNode = useCallback((
    parentNodeId: string, 
    subtaskTitle: string, 
    projectId: string, 
    subtaskDescription?: string, 
    subtaskTags: string[] = [], 
    subtaskIconId: string = 'github', 
    subtaskGithubIssueUrl?: string
  ): NodeData | null => {
    console.log("[handleAddSubtaskNode] Called with parentId:", parentNodeId, "Title:", subtaskTitle);
    if (!projectId) {
      console.error("[handleAddSubtaskNode] Aborting: Null or invalid projectId provided:", projectId);
      return null;
    }

    // Find the parent node to position subtask nearby
    const parentNode = nodes.find(node => node.id === parentNodeId);
    if (!parentNode) {
      console.error("[handleAddSubtaskNode] Parent node not found:", parentNodeId);
      return null;
    }

    // Position subtask to the right of parent node
    const subtaskX = parentNode.x + NODE_WIDTH + 50;
    const subtaskY = parentNode.y;

    const newSubtaskNode: NodeData = {
      id: generateId('subtask'),
      x: subtaskX,
      y: subtaskY,
      title: subtaskTitle,
      description: subtaskDescription || `Subtask of: ${parentNode.title}`,
      status: NodeStatus.ToDo,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      tags: subtaskTags,
      iconId: subtaskIconId || 'github',
      githubIssueUrl: subtaskGithubIssueUrl || undefined,
    };

    console.log("[handleAddSubtaskNode] Creating subtask node:", newSubtaskNode.id, "for project:", projectId);
    setNodesInternal(prev => [...prev, newSubtaskNode]);
    
    // Create an edge from parent to subtask
    const newEdge: EdgeData = {
      id: generateId('edge'),
      sourceId: parentNodeId,
      targetId: newSubtaskNode.id,
      sourceHandle: 'right',
      targetHandle: 'left',
    };
    
    setEdgesInternal(prev => [...prev, newEdge]);
    setSelectedNodeIdsInternal([newSubtaskNode.id]);
    setSelectedEdgeIdInternal(null);
    
    return newSubtaskNode;
  }, [nodes]);

  const applyAiActions = useCallback((actions: AiAction[], projectIdForAction: string | null, messageId: string) => {
    if (!projectIdForAction) {
      console.warn('[applyAiActions] No project ID provided');
      return false;
    }

    if (processedAiMessageIds.has(messageId)) {
      console.log('[applyAiActions] Message already processed, skipping:', messageId);
      return false;
    }

    let actionsProcessed = false;

    for (const actionData of actions) {
      if (actionData.action === 'CREATE_NODE') {
        console.log('[applyAiActions] Processing CREATE_NODE action:', actionData);

        const newNode = handleAddNodeFromAI(
          actionData.title || 'Untitled Node',
          actionData.description || '',
          projectIdForAction,
          NodeStatus.ToDo,
          actionData.tags || [],
          actionData.iconId || 'github',
          actionData.githubIssueUrl
        );

        if (newNode) {
          console.log('[applyAiActions] Successfully created node:', newNode.id);
          actionsProcessed = true;
        }
      } else if (actionData.action === 'CREATE_SUBTASKS') {
        console.log('[applyAiActions] Processing CREATE_SUBTASKS action:', actionData);

        const parentNode = nodes.find(node =>
          node.title.toLowerCase() === actionData.parentNodeTitle?.toLowerCase()
        );

        if (parentNode && actionData.subtasks) {
          for (const subtask of actionData.subtasks) {
            const subtaskNode = handleAddSubtaskNode(
              parentNode.id,
              subtask.title || 'Untitled Subtask',
              projectIdForAction,
              subtask.description || '',
              subtask.tags || [],
              subtask.iconId || 'github',
              subtask.githubIssueUrl
            );

            if (subtaskNode) {
              console.log('[applyAiActions] Successfully created subtask:', subtaskNode.id);
              actionsProcessed = true;
            }
          }
        } else {
          console.warn('[applyAiActions] Parent node not found for subtasks:', actionData.parentNodeTitle);
        }
      }
    }

    if (actionsProcessed) {
      commitHistory();
      console.log('[applyAiActions] Actions processed successfully, history updated');
    }

    setProcessedAiMessageIds(prev => new Set([...prev, messageId]));
    console.log('[applyAiActions] Message marked as processed:', messageId);

    return actionsProcessed;
  }, [handleAddNodeFromAI, handleAddSubtaskNode, nodes, processedAiMessageIds, commitHistory]);

  const processAiResponseForAction = useCallback((aiFullText: string, projectIdForAction: string | null, messageId: string) => {
    if (!projectIdForAction) {
      console.warn('[processAiResponseForAction] No project ID provided');
      return false;
    }

    if (processedAiMessageIds.has(messageId)) {
      console.log('[processAiResponseForAction] Message already processed, skipping:', messageId);
      return false;
    }

    console.log('[processAiResponseForAction] Processing AI response for actions...');

    try {
      const actions = parseAiActionsFromResponse(aiFullText);

      if (requireAiApproval && actions.length > 0) {
        setPendingAiActions(prev => [...prev, { id: messageId, projectId: projectIdForAction, actions }]);
        setProcessedAiMessageIds(prev => new Set([...prev, messageId]));
        pushToast('info', 'AI actions pending approval', 'Review and apply in Settings.');
        return false;
      }

      return applyAiActions(actions, projectIdForAction, messageId);
    } catch (error) {
      console.error('[processAiResponseForAction] Error processing AI response:', error);
      return false;
    }
  }, [applyAiActions, processedAiMessageIds, requireAiApproval, pushToast]);

  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!currentProjectId || !message.trim()) return;
    
    const userMessage: ChatMessage = {
      id: generateId('user-msg'),
      sender: 'user',
      text: message.trim(),
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsAiTyping(true);

    // Create an initial AI message that will be updated as chunks arrive
    const aiMessageId = generateId('ai-msg');
    setCurrentAiMessageId(aiMessageId);
    
    const initialAiMessage: ChatMessage = {
      id: aiMessageId,
      sender: 'ai',
      text: '',
      timestamp: Date.now(),
      isProcessing: true
    };
    
    setChatMessages(prev => [...prev, initialAiMessage]);

    streamAbortControllerRef.current?.abort();
    const streamAbortController = new AbortController();
    streamAbortControllerRef.current = streamAbortController;

    try {
      let fullResponseText = '';
      
      const chatPrompt = buildChatPrompt(message);
      const outgoingMessage = aiProvider.id === 'local' ? message : chatPrompt;

      // For now, use the existing AI provider with proper callbacks
      await aiProvider.sendMessageToChatStream(
        outgoingMessage,
        // onChunk callback - updates the AI message with streaming content
        (chunkText: string, isFinalChunk: boolean) => {
          if (!isFinalChunk && chunkText) {
            fullResponseText += chunkText;
          }
          
          setChatMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    text: fullResponseText,
                    isProcessing: !isFinalChunk 
                  }
                : msg
            )
          );
          
          // When streaming is complete, process actions
          if (isFinalChunk) {
            streamAbortControllerRef.current = null;
            console.log('[Chat] AI streaming complete, processing actions...', {
              fullResponseText,
              currentProjectId,
              aiMessageId
            });
            
            // Use setTimeout to ensure the message state is fully updated
            setTimeout(() => {
              processAiResponseForAction(fullResponseText, currentProjectId, aiMessageId);
            }, 200);
          }
        },
        // onError callback
        (errorMessage: string) => {
          streamAbortControllerRef.current = null;
          console.error('[Chat] Error during streaming:', errorMessage);
          setChatMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    text: errorMessage,
                    isProcessing: false 
                  }
                : msg
            )
          );
        },
        { signal: streamAbortController.signal }
      );
    } catch (error) {
      streamAbortControllerRef.current = null;
      console.error('[Chat] Error sending message:', error);
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === aiMessageId 
            ? { 
                ...msg, 
                text: 'An error occurred while generating response.',
                isProcessing: false 
              }
            : msg
        )
      );
    }

    setIsAiTyping(false);
    setCurrentAiMessageId(null);
  }, [currentProjectId, processAiResponseForAction]);

  const applyPendingAiActions = useCallback((pendingId: string) => {
    const pending = pendingAiActions.find(item => item.id === pendingId);
    if (!pending) return;
    const applied = applyAiActions(pending.actions, pending.projectId, pending.id);
    if (applied) {
      setPendingAiActions(prev => prev.filter(item => item.id !== pendingId));
    }
  }, [pendingAiActions, applyAiActions]);

  const handleResetChat = useCallback(() => {
    if (!currentProjectId) return;
    if (window.confirm('Are you sure you want to reset the chat? This will clear all conversation history.')) {
      streamAbortControllerRef.current?.abort();
      streamAbortControllerRef.current = null;
      setChatMessages([{
        id: generateId('ai-greet'),
        sender: 'ai',
        text: "Hello! I'm your AI planning assistant. How can I help you structure your project today?",
        timestamp: Date.now()
      }]);
      aiProvider.resetChatHistory();
    }
  }, [currentProjectId]);

  const primarySelectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;
  const selectedNodeDetails = primarySelectedNodeId ? nodes.find(n => n.id === primarySelectedNodeId) : null;
  
  const handleInteractionEnd = useCallback(() => {
    // TODO: Implement
  }, []);

  const handleUndo = useCallback(() => {
    if (!currentProjectId) return;
    dispatch({ type: 'UNDO' });
  }, [currentProjectId]);

  const handleRedo = useCallback(() => {
    if (!currentProjectId) return;
    dispatch({ type: 'REDO' });
  }, [currentProjectId]);

  const toggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);

  const zoomIn = useCallback(() => {
    canvasRef.current?.zoomInCanvas();
  }, []);

  const zoomOut = useCallback(() => {
    canvasRef.current?.zoomOutCanvas();
  }, []);

  const fitViewToNodes = useCallback(() => {
    canvasRef.current?.fitView(nodes);
  }, [nodes]);
  
  const toggleSettingsPanel = useCallback(() => {
    setIsSettingsPanelOpen(prev => !prev);
  }, []);

  const handleLogin = useCallback((username: string) => {
    if (!username.trim()) return;
    const user: LegacyUser = {
      username: username.trim(),
      avatarUrl: `https://github.com/${username.trim()}.png`,
    };
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const handleCreateProject = useCallback(async (projectName: string) => {
    if (!projectName.trim()) return;
    
    try {
      let newProject: LegacyProject;
      
      if (isAuthenticated && isOnline) {
        // Create project in backend
        const backendProject = await projectService.createProject({
          name: projectName.trim(),
          github_repo_url: '',
          team_member_usernames: []
        });
        
        // Convert to legacy format
        newProject = {
          id: backendProject.id,
          name: backendProject.name,
          ownerUsername: currentUser?.username || 'local',
          createdAt: Date.now(),
          githubRepoUrl: '',
          teamMemberUsernames: [],
        };
        
        // Update backend projects list
        setBackendProjects(prev => [...prev, backendProject]);
      } else {
        // Create locally only
        newProject = {
          id: generateId('project'),
          name: projectName.trim(),
          ownerUsername: currentUser?.username || 'local',
          createdAt: Date.now(),
          githubRepoUrl: '',
          teamMemberUsernames: [],
        };
      }
      
      setProjects(prev => [...prev, newProject]);
      setCurrentProjectId(newProject.id);
      await loadProjectData(newProject.id); 
      commitHistory();
    } catch (error) {
      console.error('[App] Failed to create project:', error);
      // Fall back to local creation
      const newProject: LegacyProject = {
        id: generateId('project'),
        name: projectName.trim(),
        ownerUsername: currentUser?.username || 'local',
        createdAt: Date.now(),
        githubRepoUrl: '',
        teamMemberUsernames: [],
      };
      setProjects(prev => [...prev, newProject]);
      setCurrentProjectId(newProject.id);
      await loadProjectData(newProject.id);
      commitHistory();
    }
  }, [currentUser, loadProjectData, isAuthenticated, isOnline, commitHistory]);

  const handleSwitchProject = useCallback((projectId: string) => {
    if (projectId === currentProjectId) return;
    setCurrentProjectId(projectId);
    loadProjectData(projectId);
  }, [currentProjectId, loadProjectData]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (window.confirm(`Are you sure you want to delete project "${projects.find(p=>p.id === projectId)?.name}"? This action cannot be undone.`)) {
        if (isAuthenticated && isOnline && backendProjects.find(p => p.id === projectId)) {
          try {
            await projectService.deleteProject(projectId);
            setBackendProjects(prev => prev.filter(p => p.id !== projectId));
          } catch (error) {
            console.error('[App] Failed to delete backend project:', error);
            pushToast('error', 'Delete failed', 'Unable to delete the project from the server.');
            return;
          }
        }

        const remainingProjects = projects.filter(p => p.id !== projectId);
        setProjects(remainingProjects);
        
        projectRepository.deleteProjectData(projectId);

        if (currentProjectId === projectId) {
            if (remainingProjects.length > 0) {
                setCurrentProjectId(remainingProjects[0].id);
                loadProjectData(remainingProjects[0].id);
            } else {
                const defaultProjectName = "Default Project";
                const newProject: LegacyProject = { id: generateId('project'), name: defaultProjectName, ownerUsername: currentUser?.username || 'local', createdAt: Date.now(), githubRepoUrl: '', teamMemberUsernames: [] };
                setProjects([newProject]);
                setCurrentProjectId(newProject.id);
                loadProjectData(newProject.id);
                commitHistory(); 
            }
        }
    }
  }, [projects, currentProjectId, currentUser, loadProjectData, commitHistory, isAuthenticated, isOnline, backendProjects, pushToast]);

  const handleUpdateProjectDetails = useCallback(async (projectId: string, updates: Partial<Pick<LegacyProject, 'name' | 'githubRepoUrl' | 'teamMemberUsernames' | 'teamMembers'>>) => {
    setProjects(prevProjects => 
      prevProjects.map(p => 
        p.id === projectId ? { ...p, ...updates } : p
      )
    );

    if (updates.teamMembers && !updates.teamMemberUsernames) {
      const usernames = updates.teamMembers.map(member => member.username);
      setProjects(prevProjects => 
        prevProjects.map(p => 
          p.id === projectId ? { ...p, teamMemberUsernames: usernames } : p
        )
      );
    }

    if (isAuthenticated && isOnline && backendProjects.find(p => p.id === projectId)) {
      try {
        const payload = {
          name: updates.name,
          github_repo_url: updates.githubRepoUrl,
          team_member_usernames: updates.teamMemberUsernames,
          team_members: updates.teamMembers,
        };
        const updated = await projectService.updateProject(projectId, payload);
        setBackendProjects(prev => prev.map(p => p.id === projectId ? updated : p));
      } catch (error) {
        console.error('[App] Failed to update backend project:', error);
        pushToast('error', 'Update failed', 'Unable to update the project on the server.');
      }
    }
  }, [isAuthenticated, isOnline, backendProjects, pushToast]);

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentProjectName = currentProject?.name || "";
  const currentProjectTeamAvatars = (currentProject?.teamMembers?.length
    ? currentProject.teamMembers.map(member => member.username)
    : (currentProject?.teamMemberUsernames || []))
    .slice(0, 4) 
    .map(username => `https://github.com/${username.trim()}.png`);
  
  const handleExportMarkdown = useCallback(() => {
    if (!currentProject || nodes.length === 0) {
        alert("No project selected or no nodes to export.");
        return;
    }
    const markdownContent = generatePlanMarkdown(currentProject, nodes, edges);
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeProjectName = currentProject.name.replace(/[^a-z0-9_.-]/gi, '_') || 'plan';
    link.download = `${safeProjectName}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentProject, nodes, edges]);

  const handleAutoLayoutNodes = useCallback(() => {
    if (!currentProjectId || nodes.length < 1) return;
    const laidOutNodes = autoLayoutNodes(nodes, edges);
    setNodesInternal(laidOutNodes);
    commitHistory();
    if(canvasRef.current) canvasRef.current.fitView(laidOutNodes);
  }, [currentProjectId, nodes, edges, commitHistory]);


  const setNodesFromCanvas = useCallback((updater: React.SetStateAction<NodeData[]>) => {
    if (!currentProjectId) return;
    setNodesInternal(updater);
  }, [currentProjectId, setNodesInternal]);

  const setEdgesFromCanvas = useCallback((updater: React.SetStateAction<EdgeData[]>) => {
    if (!currentProjectId) return;
    setEdgesInternal(updater);
  }, [currentProjectId, setEdgesInternal]);

   const setSelectedNodeIdsFromCanvas = useCallback((updater: React.SetStateAction<string[]>) => {
    if (!currentProjectId) return;
    setSelectedNodeIdsInternal(updater);
  }, [currentProjectId, setSelectedNodeIdsInternal]);

  const setSelectedEdgeIdFromCanvas = useCallback((updater: React.SetStateAction<string|null>) => {
    if (!currentProjectId) return;
    setSelectedEdgeIdInternal(updater);
  }, [currentProjectId, setSelectedEdgeIdInternal]);

  const handleOpenContextMenu = useCallback((clientX: number, clientY: number, svgX: number, svgY: number) => {
    setContextMenuState({ clientX, clientY, svgX, svgY, kind: 'canvas' });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);

  const handleContextMenuCreateNode = useCallback(() => {
    if (contextMenuState?.kind === 'canvas' && contextMenuState.svgX !== undefined && contextMenuState.svgY !== undefined) {
      createNodeAtPosition({ x: contextMenuState.svgX, y: contextMenuState.svgY });
    }
    handleCloseContextMenu();
  }, [contextMenuState, createNodeAtPosition, handleCloseContextMenu]);

  const handleOpenEdgeContextMenu = useCallback((clientX: number, clientY: number, edgeId: string) => {
    setContextMenuState({ clientX, clientY, kind: 'edge', edgeId });
  }, []);

  const handleContextMenuDeleteEdge = useCallback(() => {
    if (contextMenuState?.kind !== 'edge' || !contextMenuState.edgeId) return;
    setEdgesInternal(prevEdges => prevEdges.filter(edge => edge.id !== contextMenuState.edgeId));
    setSelectedEdgeIdInternal(null);
    commitHistory();
    handleCloseContextMenu();
  }, [contextMenuState, setEdgesInternal, setSelectedEdgeIdInternal, commitHistory, handleCloseContextMenu]);

  const showOfflineBanner = !isOnline || !apiHealthy;
  const offlineMessage = !isOnline
    ? 'You are offline. Local changes will be saved and synced later.'
    : 'Backend is unreachable. Some features may be unavailable.';

  const filteredNodes = useMemo(() => {
    const query = nodeSearchQuery.trim().toLowerCase();
    if (!query) return nodes;
    return nodes.filter(node => {
      const haystack = [
        node.title,
        node.description,
        ...(node.tags || [])
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [nodeSearchQuery, nodes]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(node => node.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    if (!nodeSearchQuery.trim()) return edges;
    return edges.filter(edge => filteredNodeIds.has(edge.sourceId) && filteredNodeIds.has(edge.targetId));
  }, [edges, filteredNodeIds, nodeSearchQuery]);

  return (
    <>
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-amber-900/80 text-amber-100 text-sm px-4 py-2 flex items-center justify-between border-b border-amber-500/40">
          <span>{offlineMessage}</span>
          <button
            onClick={checkApiHealth}
            disabled={isCheckingHealth}
            className="text-xs px-3 py-1 rounded bg-amber-700/80 hover:bg-amber-600/80 disabled:opacity-60"
          >
            {isCheckingHealth ? 'Checking…' : 'Retry'}
          </button>
        </div>
      )}
      <div className={showOfflineBanner ? 'pt-10' : ''}>
      <MainLayout
      header={
        <Header
          onCreateNode={manuallyAddNode}
          onClearCanvas={handleClearCanvas}
          onSettingsClick={toggleSettingsPanel}
          currentUser={currentUser}
          currentProjectName={currentProjectName}
          currentProjectRepoUrl={currentProject?.githubRepoUrl}
          currentProjectTeamAvatars={currentProjectTeamAvatars}
          nodeSearchQuery={nodeSearchQuery}
          onNodeSearchChange={setNodeSearchQuery}
        />
      }
      left={
        <LeftControlsToolbar
          onToggleGrid={toggleGrid}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitToScreen={fitViewToNodes}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={currentProjectId ? historyIndex > 0 : false}
          canRedo={currentProjectId ? historyIndex < history.length - 1 && history.length > 0 : false}
          onAutoLayoutNodes={handleAutoLayoutNodes}
          nodesCount={nodes.length}
        />
      }
      canvas={
        <main className="flex-1 relative bg-dark-surface">
          {currentProjectId ? (
            <NodePlannerCanvas
              ref={canvasRef}
              nodes={filteredNodes}
              edges={filteredEdges}
              setNodes={setNodesFromCanvas}
              setEdges={setEdgesFromCanvas}
              selectedNodeIds={selectedNodeIds}
              setSelectedNodeIds={setSelectedNodeIdsFromCanvas}
              selectedEdgeId={selectedEdgeId}
              setSelectedEdgeId={setSelectedEdgeIdFromCanvas}
              connectingInfo={connectingInfo}
              setConnectingInfo={setConnectingInfo}
              showGrid={showGrid}
              onInteractionEnd={handleInteractionEnd}
              onCanvasDoubleClick={createNodeAtPosition}
              onCanvasContextMenu={handleOpenContextMenu}
              onEdgeContextMenu={handleOpenEdgeContextMenu}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-dark-text-secondary">
                Create or select a project from Settings to begin.
            </div>
          )}
        </main>
      }
      right={
        <div className="w-80 h-full flex flex-col border-l border-dark-border bg-dark-bg">
            <div className={`
                ${selectedNodeDetails ? 'h-2/5' : 'h-full'} 
                flex flex-col overflow-hidden 
            `}>
                <ChatPanel 
                    messages={chatMessages}
                    onSendMessage={currentProjectId ? handleSendChatMessage : async () => {
                        console.warn("[ChatPanel] SendMessage called but no current project ID. This should be blocked by UI.");
                         setChatMessages(prev => [...prev, {
                            id: generateId('error-system'), sender: 'ai',
                            text: "Cannot send message: No active project selected.",
                            timestamp: Date.now(), isError: true
                        }]);
                    }}
                    isAiTyping={isAiTyping || (!!currentAiMessageId)}
                    onResetChat={currentProjectId ? handleResetChat : () => {}}
                    disabled={!currentProjectId}
                />
            </div>
            {currentProjectId && selectedNodeDetails && (
                <div className="h-3/5 flex flex-col overflow-hidden border-t border-dark-border">
                    <NodeEditorSidebar
                        node={selectedNodeDetails} 
                        onUpdateNode={handleUpdateNode}
                        onDeleteNode={handleDeleteNode}
                        onAddSubtaskNode={(parentId, title) => handleAddSubtaskNode(parentId, title, currentProjectId, `Subtask of selected parent.`)} 
                        currentProjectGitHubRepoUrl={currentProject?.githubRepoUrl} 
                    />
                </div>
            )}
             {!currentProjectId && !selectedNodeDetails && (
                 <div className="h-3/5 flex flex-col items-center justify-center text-dark-text-secondary p-4 border-t border-dark-border">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 opacity-30 mb-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Select a project to view details.
                 </div>
             )}
        </div>
      }
      settings={
        <SettingsPanel 
          isOpen={isSettingsPanelOpen} 
          onClose={toggleSettingsPanel}
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          projects={projects}
          currentProjectId={currentProjectId}
          onCreateProject={handleCreateProject}
          onSwitchProject={handleSwitchProject}
          onDeleteProject={handleDeleteProject}
          onUpdateProjectDetails={handleUpdateProjectDetails}
          onExportMarkdown={handleExportMarkdown}
          currentNodesCount={nodes.length}
          recentOpenclawActions={recentOpenclawActions}
          requireAiApproval={requireAiApproval}
          onToggleAiApproval={setRequireAiApproval}
          pendingAiActions={pendingAiActions}
          onApplyPendingAiAction={applyPendingAiActions}
        />
      }
      contextMenu={
        contextMenuState && currentProjectId ? (
          <ContextMenu
            clientX={contextMenuState.clientX}
            clientY={contextMenuState.clientY}
            onClose={handleCloseContextMenu}
            onCreateNodeAtPosition={contextMenuState.kind === 'canvas' ? handleContextMenuCreateNode : undefined}
            onCopyNodes={contextMenuState.kind === 'canvas' && selectedNodeIds.length > 0 ? copySelectedNodes : undefined}
            onPasteNodes={contextMenuState.kind === 'canvas' && copiedNodes?.length ? pasteCopiedNodes : undefined}
            onDeleteEdge={contextMenuState.kind === 'edge' ? handleContextMenuDeleteEdge : undefined}
          />
        ) : null
      }
    />
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export default App;
