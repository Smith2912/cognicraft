import { EdgeData, NodeData } from './types';
import { HISTORY_LIMIT } from './constants';

export interface HistoryState {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
}

export interface AppState extends HistoryState {
  history: HistoryState[];
  historyIndex: number;
}

export type StateUpdater<T> = T | ((prev: T) => T);

export type AppAction =
  | { type: 'INIT_PROJECT_STATE'; payload: AppState }
  | { type: 'SET_NODES'; updater: StateUpdater<NodeData[]> }
  | { type: 'SET_EDGES'; updater: StateUpdater<EdgeData[]> }
  | { type: 'SET_SELECTED_NODE_IDS'; updater: StateUpdater<string[]> }
  | { type: 'SET_SELECTED_EDGE_ID'; updater: StateUpdater<string | null> }
  | { type: 'COMMIT_HISTORY' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export const createInitialAppState = (): AppState => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectedEdgeId: null,
  history: [{ nodes: [], edges: [], selectedNodeIds: [], selectedEdgeId: null }],
  historyIndex: 0,
});

const cloneState = (state: HistoryState): HistoryState => ({
  nodes: JSON.parse(JSON.stringify(state.nodes)),
  edges: JSON.parse(JSON.stringify(state.edges)),
  selectedNodeIds: [...state.selectedNodeIds],
  selectedEdgeId: state.selectedEdgeId,
});

export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'INIT_PROJECT_STATE':
      return action.payload;
    case 'SET_NODES': {
      const nextNodes = typeof action.updater === 'function'
        ? action.updater(state.nodes)
        : action.updater;
      return { ...state, nodes: nextNodes };
    }
    case 'SET_EDGES': {
      const nextEdges = typeof action.updater === 'function'
        ? action.updater(state.edges)
        : action.updater;
      return { ...state, edges: nextEdges };
    }
    case 'SET_SELECTED_NODE_IDS': {
      const nextSelectedNodeIds = typeof action.updater === 'function'
        ? action.updater(state.selectedNodeIds)
        : action.updater;
      return { ...state, selectedNodeIds: nextSelectedNodeIds };
    }
    case 'SET_SELECTED_EDGE_ID': {
      const nextSelectedEdgeId = typeof action.updater === 'function'
        ? action.updater(state.selectedEdgeId)
        : action.updater;
      return { ...state, selectedEdgeId: nextSelectedEdgeId };
    }
    case 'COMMIT_HISTORY': {
      const currentState: HistoryState = cloneState(state);
      const newHistoryBase = state.history.slice(0, state.historyIndex + 1);
      const updatedHistory = [...newHistoryBase, currentState];
      const finalHistory = updatedHistory.length > HISTORY_LIMIT
        ? updatedHistory.slice(updatedHistory.length - HISTORY_LIMIT)
        : updatedHistory;
      const nextIndex = finalHistory.length - 1;
      return { ...state, history: finalHistory, historyIndex: nextIndex };
    }
    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const previousIndex = state.historyIndex - 1;
      const previousState = state.history[previousIndex];
      return {
        ...state,
        ...cloneState(previousState),
        historyIndex: previousIndex,
      };
    }
    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const nextIndex = state.historyIndex + 1;
      const nextState = state.history[nextIndex];
      return {
        ...state,
        ...cloneState(nextState),
        historyIndex: nextIndex,
      };
    }
    default:
      return state;
  }
};
