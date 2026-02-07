import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { Project, User, Node, Edge } from '../models/index.js';
import { body, param, validationResult } from 'express-validator';
import { Op } from 'sequelize';

const router = express.Router();

// Validation middleware
const validateProject = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Project name must be between 1 and 255 characters'),
  body('github_repo_url')
    .optional()
    .isURL()
    .withMessage('GitHub repository URL must be a valid URL'),
  body('team_member_usernames')
    .optional()
    .isArray()
    .withMessage('Team member usernames must be an array'),
  body('team_members')
    .optional()
    .isArray()
    .withMessage('Team members must be an array'),
  body('team_members.*.username')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Team member username is required'),
  body('team_members.*.role')
    .optional()
    .isIn(['editor', 'viewer'])
    .withMessage('Team member role must be editor or viewer')
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

// Helper function to check project ownership/access
const checkProjectAccess = async (
  projectId: string, 
  userId: string,
  username: string,
  requiredPermission: 'read' | 'write' = 'read'
): Promise<Project | null> => {
  try {
    const project = await Project.findByPk(projectId, {
      include: [{ model: User, as: 'owner' }]
    });

    if (!project) {
      return null;
    }

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
      return (isOwner || role === 'editor') ? project : null;
    }

    return (isOwner || isTeamMember) ? project : null;
  } catch (error) {
    return null;
  }
};

// GET /api/v1/projects - List user's projects
router.get('/', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    const projects = await Project.findAll({
      where: {
        [Op.or]: [
          { owner_user_id: user.id },
          { team_member_usernames: { [Op.contains]: [user.username] } },
          { team_members: { [Op.contains]: [{ username: user.username }] } }
        ]
      },
      include: [{ model: User, as: 'owner' }],
      order: [['updated_at', 'DESC']]
    });

    res.json({ projects });
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch projects'
    });
  }
});

// GET /api/v1/projects/:projectId - Get specific project with canvas data
router.get('/:projectId', 
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

      const project = await checkProjectAccess(projectId, user.id, user.username, 'read');
      
      if (!project) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      // Get nodes and edges separately for now
      const nodes = await Node.findAll({ where: { project_id: projectId } });
      const edges = await Edge.findAll({ where: { project_id: projectId } });

      res.json({ 
        project,
        canvas: {
          nodes,
          edges
        }
      });

    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch project'
      });
    }
  }
);

// POST /api/v1/projects - Create new project
router.post('/', 
  validateProject,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      const user = (req as AuthenticatedRequest).user;
      const { name, github_repo_url, team_member_usernames, team_members } = req.body;

      const normalizedMembers = Array.isArray(team_members) && team_members.length > 0
        ? team_members
        : (Array.isArray(team_member_usernames) ? team_member_usernames.map((username: string) => ({ username, role: 'editor' })) : []);

      const normalizedUsernames = normalizedMembers.map((member: any) => member.username);

      const project = await Project.create({
        name,
        github_repo_url,
        owner_user_id: user.id,
        team_member_usernames: normalizedUsernames,
        team_members: normalizedMembers
      });

      const projectWithOwner = await Project.findByPk(project.id, {
        include: [{ model: User, as: 'owner' }]
      });

      res.status(201).json({ project: projectWithOwner });

    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create project'
      });
    }
  }
);

// PUT /api/v1/projects/:projectId - Update project
router.put('/:projectId',
  validateProjectId,
  validateProject,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      const user = (req as AuthenticatedRequest).user;
      const { projectId } = req.params;
      const { name, github_repo_url, team_member_usernames, team_members } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
      }

      const project = await checkProjectAccess(projectId, user.id, user.username, 'write');
      
      if (!project) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      const normalizedMembers = Array.isArray(team_members) && team_members.length > 0
        ? team_members
        : (Array.isArray(team_member_usernames) ? team_member_usernames.map((username: string) => ({ username, role: 'editor' })) : []);

      const normalizedUsernames = normalizedMembers.map((member: any) => member.username);

      await project.update({
        name,
        github_repo_url,
        team_member_usernames: normalizedUsernames,
        team_members: normalizedMembers
      });

      const updatedProject = await Project.findByPk(projectId, {
        include: [{ model: User, as: 'owner' }]
      });

      res.json({ project: updatedProject });

    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update project'
      });
    }
  }
);

// DELETE /api/v1/projects/:projectId - Delete project
router.delete('/:projectId',
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

      const project = await checkProjectAccess(projectId, user.id, user.username, 'write');
      
      if (!project) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      // Delete associated nodes and edges (CASCADE should handle this, but being explicit)
      await Node.destroy({ where: { project_id: projectId } });
      await Edge.destroy({ where: { project_id: projectId } });
      await project.destroy();

      res.status(204).send();

    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete project'
      });
    }
  }
);

export default router; 