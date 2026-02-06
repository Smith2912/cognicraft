import type { WebSocket } from 'ws';

const clientsByProject = new Map<string, Set<WebSocket>>();

export const addClient = (projectId: string, socket: WebSocket) => {
  const set = clientsByProject.get(projectId) || new Set<WebSocket>();
  set.add(socket);
  clientsByProject.set(projectId, set);
};

export const removeClient = (projectId: string, socket: WebSocket) => {
  const set = clientsByProject.get(projectId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) clientsByProject.delete(projectId);
};

export const broadcastAction = (projectId: string, action: any) => {
  const set = clientsByProject.get(projectId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify({ type: 'action', action });
  for (const client of set) {
    try {
      if (client.readyState === 1) {
        client.send(payload);
      }
    } catch {
      // ignore
    }
  }
};
