// Database Model Interfaces
export interface UserAttributes {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  password_hash?: string;
  github_id?: string;
  subscription_tier: 'free' | 'pro';
  created_at: Date;
  updated_at: Date;
}

export interface ProjectAttributes {
  id: string;
  name: string;
  owner_user_id: string;
  github_repo_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectMemberAttributes {
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: Date;
}

export enum NodeStatus {
  ToDo = 'To Do',
  InProgress = 'In Progress',
  Done = 'Done',
  Blocked = 'Blocked',
}

export interface NodeAttributes {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: NodeStatus;
  x_position: number;
  y_position: number;
  width?: number;
  height?: number;
  icon_id?: string;
  github_issue_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EdgeAttributes {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: 'top' | 'bottom' | 'left' | 'right';
  target_handle?: 'top' | 'bottom' | 'left' | 'right';
  created_at: Date;
  updated_at: Date;
}

export interface TagAttributes {
  id: string;
  project_id: string;
  name: string;
  created_at: Date;
}

export interface NodeTagAttributes {
  node_id: string;
  tag_id: string;
}

export interface ChatMessageAttributes {
  id: string;
  project_id: string;
  session_id: string;
  sender_type: 'user' | 'ai';
  user_id?: string;
  text_content: string;
  timestamp: Date;
  is_error: boolean;
  is_processing_stub: boolean;
  ai_action_parsed?: object;
  created_at: Date;
}

export interface ProjectHistoryAttributes {
  id: string;
  project_id: string;
  user_id: string;
  sequence_number: number;
  snapshot_nodes: object[];
  snapshot_edges: object[];
  snapshot_selected_node_ids: string[];
  snapshot_selected_edge_id?: string;
  created_at: Date;
}

// API Request/Response Types
export interface LoginRequest {
  username?: string;
  email?: string;
  password?: string;
}

export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: UserPublic;
}

export interface UserPublic {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  subscription_tier: 'free' | 'pro';
  created_at: Date;
}

export interface ProjectRequest {
  name: string;
  github_repo_url?: string;
  team_member_usernames?: string[];
  team_members?: Array<{ username: string; role: 'editor' | 'viewer' }>;
}

export interface ProjectResponse {
  id: string;
  name: string;
  owner_user_id: string;
  github_repo_url?: string;
  team_member_usernames?: string[];
  team_members?: Array<{ username: string; role: 'editor' | 'viewer' }>;
  created_at: Date;
  updated_at: Date;
  members?: ProjectMemberPublic[];
}

export interface ProjectMemberPublic {
  user_id: string;
  username: string;
  avatar_url?: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: Date;
}

export interface CanvasState {
  nodes: NodeAttributes[];
  edges: EdgeAttributes[];
  selected_node_ids: string[];
  selected_edge_id?: string;
}

export interface CanvasResponse {
  nodes: NodeAttributes[];
  edges: EdgeAttributes[];
}

export interface CanvasSaveRequest {
  nodes: NodeAttributes[];
  edges: EdgeAttributes[];
  selected_node_ids: string[];
  selected_edge_id?: string;
}

export interface ChatMessageRequest {
  text_content: string;
  sender_type: 'user';
  timestamp: string;
}

export interface AiMessageRequest {
  text_content: string;
  timestamp: string;
  is_error?: boolean;
  parsed_action?: object;
}

// AI Action Types (from frontend)
export interface AiCreateNodeAction {
  action: 'CREATE_NODE';
  title: string;
  description: string;
  tags?: string[];
  iconId?: string;
  githubIssueUrl?: string;
}

export interface AiCreateSubtasksAction {
  action: 'CREATE_SUBTASKS';
  parentNodeTitle: string;
  subtasks: Array<{
    title: string;
    description: string;
    tags?: string[];
    iconId?: string;
    githubIssueUrl?: string;
  }>;
}

export type AiAction = AiCreateNodeAction | AiCreateSubtasksAction;

// Error Response Type
export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  username: string;
  subscription_tier: 'free' | 'pro';
  iat?: number;
  exp?: number;
}

// Express Request Extensions
export interface AuthenticatedRequest {
  user: UserPublic;
  // Extends Express Request but we'll handle the actual type in route files
}

// Subscription and Usage Types
export interface UsageStats {
  projects_count: number;
  nodes_count: number;
  ai_requests_this_month: number;
  storage_used_mb: number;
}

export interface SubscriptionLimits {
  max_projects: number;
  max_nodes_per_project: number;
  max_ai_requests_per_month: number;
  max_storage_mb: number;
  max_history_snapshots: number;
}

export const FREE_TIER_LIMITS: SubscriptionLimits = {
  max_projects: 3,
  max_nodes_per_project: 50,
  max_ai_requests_per_month: 100,
  max_storage_mb: 10,
  max_history_snapshots: 10
};

export const PRO_TIER_LIMITS: SubscriptionLimits = {
  max_projects: -1, // unlimited
  max_nodes_per_project: -1, // unlimited
  max_ai_requests_per_month: 1000,
  max_storage_mb: 1000,
  max_history_snapshots: 100
}; 