export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || '',
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
