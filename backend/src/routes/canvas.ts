import express from 'express';
import { Op } from 'sequelize';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { Project, Node, Edge } from '../models/index.js';
import { body, param, validationResult } from 'express-validator';
import { NodeStatus } from '../models/Node.js';

const router = express.Router();

// Validation middleware
const validateCanvasState = [
  body('nodes')
    .isArray()
    .withMessage('Nodes must be an array'),
  body('nodes.*.id')
    .isUUID()
    .withMessage('Node ID must be a valid UUID'),
  body('nodes.*.title')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Node title must be between 1 and 1000 characters'),
  body('nodes.*.x_position')
    .isInt()
    .withMessage('Node x position must be an integer'),
  body('nodes.*.y_position')
    .isInt()
    .withMessage('Node y position must be an integer'),
  body('edges')
    .isArray()
    .withMessage('Edges must be an array'),
  body('edges.*.id')
    .isUUID()
    .withMessage('Edge ID must be a valid UUID'),
  body('edges.*.source_node_id')
    .isUUID()
    .withMessage('Source node ID must be a valid UUID'),
  body('edges.*.target_node_id')
    .isUUID()
    .withMessage('Target node ID must be a valid UUID')
];

const validateProjectId = [
  param('projectId')
    .isUUID()
    .withMessage('Project ID must be a valid UUID')
];

// Helper function to check validation errors
const checkValidation = (req: express.Request, res: express.Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array()
    });
    return false;
  }
  return true;
};

// Helper function to check project ownership
const checkProjectOwnership = async (
  projectId: string,
  userId: string,
  username: string,
  requiredPermission: 'read' | 'write' = 'read'
): Promise<boolean> => {
  try {
    const project = await Project.findByPk(projectId);
    if (!project) return false;

    const teamUsernames = Array.isArray(project.team_member_usernames)
      ? project.team_member_usernames
      : [];
    const teamMembers = Array.isArray(project.team_members)
      ? project.team_members
      : [];

    const isOwner = project.owner_user_id === userId;
    const memberEntry = teamMembers.find(member => member?.username === username);
    const isTeamMember = !!memberEntry || teamUsernames.includes(username);
    const role = memberEntry?.role || (isTeamMember ? 'editor' : undefined);

    if (requiredPermission === 'write') {
      return isOwner || role === 'editor';
    }

    return isOwner || isTeamMember;
  } catch (error) {
    return false;
  }
};

// GET /api/v1/projects/:projectId/canvas - Get canvas state
router.get('/:projectId/canvas',
  validateProjectId,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      const user = (req as AuthenticatedRequest).user;
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
      }

      // Check project ownership
      const hasAccess = await checkProjectOwnership(projectId, user.id, user.username, 'read');
      if (!hasAccess) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      // Get nodes and edges
      const nodes = await Node.findAll({
        where: { project_id: projectId },
        order: [['created_at', 'ASC']]
      });

      const edges = await Edge.findAll({
        where: { project_id: projectId },
        order: [['created_at', 'ASC']]
      });

      res.json({ nodes, edges });

    } catch (error) {
      console.error('Error fetching canvas state:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch canvas state'
      });
    }
  }
);

// PUT /api/v1/projects/:projectId/canvas - Save canvas state
router.put('/:projectId/canvas',
  validateProjectId,
  validateCanvasState,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      const user = (req as AuthenticatedRequest).user;
      const { projectId } = req.params;
      const { nodes, edges } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
      }

      // Check project ownership
      const hasAccess = await checkProjectOwnership(projectId, user.id, user.username, 'write');
      if (!hasAccess) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      // Start transaction for atomic operation
      const transaction = await Node.sequelize!.transaction();

      try {
        // Clear existing nodes and edges
        await Node.destroy({ where: { project_id: projectId }, transaction });
        await Edge.destroy({ where: { project_id: projectId }, transaction });

        // Create new nodes
        const nodeData = nodes.map((node: any) => ({
          ...node,
          project_id: projectId,
          status: node.status || NodeStatus.ToDo,
          width: node.width || 200,
          height: node.height || 150,
          icon_id: node.icon_id || 'github'
        }));

        await Node.bulkCreate(nodeData, { transaction });

        // Create new edges
        const edgeData = edges.map((edge: any) => ({
          ...edge,
          project_id: projectId
        }));

        await Edge.bulkCreate(edgeData, { transaction });

        // Commit transaction
        await transaction.commit();

        // Update project's updated_at timestamp
        await Project.update(
          { updated_at: new Date() },
          { where: { id: projectId } }
        );

        res.json({
          message: 'Canvas state saved successfully',
          nodes_count: nodes.length,
          edges_count: edges.length
        });

      } catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      console.error('Error saving canvas state:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to save canvas state'
      });
    }
  }
);

// POST /api/v1/projects/:projectId/nodes - Create a single node
router.post('/:projectId/nodes',
  validateProjectId,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { projectId } = req.params;
      const nodeData = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
      }

      // Check project ownership
      const hasAccess = await checkProjectOwnership(projectId, user.id, user.username, 'write');
      if (!hasAccess) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      const node = await Node.create({
        ...nodeData,
        project_id: projectId,
        status: nodeData.status || NodeStatus.ToDo,
        width: nodeData.width || 200,
        height: nodeData.height || 150,
        icon_id: nodeData.icon_id || 'github'
      });

      res.status(201).json({ node });

    } catch (error) {
      console.error('Error creating node:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create node'
      });
    }
  }
);

// PUT /api/v1/projects/:projectId/nodes/:nodeId - Update a node
router.put('/:projectId/nodes/:nodeId',
  validateProjectId,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { projectId, nodeId } = req.params;
      const updateData = req.body;

      if (!projectId || !nodeId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Project ID and Node ID are required' });
      }

      // Check project ownership
      const hasAccess = await checkProjectOwnership(projectId, user.id, user.username, 'write');
      if (!hasAccess) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      const node = await Node.findOne({
        where: { id: nodeId, project_id: projectId }
      });

      if (!node) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Node not found'
        });
      }

      await node.update(updateData);
      res.json({ node });

    } catch (error) {
      console.error('Error updating node:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update node'
      });
    }
  }
);

// DELETE /api/v1/projects/:projectId/nodes/:nodeId - Delete a node
router.delete('/:projectId/nodes/:nodeId',
  validateProjectId,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { projectId, nodeId } = req.params;

      if (!projectId || !nodeId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Project ID and Node ID are required' });
      }

      // Check project ownership
      const hasAccess = await checkProjectOwnership(projectId, user.id, user.username, 'write');
      if (!hasAccess) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      // Delete associated edges first
      await Edge.destroy({
        where: {
          project_id: projectId,
          [Op.or]: [
            { source_node_id: nodeId },
            { target_node_id: nodeId }
          ]
        }
      });

      // Delete the node
      const deletedCount = await Node.destroy({
        where: { id: nodeId, project_id: projectId }
      });

      if (deletedCount === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Node not found'
        });
      }

      res.status(204).send();

    } catch (error) {
      console.error('Error deleting node:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete node'
      });
    }
  }
);

export default router; 