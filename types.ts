
export enum NodeStatus {
  ToDo = 'To Do',
  InProgress = 'In Progress',
  Done = 'Done',
  Blocked = 'Blocked',
}

export interface NodeData {
  id: string;
  x: number;
  y: number;
  title: string;
  description:string;
  status: NodeStatus;
  width?: number;
  height?: number;
  tags?: string[];
  iconId?: string;
  githubIssueUrl?: string; // Added for linking to GitHub Issues
}

export interface EdgeData {
  id:string;
  sourceId: string;
  targetId: string;
  sourceHandle?: 'top' | 'bottom' | 'left' | 'right';
  targetHandle?: 'top' | 'bottom' | 'left' | 'right';
}

export interface Point {
  x: number;
  y: number;
}

// Chat related types
export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
  isProcessing?: boolean; // For AI messages, true while streaming
  isError?: boolean; // If AI response was an error
}

export interface AiCreateNodeAction {
  action: 'CREATE_NODE';
  title: string;
  description: string;
  tags?: string[];
  iconId?: string;
  githubIssueUrl?: string; // Optional: AI could suggest an issue URL
}

export interface AiCreateSubtasksAction {
  action: 'CREATE_SUBTASKS';
  parentNodeTitle: string; // AI will refer to parent node by title
  subtasks: Array<{ title: string; description: string; tags?: string[], iconId?: string; githubIssueUrl?: string; }>; // Optional for subtasks
}

export type AiAction = AiCreateNodeAction | AiCreateSubtasksAction;

// User interface for simulated authentication
export interface User {
  username: string;
  avatarUrl: string;
}

// Project interface for multi-project support
export interface Project {
  id: string;
  name: string;
  ownerUsername: string; // Username of the simulated logged-in user who created it
  createdAt: number;
  githubRepoUrl?: string; // Optional: URL to an associated GitHub repository
  teamMemberUsernames?: string[]; // Optional: List of GitHub usernames for simulated team members
  teamMembers?: Array<{ username: string; role: 'editor' | 'viewer' }>;
}
