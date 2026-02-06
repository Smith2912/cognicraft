import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Node, Edge } from '../models/index.js';
import { NodeStatus } from '../models/Node.js';
import { broadcastAction } from '../services/openclawHub.js';

const router = express.Router();

const actionQueue = new Map<string, any[]>();

const requireTokenIfSet = (req: express.Request, res: express.Response): boolean => {
  const token = process.env.OPENCLAW_TOKEN;
  if (!token) return true;
  const headerToken = req.header('X-OpenClaw-Token');
  if (headerToken && headerToken === token) return true;
  res.status(401).json({ error: 'Unauthorized', message: 'Invalid OpenClaw token' });
  return false;
};

const enqueue = (projectId: string, action: any) => {
  const queue = actionQueue.get(projectId) || [];
  queue.push(action);
  actionQueue.set(projectId, queue);
};

router.post('/queue', async (req, res) => {
  if (!requireTokenIfSet(req, res)) return;

  const { projectId, action, payload } = req.body || {};
  if (!projectId || !action) {
    return res.status(400).json({ error: 'Bad Request', message: 'projectId and action are required' });
  }

  const queued = { projectId, action, payload };
  enqueue(projectId, queued);
  broadcastAction(projectId, queued);
  return res.json({ success: true });
});

router.post('/bulk', async (req, res) => {
  if (!requireTokenIfSet(req, res)) return;

  const { projectId, actions } = req.body || {};
  if (!projectId || !Array.isArray(actions)) {
    return res.status(400).json({ error: 'Bad Request', message: 'projectId and actions are required' });
  }

  actions.forEach((action: any) => {
    const queued = { projectId, action: action.action, payload: action.payload };
    enqueue(projectId, queued);
    broadcastAction(projectId, queued);
  });

  return res.json({ success: true, queued: actions.length });
});

router.get('/poll', async (req, res) => {
  if (!requireTokenIfSet(req, res)) return;

  const projectId = req.query.projectId as string | undefined;
  if (!projectId) {
    return res.status(400).json({ error: 'Bad Request', message: 'projectId is required' });
  }

  const queue = actionQueue.get(projectId) || [];
  actionQueue.set(projectId, []);
  return res.json({ actions: queue });
});

router.post('/action', async (req, res) => {
  if (!requireTokenIfSet(req, res)) return;

  const { projectId, action, payload } = req.body || {};
  if (!projectId || !action) {
    return res.status(400).json({ error: 'Bad Request', message: 'projectId and action are required' });
  }

  try {
    if (action === 'CREATE_NODE') {
      const id = payload?.id || uuidv4();
      const node = await Node.create({
        id,
        project_id: projectId,
        title: payload?.title || 'Untitled',
        description: payload?.description || '',
        status: payload?.status || NodeStatus.ToDo,
        x_position: payload?.x ?? 0,
        y_position: payload?.y ?? 0,
        width: payload?.width ?? 200,
        height: payload?.height ?? 150,
        icon_id: payload?.iconId || 'github',
        github_issue_url: payload?.githubIssueUrl || null,
      });
      return res.json({ success: true, action, node });
    }

    if (action === 'UPDATE_NODE') {
      const nodeId = payload?.nodeId;
      if (!nodeId) {
        return res.status(400).json({ error: 'Bad Request', message: 'nodeId is required' });
      }
      await Node.update(
        {
          title: payload?.title,
          description: payload?.description,
          status: payload?.status,
          x_position: payload?.x,
          y_position: payload?.y,
          width: payload?.width,
          height: payload?.height,
          icon_id: payload?.iconId,
          github_issue_url: payload?.githubIssueUrl,
        },
        { where: { id: nodeId, project_id: projectId } }
      );
      return res.json({ success: true, action, nodeId });
    }

    if (action === 'CREATE_SUBTASKS') {
      const parentNodeId = payload?.parentNodeId;
      const parentNodeTitle = payload?.parentNodeTitle;
      const subtasks = Array.isArray(payload?.subtasks) ? payload.subtasks : [];
      if (!parentNodeId && !parentNodeTitle) {
        return res.status(400).json({ error: 'Bad Request', message: 'parentNodeId or parentNodeTitle is required' });
      }
      if (subtasks.length === 0) {
        return res.status(400).json({ error: 'Bad Request', message: 'subtasks are required' });
      }

      const parentNode = parentNodeId
        ? await Node.findOne({ where: { id: parentNodeId, project_id: projectId } })
        : await Node.findOne({ where: { title: parentNodeTitle, project_id: projectId } });

      if (!parentNode) {
        return res.status(404).json({ error: 'Not Found', message: 'Parent node not found' });
      }

      const createdNodes = [] as Node[];
      const createdEdges = [] as Edge[];
      const baseX = parentNode.x_position;
      const baseY = parentNode.y_position + (parentNode.height || 150) + 120;

      for (let i = 0; i < subtasks.length; i++) {
        const task = subtasks[i];
        const nodeId = task.id || uuidv4();
        const newNode = await Node.create({
          id: nodeId,
          project_id: projectId,
          title: task.title || `Subtask ${i + 1}`,
          description: task.description || '',
          status: task.status || NodeStatus.ToDo,
          x_position: task.x ?? baseX,
          y_position: task.y ?? baseY + i * 40,
          width: task.width ?? 200,
          height: task.height ?? 150,
          icon_id: task.iconId || 'github',
          github_issue_url: task.githubIssueUrl || null,
        });
        createdNodes.push(newNode);

        const edge = await Edge.create({
          id: uuidv4(),
          project_id: projectId,
          source_node_id: parentNode.id,
          target_node_id: newNode.id,
          source_handle: task.sourceHandle,
          target_handle: task.targetHandle,
        });
        createdEdges.push(edge);
      }

      return res.json({ success: true, action, parentNodeId: parentNode.id, nodes: createdNodes, edges: createdEdges });
    }

    if (action === 'CREATE_EDGE') {
      const edge = await Edge.create({
        id: payload?.id || uuidv4(),
        project_id: projectId,
        source_node_id: payload?.sourceNodeId,
        target_node_id: payload?.targetNodeId,
        source_handle: payload?.sourceHandle,
        target_handle: payload?.targetHandle,
      });
      return res.json({ success: true, action, edge });
    }

    return res.status(400).json({ error: 'Bad Request', message: `Unsupported action: ${action}` });
  } catch (error) {
    console.error('OpenClaw action error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process OpenClaw action' });
  }
});

export default router;
