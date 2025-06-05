
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NodeData, EdgeData, NodeStatus, Point, ChatMessage, AiAction, AiCreateNodeAction, AiCreateSubtasksAction, User, Project } from './types';
import { NODE_WIDTH, NODE_HEIGHT, GRID_SIZE, HISTORY_LIMIT } from './constants';
import { sendMessageToChatStream, resetChatHistory as resetGeminiChatHistory } from './services/geminiService';
import { generatePlanMarkdown } from './services/markdownService';
import { autoLayoutNodes } from './services/layoutService'; // Added import
import NodePlannerCanvas, { NodePlannerCanvasHandle } from './components/NodePlannerCanvas';
import NodeEditorSidebar from './components/NodeEditorSidebar';
import ChatPanel from './components/ChatPanel';
import Header from './components/Header';
import LeftControlsToolbar from './components/LeftControlsToolbar';
import SettingsPanel from './components/SettingsPanel';
import ContextMenu from './components/ContextMenu'; // Added ContextMenu import

const generateId = (prefix: string = 'id'): string => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

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
  const [projects, setProjects] = useState<Project[]>([]);
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);


  const getProjectScopedKey = (baseKey: string, projectId?: string | null) => {
    const pid = projectId || currentProjectId;
    if (!pid) return null; 
    return `${baseKey}_${pid}`;
  };

  const loadProjectData = useCallback((projectId: string) => {
    console.log(`[App] Loading data for project: ${projectId}`);
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

  }, []);


  useEffect(() => {
    const savedProjects = localStorage.getItem('plannerProjects');
    const savedCurrentProjectId = localStorage.getItem('plannerCurrentProjectId');
    const savedUser = localStorage.getItem('plannerUser');

    let loadedProjects: Project[] = [];
    if (savedProjects) {
        try { loadedProjects = JSON.parse(savedProjects).map((p: Project) => ({
            ...p,
            githubRepoUrl: p.githubRepoUrl || '',
            teamMemberUsernames: Array.isArray(p.teamMemberUsernames) ? p.teamMemberUsernames : []
        })); }
        catch(e) { console.error("Failed to parse projects", e); }
    }
    setProjects(loadedProjects);

    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } 
      catch (e) { console.error("Failed to parse saved user:", e); }
    }
    
    let activeProjectId = savedCurrentProjectId;
    if (loadedProjects.length > 0) {
        if (!activeProjectId || !loadedProjects.find(p => p.id === activeProjectId)) {
            console.log("[App Init] No valid current project ID found, defaulting to first project.");
            activeProjectId = loadedProjects[0].id; 
        }
    } else { 
        console.log("[App Init] No projects found, creating default project.");
        const defaultProjectName = "Default Project";
        const newProject: Project = {
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
    } else if (loadedProjects.length === 0) { 
        // This case should ideally be handled by the default project creation logic above.
        // If `activeProjectId` is still null here, it implies an issue in the logic.
        console.warn("[App Init] activeProjectId is null after initial setup logic. Attempting to find/load default project again.");
        const defaultProject = projects.find(p => p.name === "Default Project"); 
        if (defaultProject) {
             loadProjectData(defaultProject.id);
        } else {
            console.error("[App Init] Could not load or create a default project. Canvas might be unresponsive.");
        }
    }

  }, [loadProjectData, currentUser?.username]); 

  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerNodes')!, JSON.stringify(nodes)); }, [nodes, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerEdges')!, JSON.stringify(edges)); }, [edges, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerChatMessages')!, JSON.stringify(chatMessages)); }, [chatMessages, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerSelectedNodeIds')!, JSON.stringify(selectedNodeIds)); }, [selectedNodeIds, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerSelectedEdgeId')!, JSON.stringify(selectedEdgeId)); }, [selectedEdgeId, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerHistory')!, JSON.stringify(history)); }, [history, currentProjectId]);
  useEffect(() => { currentProjectId && localStorage.setItem(getProjectScopedKey('plannerHistoryIndex')!, historyIndex.toString()); }, [historyIndex, currentProjectId]);
  
  useEffect(() => { localStorage.setItem('plannerProjects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { if (currentProjectId) localStorage.setItem('plannerCurrentProjectId', currentProjectId);}, [currentProjectId]);
  useEffect(() => { localStorage.setItem('plannerUser', JSON.stringify(currentUser)); }, [currentUser]);


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

  const handleClearCanvas = useCallback(() => {
    if (!currentProjectId) return;
    if (window.confirm("Are you sure you want to clear the entire canvas for the current project? This will remove all nodes and edges.")) {
        setNodesInternal([]);
        setEdgesInternal([]);
        setSelectedNodeIdsInternal([]);
        setSelectedEdgeIdInternal(null);
        setConnectingInfo(null); 
        setChatMessages(prev => [...prev, {
            id: generateId('system'),
            sender: 'ai',
            text: "Canvas cleared for current project.",
            timestamp: Date.now()
        }]);
        setHistoryTrigger(c => c + 1); 
    }
  }, [setChatMessages, currentProjectId]); 

  const handleAddNodeFromAI = useCallback((title: string, description: string, projectId: string, status: NodeStatus = NodeStatus.ToDo, tags: string[] = [], iconId: string = 'github', githubIssueUrl?: string): NodeData | null => {
    console.log("[handleAddNodeFromAI] Called with projectId:", projectId, "Title:", title);
    if (!projectId) {
      console.error("[handleAddNodeFromAI] Aborting: Null or invalid projectId provided:", projectId);
      return null;
    }
    const { x, y } = calculateNewNodePosition(); 
    const newNode: NodeData = {
      id: generateId('node'), x, y, title, description, status,
      width: NODE_WIDTH, height: NODE_HEIGHT, tags: tags, iconId: iconId || 'github',
      githubIssueUrl: githubIssueUrl || undefined, 
    };
    console.log("[handleAddNodeFromAI] Creating node:", newNode.id, "for project:", projectId);
    setNodesInternal(prev => [...prev, newNode]);
    setSelectedNodeIdsInternal([newNode.id]); 
    setSelectedEdgeIdInternal(null); 
    // Note: history trigger is typically called by the caller (processAiResponseForAction) after all parts of an AI action are done.
    return newNode;
  }, [calculateNewNodePosition]); 

  const handleUpdateNode = useCallback((updatedNode: NodeData) => {
    if (!currentProjectId) return; 
    setNodesInternal(prev => prev.map(n => (n.id === updatedNode.id ? { ...updatedNode, tags: updatedNode.tags || [], iconId: updatedNode.iconId || 'github', githubIssueUrl: updatedNode.githubIssueUrl || undefined } : n)));
    setHistoryTrigger(c => c + 1); 
  }, [currentProjectId]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!currentProjectId) return; 
    setNodesInternal(prev => prev.filter(n => n.id !== nodeId));
    setEdgesInternal(prev => prev.filter(edge => edge.sourceId !== nodeId && edge.targetId !== nodeId));
    setSelectedNodeIdsInternal(prev => prev.filter(id => id !== nodeId)); 
    if(connectingInfo && (connectingInfo.sourceId === nodeId)){
        setConnectingInfo(null);
    }
    setHistoryTrigger(c => c + 1); 
  }, [connectingInfo, currentProjectId]); 
  
  const handleAddSubtaskNode = useCallback((
    parentNodeId: string, 
    subtaskTitle: string, 
    projectId: string, 
    subtaskDescription?: string, 
    subtaskTags: string[] = [], 
    subtaskIconId: string = 'github', 
    subtaskGithubIssueUrl?: string
  ): NodeData | null => {
    console.log("[handleAddSubtaskNode] Called for parentNodeId:", parentNodeId, "with projectId:", projectId, "Title:", subtaskTitle);
    if (!projectId) {
        console.error("[handleAddSubtaskNode] Aborting: Null or invalid projectId provided:", projectId);
        return null;
    }
    const parentNode = nodes.find(n => n.id === parentNodeId); 
    if (!parentNode) {
        console.error(`[handleAddSubtaskNode] Parent node ID "${parentNodeId}" not found.`);
        setChatMessages(prev => [...prev, {
            id: generateId('ai-error'), sender: 'ai',
            text: `Parent node ID "${parentNodeId}" not found. Cannot create subtask.`,
            timestamp: Date.now(), isError: true,
        }]);
        return null;
    }

    let targetNode: NodeData | null = null;
    let edgeNeedsCreation = true;
    let nodeWasReused = false;

    // Check if a node with the same title already exists (excluding the parent itself)
    const existingNodeWithSameTitle = nodes.find(n => 
        n.title.trim().toLowerCase() === subtaskTitle.trim().toLowerCase() && 
        n.id !== parentNodeId
    );

    if (existingNodeWithSameTitle) {
        console.log(`[handleAddSubtaskNode] Found existing node with title "${subtaskTitle}" (ID: ${existingNodeWithSameTitle.id}). Reusing it.`);
        targetNode = { ...existingNodeWithSameTitle }; // Work with a copy
        nodeWasReused = true;
        
        const edgeExists = edges.some(e => e.sourceId === parentNodeId && e.targetId === targetNode!.id);
        if (edgeExists) {
            edgeNeedsCreation = false;
            console.log(`[handleAddSubtaskNode] Edge from "${parentNode.title}" to "${targetNode.title}" already exists.`);
        }
        // Note: We are NOT updating the content (description, tags, icon) of the reused node here.
        // That should be handled by an explicit update action from the AI if intended.
        // We will only reposition it and ensure it's linked.
    } else {
        console.log(`[handleAddSubtaskNode] No existing node with title "${subtaskTitle}". Creating new one.`);
        // Calculate position for a new node (or for a reused node that needs positioning)
        const subtasksOfParentForPositioning = edges
            .filter(e => e.sourceId === parentNodeId)
            .map(e => nodes.find(n => n.id === e.targetId))
            .filter(n => n !== undefined) as NodeData[];
        
        const { x, y } = calculateNewNodePosition(parentNode, subtasksOfParentForPositioning);

        const newNode: NodeData = {
          id: generateId('node'), x, y, title: subtaskTitle,
          description: subtaskDescription || `Subtask of "${parentNode.title}"`,
          status: NodeStatus.ToDo, 
          width: NODE_WIDTH, height: NODE_HEIGHT, 
          tags: subtaskTags, iconId: subtaskIconId || 'github',
          githubIssueUrl: subtaskGithubIssueUrl || undefined, 
        };
        setNodesInternal(prev => [...prev, newNode]); 
        targetNode = newNode;
    }

    if (!targetNode) {
      console.error("[handleAddSubtaskNode] Target node is null, this should not happen.");
      return null; 
    }

    // Reposition if it's a reused node and needs linking, or if it's a new node.
    // The new node is already created with a calculated position.
    // If reusing, we need to calculate its new position relative to the parent.
    if (nodeWasReused) {
        const subtasksOfParentForPositioning = edges
            .filter(e => e.sourceId === parentNodeId)
            .map(e => nodes.find(n => n.id === e.targetId))
            .filter(n => n !== undefined && n.id !== targetNode!.id) as NodeData[]; 

        const { x, y } = calculateNewNodePosition(parentNode, subtasksOfParentForPositioning);
        
        if (targetNode.x !== x || targetNode.y !== y) {
            const positionedTargetNode = { ...targetNode, x, y };
            setNodesInternal(prevNodes => prevNodes.map(n => n.id === positionedTargetNode.id ? positionedTargetNode : n));
            targetNode = positionedTargetNode; 
            console.log(`[handleAddSubtaskNode] Repositioned reused node "${targetNode.title}" to x:${x}, y:${y}.`);
        }
    }
    
    if (edgeNeedsCreation) {
        const newEdge: EdgeData = { 
            id: generateId('edge'), sourceId: parentNodeId, targetId: targetNode.id,
            sourceHandle: 'bottom', targetHandle: 'top'     
        };
        setEdgesInternal(prevEdges => [...prevEdges, newEdge]);
        console.log(`[handleAddSubtaskNode] Created edge from "${parentNode.title}" to "${targetNode.title}".`);
    }
    
    // Caller (processAiResponseForAction) will handle selection and history trigger.
    return targetNode;
  }, [nodes, edges, calculateNewNodePosition]); 

  const processAiResponseForAction = useCallback((aiFullText: string, projectIdForAction: string | null) => {
    console.log("[processAiResponseForAction] Received AI text:", aiFullText.substring(0,100) + "...", "for project:", projectIdForAction);
    if (!projectIdForAction) {
        console.warn("[processAiResponseForAction] Aborting: No valid project ID for action (projectIdForAction is falsy).");
        return false;
    }
    
    let jsonStringToParse: string | null = null;
    const trimmedAiText = aiFullText.trim();

    if (trimmedAiText.startsWith('{') && trimmedAiText.endsWith('}')) {
        try {
            JSON.parse(trimmedAiText); 
            jsonStringToParse = trimmedAiText;
            console.log("[processAiResponseForAction] Attempt 1: Parsed as direct JSON.");
        } catch (e) {
             console.log("[processAiResponseForAction] Attempt 1: Direct parse failed, trying fence. Error:", e);
        }
    }

    if (!jsonStringToParse) {
        const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
        const fenceMatch = trimmedAiText.match(fenceRegex);
        if (fenceMatch && fenceMatch[1]) {
            const fencedContent = fenceMatch[1].trim();
            if (fencedContent.startsWith('{') && fencedContent.endsWith('}')) {
                 try {
                    JSON.parse(fencedContent); 
                    jsonStringToParse = fencedContent;
                    console.log("[processAiResponseForAction] Attempt 2: Extracted and parsed from fence.");
                } catch (e) {
                    console.warn("[processAiResponseForAction] Attempt 2: Content inside JSON fence was not valid JSON:", fencedContent, e);
                }
            } else {
                 console.warn("[processAiResponseForAction] Attempt 2: Content inside JSON fence did not appear to be a JSON object:", fencedContent);
            }
        } else {
            console.log("[processAiResponseForAction] Attempt 2: No markdown fence found or fence content invalid.");
        }
    }
    
    if (!jsonStringToParse) {
        console.log("[processAiResponseForAction] Attempt 3: Falling back to indexOf '{\"action\":}'.");
        const actionJsonStartIndex = trimmedAiText.indexOf('{"action":');
        if (actionJsonStartIndex !== -1) {
            let potentialJsonString = trimmedAiText.substring(actionJsonStartIndex);
            let openBraces = 0;
            let endIndex = -1;
            for (let i = 0; i < potentialJsonString.length; i++) {
                if (potentialJsonString[i] === '{') openBraces++;
                else if (potentialJsonString[i] === '}') {
                    openBraces--;
                    if (openBraces === 0) { endIndex = i; break; }
                }
            }
            if (endIndex !== -1) {
                const extracted = potentialJsonString.substring(0, endIndex + 1);
                try {
                    JSON.parse(extracted); 
                    jsonStringToParse = extracted;
                    console.log("[processAiResponseForAction] Attempt 3: Extracted via brace balancing.");
                } catch (e) {
                     console.warn("[processAiResponseForAction] Attempt 3: Brace-balanced string not valid JSON.", e);
                }
            } else {
                 console.warn("[processAiResponseForAction] Attempt 3: Brace balancing failed to find end of JSON.");
            }
        } else {
             console.log("[processAiResponseForAction] Attempt 3: '{\"action\":' not found in text.");
        }
    }
    
    let parsedAction: AiAction | null = null;
    if (jsonStringToParse) {
        try {
            parsedAction = JSON.parse(jsonStringToParse) as AiAction;
        } catch (e) {
            console.error("[processAiResponseForAction] Final JSON.parse failed:", e, "\nAttempted to parse:", jsonStringToParse, "\nOriginal AI Response Text:", aiFullText);
            setChatMessages(prev => [...prev, {
                id: generateId('ai-parse-error'),
                sender: 'ai',
                text: "I tried to perform an action, but my instructions were not formatted correctly. Please check the console for details.",
                timestamp: Date.now(),
                isError: true,
            }]);
            return false; 
        }
    } else {
        console.log("[processAiResponseForAction] No valid JSON string could be extracted after all attempts. Original AI Text:", aiFullText);
        return false; 
    }

    if (parsedAction && parsedAction.action) {
        console.log("[processAiResponseForAction] Successfully parsed action:", JSON.stringify(parsedAction), "for project:", projectIdForAction);
        let actionTaken = false;
        let newSelectedNodeIdForFocus: string | null = null;

        switch (parsedAction.action) {
            case 'CREATE_NODE':
                const nodeAction = parsedAction as AiCreateNodeAction;
                const existingNode = nodes.find(n => n.title.trim().toLowerCase() === nodeAction.title.trim().toLowerCase());

                if (existingNode && nodeAction.description) {
                    const updatedNodeData: NodeData = {
                        ...existingNode,
                        description: nodeAction.description,
                        tags: nodeAction.tags || existingNode.tags,
                        iconId: nodeAction.iconId || existingNode.iconId,
                        githubIssueUrl: nodeAction.githubIssueUrl || existingNode.githubIssueUrl,
                    };
                    handleUpdateNode(updatedNodeData); // This will trigger history itself
                    setChatMessages(prev => [...prev, {
                        id: generateId('ai-confirm'), sender: 'ai',
                        text: `Updated details for node: "${nodeAction.title}".`, timestamp: Date.now()
                    }]);
                    newSelectedNodeIdForFocus = existingNode.id;
                    actionTaken = true;
                } else {
                    const createdNode = handleAddNodeFromAI(nodeAction.title, nodeAction.description, projectIdForAction, NodeStatus.ToDo, nodeAction.tags || [], nodeAction.iconId, nodeAction.githubIssueUrl);
                    if (createdNode) {
                        setChatMessages(prev => [...prev, {
                            id: generateId('ai-confirm'), sender: 'ai',
                            text: `Created node: "${nodeAction.title}".`, timestamp: Date.now()
                        }]);
                        newSelectedNodeIdForFocus = createdNode.id;
                        setHistoryTrigger(c => c + 1); // Trigger history for new node creation
                        actionTaken = true;
                    } else {
                        console.warn("[processAiResponseForAction] handleAddNodeFromAI returned null for CREATE_NODE (new).");
                        setChatMessages(prev => [...prev, {
                            id: generateId('ai-error-node'), sender: 'ai',
                            text: `I tried to create a node titled "${nodeAction.title}", but it failed. Please ensure a project is active or check console for more details.`,
                            timestamp: Date.now(), isError: true,
                        }]);
                        actionTaken = true; 
                    }
                }
                break;
            case 'CREATE_SUBTASKS':
                const subtaskAction = parsedAction as AiCreateSubtasksAction;
                const parentNodeByTitle = nodes.find(n => n.title.trim().toLowerCase() === subtaskAction.parentNodeTitle.trim().toLowerCase()); 
                if (parentNodeByTitle) {
                    let createdCount = 0;
                    let lastCreatedSubtaskId: string | null = null;
                    subtaskAction.subtasks.forEach(subtask => {
                        const createdSubNode = handleAddSubtaskNode(parentNodeByTitle.id, subtask.title, projectIdForAction, subtask.description, subtask.tags || [], subtask.iconId, subtask.githubIssueUrl);
                        if(createdSubNode) {
                            createdCount++;
                            lastCreatedSubtaskId = createdSubNode.id;
                        }
                    });
                     if (createdCount > 0) {
                         setChatMessages(prev => [...prev, {
                            id: generateId('ai-confirm'), sender: 'ai',
                            text: `Added ${createdCount} subtask(s) to "${parentNodeByTitle.title}".`, timestamp: Date.now()
                        }]);
                        newSelectedNodeIdForFocus = lastCreatedSubtaskId; // Focus on the last created/linked subtask
                        setHistoryTrigger(c => c + 1); // Trigger history for subtask creation/linking
                    } else {
                         console.warn("[processAiResponseForAction] No subtasks actually created/linked for parent:", parentNodeByTitle.title);
                    }
                    actionTaken = true; 
                } else {
                    console.warn(`[processAiResponseForAction] Parent node titled "${subtaskAction.parentNodeTitle}" not found for CREATE_SUBTASKS.`);
                    const existingNodeTitles = nodes.slice(0, 5).map(n => `"${n.title}"`).join(', ');
                    let errorText = `I couldn't find a parent node titled "${subtaskAction.parentNodeTitle}".`;
                    if (nodes.length > 0) {
                        errorText += ` Existing tasks include: ${existingNodeTitles}${nodes.length > 5 ? '...' : ''}.`;
                        errorText += ` Please confirm the correct parent title, or ask me to create the parent task first.`
                    } else {
                        errorText += ` There are no tasks on the board yet. Please ask me to create the parent task first.`
                    }
                    setChatMessages(prev => [...prev, {
                        id: generateId('ai-error-subtask'), sender: 'ai',
                        text: errorText,
                        timestamp: Date.now(), isError: true,
                    }]);
                    actionTaken = true; 
                }
                break;
            default:
                console.warn("[processAiResponseForAction] Unknown action type:", (parsedAction as any).action);
        }
        
        if (newSelectedNodeIdForFocus) {
            setSelectedNodeIdsInternal([newSelectedNodeIdForFocus]);
            setSelectedEdgeIdInternal(null);
        }

        console.log("[processAiResponseForAction] Action taken status:", actionTaken);
        if (actionTaken && canvasRef.current) {
            setTimeout(() => {
                if (canvasRef.current) {
                    canvasRef.current.fitView();
                }
            }, 0);
        }
        return actionTaken;
    }
    console.log("[processAiResponseForAction] No valid action parsed or projectIdForAction missing. projectIdForAction:", projectIdForAction, "Parsed action:", parsedAction);
    return false;
  }, [handleAddNodeFromAI, handleAddSubtaskNode, handleUpdateNode, nodes, setChatMessages]); 

  const handleSendChatMessage = useCallback(async (messageText: string) => {
    const currentActiveProjectId = currentProjectId; 
    console.log("[handleSendChatMessage] Initiating. Captured currentActiveProjectId:", currentActiveProjectId);
    if (!currentActiveProjectId) {
      console.warn("[handleSendChatMessage] Aborting: currentActiveProjectId is null or undefined.");
      setChatMessages(prev => [...prev, {
          id: generateId('error-system'), sender: 'ai',
          text: "Cannot send message: No active project selected. Please select or create a project in settings.",
          timestamp: Date.now(), isError: true
      }]);
      return;
    }

    const userMessage: ChatMessage = { id: generateId('user'), sender: 'user', text: messageText, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMessage]);
    setIsAiTyping(true);
    const aiMessageId = generateId('ai-stream');
    setCurrentAiMessageId(aiMessageId);
    setChatMessages(prev => [...prev, { id: aiMessageId, sender: 'ai', text: '', timestamp: Date.now(), isProcessing: true }]);
    
    let fullAiResponse = "";
    
    await sendMessageToChatStream(
      messageText,
      (chunkText, isFinalChunk) => { 
        if (!isFinalChunk) {
            fullAiResponse += chunkText;
            setChatMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: fullAiResponse, isProcessing: true } : msg ));
        } else { 
            setIsAiTyping(false);
            setCurrentAiMessageId(null);
            console.log("[handleSendChatMessage] AI stream finished. Full response:", fullAiResponse.substring(0,100) + "...");

            const wasActionProcessed = processAiResponseForAction(fullAiResponse, currentActiveProjectId); 
            console.log("[handleSendChatMessage] processAiResponseForAction result:", wasActionProcessed);

            if (wasActionProcessed) {
                setChatMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            } else {
                setChatMessages(prev =>
                    prev
                        .map(msg =>
                            msg.id === aiMessageId
                                ? { ...msg, text: fullAiResponse, isProcessing: false, isError: !fullAiResponse.trim() } 
                                : msg
                        )
                        .filter(msg => !(msg.id === aiMessageId && !fullAiResponse.trim())) 
                );
            }
        }
      },
      (errorMessage) => { 
        console.error("[handleSendChatMessage] AI stream error:", errorMessage);
        setIsAiTyping(false);
        setCurrentAiMessageId(null);
        setChatMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
            ? { ...msg, text: errorMessage, isProcessing: false, isError: true } 
            : msg 
        ));
      }
    );
  }, [processAiResponseForAction, currentProjectId]); 

  const handleResetChat = useCallback(() => {
    if (!currentProjectId) return;
    resetGeminiChatHistory(); 
    setChatMessages([{
        id: generateId('ai-greet'), sender: 'ai',
        text: "Chat history reset. How can I assist?", timestamp: Date.now()
    }]);
    setIsAiTyping(false);
    setCurrentAiMessageId(null);
  }, [currentProjectId]);

  const primarySelectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;
  const selectedNodeDetails = primarySelectedNodeId ? nodes.find(n => n.id === primarySelectedNodeId) : null;
  
  const handleInteractionEnd = useCallback(() => {
    if (!currentProjectId) return;
    setHistoryTrigger(c => c + 1);
  }, [currentProjectId]);

  const handleUndo = useCallback(() => {
    if (!currentProjectId || historyIndexRef.current <= 0) return;
    
    let prevProjectHistoryIndex = -1;
    for (let i = historyIndexRef.current - 1; i >= 0; i--) {
        prevProjectHistoryIndex = i;
        break; 
    }

    if (prevProjectHistoryIndex >= 0 && history[prevProjectHistoryIndex]) {
        historyIndexRef.current = prevProjectHistoryIndex;
        const prevState = history[historyIndexRef.current];
        setNodesInternal(prevState.nodes);
        setEdgesInternal(prevState.edges);
        setSelectedNodeIdsInternal(prevState.selectedNodeIds);
        setSelectedEdgeIdInternal(prevState.selectedEdgeId);
        setHistoryIndex(historyIndexRef.current);
    }
  }, [history, currentProjectId]);

  const handleRedo = useCallback(() => {
    if (!currentProjectId || historyIndexRef.current >= history.length - 1) return;

    let nextProjectHistoryIndex = -1;
    for (let i = historyIndexRef.current + 1; i < history.length; i++) {
        nextProjectHistoryIndex = i;
        break;
    }
    
    if (nextProjectHistoryIndex !== -1 && history[nextProjectHistoryIndex]) {
        historyIndexRef.current = nextProjectHistoryIndex;
        const nextState = history[historyIndexRef.current];
        setNodesInternal(nextState.nodes);
        setEdgesInternal(nextState.edges);
        setSelectedNodeIdsInternal(nextState.selectedNodeIds);
        setSelectedEdgeIdInternal(nextState.selectedEdgeId);
        setHistoryIndex(historyIndexRef.current);
    }
  }, [history, currentProjectId]);

  const toggleGrid = useCallback(() => setShowGrid(prev => !prev), []);
  const zoomIn = useCallback(() => canvasRef.current?.zoomInCanvas(), []);
  const zoomOut = useCallback(() => canvasRef.current?.zoomOutCanvas(), []);
  const fitViewToNodes = useCallback(() => {
    if (currentProjectId) canvasRef.current?.fitView(nodes);
  }, [nodes, currentProjectId]);
  
  const toggleSettingsPanel = useCallback(() => setIsSettingsPanelOpen(prev => !prev), []);

  const handleLogin = useCallback((username: string) => {
    if (username.trim()) {
      const user: User = {
        username: username.trim(),
        avatarUrl: `https://github.com/${username.trim()}.png`,
      };
      setCurrentUser(user);
      setIsSettingsPanelOpen(false); 
    }
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const handleCreateProject = useCallback((projectName: string) => {
    if (!projectName.trim()) return;
    const newProject: Project = {
        id: generateId('project'),
        name: projectName.trim(),
        ownerUsername: currentUser?.username || 'local',
        createdAt: Date.now(),
        githubRepoUrl: '',
        teamMemberUsernames: [],
    };
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    loadProjectData(newProject.id); 
    setHistoryTrigger(c => c + 1);
  }, [currentUser, loadProjectData]);

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
                const newProject: Project = { id: generateId('project'), name: defaultProjectName, ownerUsername: currentUser?.username || 'local', createdAt: Date.now(), githubRepoUrl: '', teamMemberUsernames: [] };
                setProjects([newProject]);
                setCurrentProjectId(newProject.id);
                loadProjectData(newProject.id);
                setHistoryTrigger(c => c + 1); 
            }
        }
    }
  }, [projects, currentProjectId, currentUser, loadProjectData, getProjectScopedKey]);

  const handleUpdateProjectDetails = useCallback((projectId: string, updates: Partial<Pick<Project, 'name' | 'githubRepoUrl' | 'teamMemberUsernames'>>) => {
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
