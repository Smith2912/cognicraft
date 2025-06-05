export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  API_VERSION: 'v1',
  ENDPOINTS: {
    // Authentication
    AUTH_GITHUB: '/api/v1/auth/github',
    AUTH_ME: '/api/v1/auth/me',
    AUTH_LOGOUT: '/api/v1/auth/logout',
    
    // Projects
    PROJECTS: '/api/v1/projects',
    PROJECT_DETAIL: '/api/v1/projects/:id',
    PROJECT_CANVAS: '/api/v1/projects/:id/canvas',
    PROJECT_NODES: '/api/v1/projects/:id/nodes',
    PROJECT_NODE_DETAIL: '/api/v1/projects/:id/nodes/:nodeId',
    
    // AI
    AI_STATUS: '/api/v1/ai/status',
    AI_CHAT: '/api/v1/ai/chat',
    AI_ANALYZE_PROJECT: '/api/v1/ai/analyze-project',
    AI_BREAK_DOWN_TASK: '/api/v1/ai/break-down-task',
    AI_OPTIMIZE_WORKFLOW: '/api/v1/ai/optimize-workflow/:projectId',
    
    // System
    HEALTH: '/health',
    STATUS: '/api/v1/status'
  }
};

export const APP_CONFIG = {
  TOKEN_KEY: 'cognicraft_token',
  USER_KEY: 'cognicraft_user',
  MIGRATION_KEY: 'cognicraft_migrated',
  DEFAULT_TIMEOUT: 10000,
  MAX_RETRIES: 3
};

// Helper to build URLs with parameters
export const buildUrl = (endpoint: string, params: Record<string, string> = {}) => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, value);
  });
  return url;
}; 