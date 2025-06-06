import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NodeData, EdgeData, NodeStatus, Point, ChatMessage, AiAction, AiCreateNodeAction, AiCreateSubtasksAction, User as LegacyUser, Project as LegacyProject } from './types';
import { NODE_WIDTH, NODE_HEIGHT, GRID_SIZE, HISTORY_LIMIT } from './constants';
import { sendMessageToChatStream, resetChatHistory as resetGeminiChatHistory } from './services/geminiService';
import { generatePlanMarkdown } from './services/markdownService';
import { autoLayoutNodes } from './services/layoutService';

// New backend service imports
import { 
  authService, 
  projectService, 
  backendAiService, 
  migrationService,
  apiClient,
  type Project as BackendProject,
  type User as BackendUser,
  type MigrationStatus
} from './services/index.js';

import NodePlannerCanvas, { NodePlannerCanvasHandle } from './components/NodePlannerCanvas';
import NodeEditorSidebar from './components/NodeEditorSidebar';
import ChatPanel from './components/ChatPanel';
import Header from './components/Header';
import LeftControlsToolbar from './components/LeftControlsToolbar';
import SettingsPanel from './components/SettingsPanel';
import ContextMenu from './components/ContextMenu';

const generateId = (prefix: string = 'id'): string => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

// Convert BackendUser to LegacyUser format for compatibility
const convertBackendUserToLegacy = (backendUser: BackendUser): LegacyUser => ({
  username: backendUser.username,
  avatarUrl: `https://github.com/${backendUser.username}.png`
});

interface HistoryState {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
}

interface ContextMenuState {
  clientX: number;
  clientY: number;
  svgX: number;
  svgY: number;
}

const App: React.FC = () => {
  // Backend integration state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<LegacyUser | null>(null);
  const [backendProjects, setBackendProjects] = useState<BackendProject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Legacy state (for backward compatibility during transition)
  const [projects, setProjects] = useState<LegacyProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [nodes, setNodesInternal] = useState<NodeData[]>([]);
  const [edges, setEdgesInternal] = useState<EdgeData[]>([]);
  const [selectedNodeIds, setSelectedNodeIdsInternal] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeIdInternal] = useState<string | null>(null);
  const [connectingInfo, setConnectingInfo] = useState<{ sourceId: string; sourceHandle: 'top' | 'bottom' | 'left' | 'right'; mousePosition: Point } | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [currentAiMessageId, setCurrentAiMessageId] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyIndexRef = useRef<number>(-1); 

  const [historyTrigger, setHistoryTrigger] = useState<number>(0); 

  const [showGrid, setShowGrid] = useState<boolean>(true);
  const canvasRef = useRef<NodePlannerCanvasHandle>(null);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);

  // State for tracking processed AI messages to prevent duplicate action processing
  const [processedAiMessageIds, setProcessedAiMessageIds] = useState<Set<string>>(new Set());
  const [recentlyCreatedNodes, setRecentlyCreatedNodes] = useState<Map<string, number>>(new Map());

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
            // Load project nodes and edges from backend
            // For now, fall back to localStorage while we implement this
            // TODO: Implement backend project data loading
          }
        } catch (error) {
          console.warn('[App] Failed to load from backend, falling back to localStorage:', error);
        }
      }
      
      // Load from localStorage (current implementation)
      const nodesKey = getProjectScopedKey('plannerNodes', projectId);
      const edgesKey = getProjectScopedKey('plannerEdges', projectId);
      const chatKey = getProjectScopedKey('plannerChatMessages', projectId);
      const selectedNodesKey = getProjectScopedKey('plannerSelectedNodeIds', projectId);
      const selectedEdgeKey = getProjectScopedKey('plannerSelectedEdgeId', projectId);
      const historyKey = getProjectScopedKey('plannerHistory', projectId);
      const historyIndexKey = getProjectScopedKey('plannerHistoryIndex', projectId);

      const initialNodes: NodeData[] = nodesKey && localStorage.getItem(nodesKey) ? JSON.parse(localStorage.getItem(nodesKey)!).map((node: NodeData) => ({
          ...node,
          width: node.width || NODE_WIDTH,
          height: node.height || NODE_HEIGHT,
          tags: Array.isArray(node.tags) ? node.tags : [],
          iconId: node.iconId || 'github', 
          githubIssueUrl: node.githubIssueUrl || undefined, 
      })) : [];
      const initialEdges: EdgeData[] = edgesKey && localStorage.getItem(edgesKey) ? JSON.parse(localStorage.getItem(edgesKey)!) : [];
      const initialSelectedNodes: string[] = selectedNodesKey && localStorage.getItem(selectedNodesKey) ? JSON.parse(localStorage.getItem(selectedNodesKey)!) : [];
      const initialSelectedEdge: string | null = selectedEdgeKey && localStorage.getItem(selectedEdgeKey) ? JSON.parse(localStorage.getItem(selectedEdgeKey)!) : null;
      const initialChat: ChatMessage[] = chatKey && localStorage.getItem(chatKey) ? JSON.parse(localStorage.getItem(chatKey)!) : [{
          id: generateId('ai-greet'), sender: 'ai',
          text: "Hello! I'm your AI planning assistant. How can I help you structure your project today?",
          timestamp: Date.now()
      }];
      
      const loadedHistory: HistoryState[] = historyKey && localStorage.getItem(historyKey) ? JSON.parse(localStorage.getItem(historyKey)!) : [];
      let initialHistory: HistoryState[];
      let initialHistoryIndex: number;

      if (loadedHistory.length > 0) {
          initialHistory = loadedHistory;
          initialHistoryIndex = historyIndexKey && localStorage.getItem(historyIndexKey) ? parseInt(localStorage.getItem(historyIndexKey)!, 10) : initialHistory.length -1;
          if (initialHistoryIndex < 0 || initialHistoryIndex >= initialHistory.length) {
               initialHistoryIndex = initialHistory.length - 1;
          }
      } else {
          initialHistory = [{ nodes: initialNodes, edges: initialEdges, selectedNodeIds: initialSelectedNodes, selectedEdgeId: initialSelectedEdge }];
          initialHistoryIndex = 0;
      }
      
      setNodesInternal(initialNodes);
      setEdgesInternal(initialEdges);
      setSelectedNodeIdsInternal(initialSelectedNodes);
      setSelectedEdgeIdInternal(initialSelectedEdge);
      setChatMessages(initialChat.map(m => ({...m, isProcessing: false})));
      setHistory(initialHistory);
      historyIndexRef.current = initialHistoryIndex;
      setHistoryIndex(initialHistoryIndex);
      setConnectingInfo(null); 
      if (canvasRef.current) canvasRef.current.fitView(initialNodes);

    } catch (error) {
      console.error('[App] Failed to load project data:', error);
      // Initialize with empty state on error
      const initialHistory = [{ nodes: [], edges: [], selectedNodeIds: [], selectedEdgeId: null }];
      setNodesInternal([]);
      setEdgesInternal([]);
      setSelectedNodeIdsInternal([]);
      setSelectedEdgeIdInternal(null);
      setChatMessages([{
        id: generateId('ai-greet'), sender: 'ai',
        text: "Hello! I'm your AI planning assistant. How can I help you structure your project today?",
        timestamp: Date.now()
      }]);
      setHistory(initialHistory);
      historyIndexRef.current = 0;
      setHistoryIndex(0);
      setConnectingInfo(null);
    }
     }, [isAuthenticated, isOnline, backendProjects]);

  // Initialize projects (after authentication is determined)
  useEffect(() => {
    if (isLoading) return; // Wait for auth to complete
    
    const initializeProjects = () => {
      console.log('[App] Initializing projects...');
      
      // Load legacy localStorage projects for backward compatibility
      const savedProjects = localStorage.getItem('plannerProjects');
      const savedCurrentProjectId = localStorage.getItem('plannerCurrentProjectId');

      let loadedProjects: LegacyProject[] = [];
      if (savedProjects) {
        try { 
          loadedProjects = JSON.parse(savedProjects).map((p: LegacyProject) => ({
            ...p,
            githubRepoUrl: p.githubRepoUrl || '',
            teamMemberUsernames: Array.isArray(p.teamMemberUsernames) ? p.teamMemberUsernames : []
          })); 
        } catch(e) { 
          console.error("Failed to parse projects", e); 
        }
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
  }, [isLoading, currentUser?.username, loadProjectData]);

  const getProjectScopedKey = (baseKey: string, projectId?: string | null) => {
    const pid = projectId || currentProjectId;
    if (!pid) return null; 
    return `${baseKey}_${pid}`;
  };

    // Auto-save project data with backend integration
  useEffect(() => {
    if (!currentProjectId) return;
    
    const saveProjectData = async () => {
      try {
        // Save to localStorage (immediate backup)
        localStorage.setItem(getProjectScopedKey('plannerNodes')!, JSON.stringify(nodes));
        
        // If authenticated and online, also save to backend
        if (isAuthenticated && isOnline && backendProjects.find(p => p.id === currentProjectId)) {
          // TODO: Implement backend project data saving
          console.log('[App] TODO: Save nodes to backend for project:', currentProjectId);
        }
      } catch (error) {
        console.error('[App] Failed to save nodes:', error);
      }
    };
    
    saveProjectData();
  }, [nodes, currentProjectId, isAuthenticated, isOnline, backendProjects]);

  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerEdges')!, JSON.stringify(edges)); }, [edges, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerChatMessages')!, JSON.stringify(chatMessages)); }, [chatMessages, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerSelectedNodeIds')!, JSON.stringify(selectedNodeIds)); }, [selectedNodeIds, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerSelectedEdgeId')!, JSON.stringify(selectedEdgeId)); }, [selectedEdgeId, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerHistory')!, JSON.stringify(history)); }, [history, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerHistoryIndex')!, historyIndex.toString()); }, [historyIndex, currentProjectId]);

  useEffect(() => { localStorage.setItem('plannerProjects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { if (currentProjectId) localStorage.setItem('plannerCurrentProjectId', currentProjectId);}, [currentProjectId]);
  useEffect(() => { currentUser && localStorage.setItem('plannerUser', JSON.stringify(currentUser)); }, [currentUser]);


  const pushCurrentStateToHistory = useCallback(() => {
    if (!currentProjectId) return;

    const currentState: HistoryState = {
        nodes: JSON.parse(JSON.stringify(nodes)), 
        edges: JSON.parse(JSON.stringify(edges)), 
        selectedNodeIds: [...selectedNodeIds],
        selectedEdgeId: selectedEdgeId,
    };

    setHistory(prevHistory => {
        const newHistoryBase = prevHistory.slice(0, historyIndexRef.current + 1);
        const updatedHistory = [...newHistoryBase, currentState];
        
        const finalHistory = updatedHistory.length > HISTORY_LIMIT 
            ? updatedHistory.slice(updatedHistory.length - HISTORY_LIMIT) 
            : updatedHistory;
        
        historyIndexRef.current = finalHistory.length - 1;
        setHistoryIndex(historyIndexRef.current);
        return finalHistory;
    });
  }, [nodes, edges, selectedNodeIds, selectedEdgeId, currentProjectId]); 

  useEffect(() => {
    if (historyTrigger > 0 && currentProjectId) { 
        pushCurrentStateToHistory();
    }
  }, [historyTrigger, pushCurrentStateToHistory, currentProjectId]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!currentProjectId) return;
      if (selectedEdgeId && (event.key === 'Delete' || event.key === 'Backspace')) {
        setEdgesInternal(prevEdges => prevEdges.filter(edge => edge.id !== selectedEdgeId));
        setSelectedEdgeIdInternal(null); 
        setHistoryTrigger(c => c + 1); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, currentProjectId]);


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
        const YOffset = GRID_SIZE * 1.5;
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
    setHistoryTrigger(c => c + 1);
  }, [calculateNewNodePosition, currentProjectId]);

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
    setHistoryTrigger(c => c + 1);
  }, [calculateNewNodePosition, currentProjectId]);

  const handleClearCanvas = useCallback(() => {
    if (!currentProjectId) return;
    if (window.confirm('Are you sure you want to clear the entire canvas? This action cannot be undone.')) {
      setNodesInternal([]);
      setEdgesInternal([]);
      setSelectedNodeIdsInternal([]);
      setSelectedEdgeIdInternal(null);
      setHistoryTrigger(c => c + 1);
    }
  }, [currentProjectId]);

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
    // Note: history trigger is typically called by the caller (processAiResponseForAction) after all parts of an AI action are done.
    return newNode;
  }, [calculateNewNodePosition, recentlyCreatedNodes, nodes]);

  const handleUpdateNode = useCallback((updatedNode: NodeData) => {
    if (!currentProjectId) return;
    setNodesInternal(prev => 
      prev.map(node => node.id === updatedNode.id ? updatedNode : node)
    );
    setHistoryTrigger(c => c + 1);
  }, [currentProjectId]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!currentProjectId) return;
    if (window.confirm('Are you sure you want to delete this node?')) {
      setNodesInternal(prev => prev.filter(node => node.id !== nodeId));
      setEdgesInternal(prev => prev.filter(edge => 
        edge.sourceId !== nodeId && edge.targetId !== nodeId
      ));
      setSelectedNodeIdsInternal(prev => prev.filter(id => id !== nodeId));
      setHistoryTrigger(c => c + 1);
    }
  }, [currentProjectId]);
  
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

  const processAiResponseForAction = useCallback((aiFullText: string, projectIdForAction: string | null, messageId: string) => {
    if (!projectIdForAction) {
      console.warn('[processAiResponseForAction] No project ID provided');
      return false;
    }

    // Check if this message has already been processed
    if (processedAiMessageIds.has(messageId)) {
      console.log('[processAiResponseForAction] Message already processed, skipping:', messageId);
      return false;
    }

    console.log('[processAiResponseForAction] Processing AI response for actions...');
    
    let actionsProcessed = false;
    
    try {
      // Look for JSON action patterns in the AI response
      // Pattern 1: Pure JSON object (most common from our system instruction)
      const pureJsonMatch = aiFullText.match(/^\s*\{[^}]*"action"[^}]*\}$/m);
      
      // Pattern 2: JSON within markdown code blocks
      const codeBlockMatches = aiFullText.match(/```json\s*([\s\S]*?)\s*```/g);
      
      // Pattern 3: JSON objects anywhere in the text
      const jsonMatches = aiFullText.match(/\{[^}]*"action"[^}]*\}/g);
      
      const jsonCandidates: string[] = [];
      const processedJsonStrings = new Set<string>(); // Prevent duplicate JSON processing
      
      if (pureJsonMatch) {
        const jsonStr = pureJsonMatch[0].trim();
        if (!processedJsonStrings.has(jsonStr)) {
          jsonCandidates.push(jsonStr);
          processedJsonStrings.add(jsonStr);
        }
      }
      
      if (codeBlockMatches) {
        codeBlockMatches.forEach(match => {
          const content = match.replace(/```json\s*/, '').replace(/\s*```/, '').trim();
          if (!processedJsonStrings.has(content)) {
            jsonCandidates.push(content);
            processedJsonStrings.add(content);
          }
        });
      }
      
      if (jsonMatches) {
        jsonMatches.forEach(match => {
          const jsonStr = match.trim();
          if (!processedJsonStrings.has(jsonStr)) {
            jsonCandidates.push(jsonStr);
            processedJsonStrings.add(jsonStr);
          }
        });
      }

      // Process each unique JSON candidate
      for (const jsonStr of jsonCandidates) {
        try {
          const actionData = JSON.parse(jsonStr);
          
          if (actionData.action === 'CREATE_NODE') {
            console.log('[processAiResponseForAction] Processing CREATE_NODE action:', actionData);
            
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
              console.log('[processAiResponseForAction] Successfully created node:', newNode.id);
              actionsProcessed = true;
            }
          } else if (actionData.action === 'CREATE_SUBTASKS') {
            console.log('[processAiResponseForAction] Processing CREATE_SUBTASKS action:', actionData);
            
            // Find the parent node by title
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
                  console.log('[processAiResponseForAction] Successfully created subtask:', subtaskNode.id);
                  actionsProcessed = true;
                }
              }
            } else {
              console.warn('[processAiResponseForAction] Parent node not found for subtasks:', actionData.parentNodeTitle);
            }
          }
        } catch (parseError) {
          console.warn('[processAiResponseForAction] Failed to parse JSON action:', parseError, 'JSON:', jsonStr);
        }
      }
      
      // Trigger history update if any actions were processed
      if (actionsProcessed) {
        setHistoryTrigger(c => c + 1);
        console.log('[processAiResponseForAction] Actions processed successfully, history updated');
      }
      
      // Mark this message as processed regardless of whether actions were found
      setProcessedAiMessageIds(prev => new Set([...prev, messageId]));
      console.log('[processAiResponseForAction] Message marked as processed:', messageId);
      
    } catch (error) {
      console.error('[processAiResponseForAction] Error processing AI response:', error);
    }
    
    return actionsProcessed;
  }, [handleAddNodeFromAI, handleAddSubtaskNode, nodes, processedAiMessageIds]);

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

    try {
      let fullResponseText = '';
      
      // For now, use the existing Gemini service with proper callbacks
      await sendMessageToChatStream(
        message,
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
        }
      );
    } catch (error) {
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

  const handleResetChat = useCallback(() => {
    if (!currentProjectId) return;
    if (window.confirm('Are you sure you want to reset the chat? This will clear all conversation history.')) {
      setChatMessages([{
        id: generateId('ai-greet'),
        sender: 'ai',
        text: "Hello! I'm your AI planning assistant. How can I help you structure your project today?",
        timestamp: Date.now()
      }]);
      resetGeminiChatHistory();
    }
  }, [currentProjectId]);

  const primarySelectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;
  const selectedNodeDetails = primarySelectedNodeId ? nodes.find(n => n.id === primarySelectedNodeId) : null;
  
  const handleInteractionEnd = useCallback(() => {
    // TODO: Implement
  }, []);

  const handleUndo = useCallback(() => {
    // TODO: Implement
  }, []);

  const handleRedo = useCallback(() => {
    // TODO: Implement
  }, []);

  const toggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);

  const zoomIn = useCallback(() => {
    canvasRef.current?.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    canvasRef.current?.zoomOut();
  }, []);

  const fitViewToNodes = useCallback(() => {
    canvasRef.current?.fitView(nodes);
  }, [nodes]);
  
  const toggleSettingsPanel = useCallback(() => {
    setIsSettingsPanelOpen(prev => !prev);
  }, []);

  const handleLogin = useCallback(async (username: string, password: string) => {
    try {
      const result = await authService.login(username, password);
      if (result.success && result.user) {
        setCurrentUser(convertBackendUserToLegacy(result.user));
        setIsAuthenticated(true);
      }
      return result;
    } catch (error) {
      console.error('[App] Login failed:', error);
      return { success: false, error: 'Login failed' };
    }
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
      setHistoryTrigger(c => c + 1);
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
      setHistoryTrigger(c => c + 1);
    }
  }, [currentUser, loadProjectData, isAuthenticated, isOnline]);

  const handleSwitchProject = useCallback((projectId: string) => {
    if (projectId === currentProjectId) return;
    setCurrentProjectId(projectId);
    loadProjectData(projectId);
  }, [currentProjectId, loadProjectData]);

  const handleDeleteProject = useCallback((projectId: string) => {
    if (window.confirm(`Are you sure you want to delete project "${projects.find(p=>p.id === projectId)?.name}"? This action cannot be undone.`)) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        setProjects(remainingProjects);
        
        const keysToRemove = ['plannerNodes', 'plannerEdges', 'plannerChatMessages', 'plannerSelectedNodeIds', 'plannerSelectedEdgeId', 'plannerHistory', 'plannerHistoryIndex'];
        keysToRemove.forEach(baseKey => {
            const projectKey = getProjectScopedKey(baseKey, projectId);
            if (projectKey) localStorage.removeItem(projectKey);
        });

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
                setHistoryTrigger(c => c + 1); 
            }
        }
    }
  }, [projects, currentProjectId, currentUser, loadProjectData, getProjectScopedKey]);

  const handleUpdateProjectDetails = useCallback((projectId: string, updates: Partial<Pick<LegacyProject, 'name' | 'githubRepoUrl' | 'teamMemberUsernames'>>) => {
    setProjects(prevProjects => 
      prevProjects.map(p => 
        p.id === projectId ? { ...p, ...updates } : p
      )
    );
  }, []);

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentProjectName = currentProject?.name || "";
  const currentProjectTeamAvatars = (currentProject?.teamMemberUsernames || [])
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
    setHistoryTrigger(c => c + 1);
    if(canvasRef.current) canvasRef.current.fitView(laidOutNodes);
  }, [currentProjectId, nodes, edges]);


  const setNodesFromCanvas = useCallback((updater: React.SetStateAction<NodeData[]>) => {
    if (!currentProjectId) return;
    setNodesInternal(updater);
  }, [currentProjectId]);

  const setEdgesFromCanvas = useCallback((updater: React.SetStateAction<EdgeData[]>) => {
    if (!currentProjectId) return;
    setEdgesInternal(updater);
  }, [currentProjectId]);

   const setSelectedNodeIdsFromCanvas = useCallback((updater: React.SetStateAction<string[]>) => {
    if (!currentProjectId) return;
    setSelectedNodeIdsInternal(updater);
  }, [currentProjectId]);

  const setSelectedEdgeIdFromCanvas = useCallback((updater: React.SetStateAction<string|null>) => {
    if (!currentProjectId) return;
    setSelectedEdgeIdInternal(updater);
  }, [currentProjectId]);

  const handleOpenContextMenu = useCallback((clientX: number, clientY: number, svgX: number, svgY: number) => {
    setContextMenuState({ clientX, clientY, svgX, svgY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);

  const handleContextMenuCreateNode = useCallback(() => {
    if (contextMenuState) {
      createNodeAtPosition({ x: contextMenuState.svgX, y: contextMenuState.svgY });
    }
    handleCloseContextMenu();
  }, [contextMenuState, createNodeAtPosition, handleCloseContextMenu]);


  return (
    <div className="flex flex-col h-screen antialiased bg-dark-bg text-dark-text-primary">
      <Header 
        onCreateNode={manuallyAddNode} 
        onClearCanvas={handleClearCanvas}
        onSettingsClick={toggleSettingsPanel} 
        currentUser={currentUser}
        currentProjectName={currentProjectName}
        currentProjectRepoUrl={currentProject?.githubRepoUrl}
        currentProjectTeamAvatars={currentProjectTeamAvatars}
      />
      <div className="flex flex-1 overflow-hidden">
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
        <main className="flex-1 relative bg-dark-surface">
          {currentProjectId ? (
            <NodePlannerCanvas
              ref={canvasRef}
              nodes={nodes}
              edges={edges}
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
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-dark-text-secondary">
                Create or select a project from Settings to begin.
            </div>
          )}
        </main>
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
      </div>
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
      />
      {contextMenuState && currentProjectId && (
        <ContextMenu
          clientX={contextMenuState.clientX}
          clientY={contextMenuState.clientY}
          onClose={handleCloseContextMenu}
          onCreateNodeAtPosition={handleContextMenuCreateNode}
        />
      )}
    </div>
  );
};

export default App;
