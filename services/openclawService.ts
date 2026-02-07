import { apiClient, ApiResponse } from './apiClient.js';

export type OpenClawActionType = 'CREATE_NODE' | 'UPDATE_NODE' | 'CREATE_SUBTASKS' | 'CREATE_EDGE';

export interface OpenClawAction {
  projectId: string;
  action: OpenClawActionType;
  payload: any;
}

class OpenClawService {
  private getToken(): string | undefined {
    const token = import.meta.env.VITE_OPENCLAW_TOKEN as string | undefined;
    return token && token.trim().length > 0 ? token.trim() : undefined;
  }

  private buildHeaders() {
    const token = this.getToken();
    return token ? { 'X-OpenClaw-Token': token } : undefined;
  }

  async enqueueAction(action: OpenClawAction): Promise<void> {
    await apiClient.post('/api/v1/openclaw/queue', action, { headers: this.buildHeaders() });
  }

  async enqueueBulk(projectId: string, actions: OpenClawAction[]): Promise<void> {
    await apiClient.post('/api/v1/openclaw/bulk', { projectId, actions }, { headers: this.buildHeaders() });
  }

  async pollActions(projectId: string): Promise<OpenClawAction[]> {
    const response: ApiResponse<{ actions: OpenClawAction[] }> = await apiClient.get(
      `/api/v1/openclaw/poll?projectId=${encodeURIComponent(projectId)}`,
      { headers: this.buildHeaders() }
    );
    return response.data.actions || [];
  }

  connectWebSocket(projectId: string, onAction: (action: OpenClawAction) => void): WebSocket {
    const url = new URL('/api/v1/openclaw/ws', window.location.origin);
    url.searchParams.set('projectId', projectId);
    const token = this.getToken();
    if (token) url.searchParams.set('token', token);
    const ws = new WebSocket(url.toString().replace('http', 'ws'));

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'action' && data.action) {
          onAction(data.action as OpenClawAction);
        }
      } catch {
        // ignore
      }
    });

    return ws;
  }
}

export const openclawService = new OpenClawService();
