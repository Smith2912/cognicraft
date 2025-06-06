import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { aiService } from '../services/aiService.js';
import { body, param, validationResult } from 'express-validator';
import { Project, Node, Edge } from '../models/index.js';
import { AVAILABLE_AI_MODELS, getFreeModels, getModelsByProvider, getModelById } from '../config/aiModels.js';
import type { User } from '../models/User.js';

const router = express.Router();

// Validation middleware
const validateChatRequest = [
  body('messages')
    .isArray()
    .withMessage('Messages must be an array'),
  body('messages.*.role')
    .isIn(['user', 'assistant'])
    .withMessage('Message role must be either "user" or "assistant"'),
  body('messages.*.content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Message content must be between 1 and 10000 characters')
];

const validateProjectAnalysis = [
  body('projectName')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Project name must be between 1 and 255 characters'),
  body('projectType')
    .optional()
    .isIn(['web-app', 'mobile-app', 'game', 'mod', 'other'])
    .withMessage('Project type must be one of: web-app, mobile-app, game, mod, other'),
  body('githubRepoUrl')
    .optional()
    .isURL()
    .withMessage('GitHub repository URL must be a valid URL'),
  body('additionalContext')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Additional context must be less than 5000 characters')
];

const validateTaskBreakdown = [
  body('taskTitle')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Task title must be between 1 and 1000 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters')
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
const checkProjectOwnership = async (projectId: string, userId: string): Promise<boolean> => {
  try {
    const project = await Project.findByPk(projectId);
    return project?.owner_user_id === userId;
  } catch (error) {
    return false;
  }
};

// GET /api/v1/ai/status - Check AI service availability
router.get('/status', authenticateToken, (req: express.Request, res: express.Response) => {
  const isAvailable = aiService.isAvailable();
  res.json({
    available: isAvailable,
    message: isAvailable 
      ? 'AI service is available' 
      : 'AI service is not configured - please add GEMINI_API_KEY to environment'
  });
});

// POST /api/v1/ai/chat - General AI chat completion
router.post('/chat',
  validateChatRequest,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      if (!aiService.isAvailable()) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'AI service is not configured'
        });
      }

      const { messages } = req.body;
      const response = await aiService.generateResponse(messages);

      res.json({
        content: response.content,
        usage: response.usage
      });

    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate AI response'
      });
    }
  }
);

// POST /api/v1/ai/analyze-project - Analyze project and suggest tasks
router.post('/analyze-project',
  validateProjectAnalysis,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      if (!aiService.isAvailable()) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'AI service is not configured'
        });
      }

      const { projectName, projectType, githubRepoUrl, additionalContext, existingNodes } = req.body;
      
      const analysis = await aiService.analyzeProject({
        projectName,
        projectType,
        githubRepoUrl,
        additionalContext,
        existingNodes
      });

      res.json(analysis);

    } catch (error) {
      console.error('Project analysis error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to analyze project'
      });
    }
  }
);

// POST /api/v1/ai/break-down-task - Break down a task into subtasks
router.post('/break-down-task',
  validateTaskBreakdown,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      if (!aiService.isAvailable()) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'AI service is not configured'
        });
      }

      const { taskTitle, description } = req.body;
      const subtasks = await aiService.generateTaskBreakdown(taskTitle, description);

      res.json({ subtasks });

    } catch (error) {
      console.error('Task breakdown error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to break down task'
      });
    }
  }
);

// POST /api/v1/ai/optimize-workflow/:projectId - Optimize project workflow
router.post('/optimize-workflow/:projectId',
  validateProjectId,
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    if (!checkValidation(req, res)) return;

    try {
      if (!aiService.isAvailable()) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'AI service is not configured'
        });
      }

      const user = (req as AuthenticatedRequest).user;
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
      }

      // Check project ownership
      const hasAccess = await checkProjectOwnership(projectId, user.id);
      if (!hasAccess) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Project not found or access denied'
        });
      }

      // Get project nodes and edges
      const nodes = await Node.findAll({ where: { project_id: projectId } });
      const edges = await Edge.findAll({ where: { project_id: projectId } });

      if (nodes.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Project has no tasks to optimize'
        });
      }

      const recommendations = await aiService.optimizeWorkflow(nodes, edges);

      res.json({ recommendations });

    } catch (error) {
      console.error('Workflow optimization error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to optimize workflow'
      });
    }
  }
);

// Get available AI models
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const user = req.user as User;
    const { free_only, provider } = req.query;

    let models = AVAILABLE_AI_MODELS;

    // Filter by free models if requested
    if (free_only === 'true') {
      models = getFreeModels();
    }

    // Filter by provider if requested
    if (provider && (provider === 'openrouter' || provider === 'gemini')) {
      models = getModelsByProvider(provider);
    }

    // Filter free models for free tier users
    if (user.subscription_tier === 'free') {
      models = models.filter(model => model.isFree);
    }

    res.json({
      success: true,
      data: {
        models,
        user_preferences: {
          preferred_model: user.preferred_ai_model,
          provider_preference: user.ai_provider_preference,
          subscription_tier: user.subscription_tier
        }
      }
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available models'
    });
  }
});

// Update user AI preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const user = req.user as User;
    const { preferred_ai_model, ai_provider_preference } = req.body;

    // Validate model selection
    if (preferred_ai_model) {
      const modelInfo = getModelById(preferred_ai_model);
      if (!modelInfo) {
        return res.status(400).json({
          success: false,
          error: 'Invalid model ID'
        });
      }

      // Check if free user is trying to select premium model
      if (user.subscription_tier === 'free' && !modelInfo.isFree) {
        return res.status(403).json({
          success: false,
          error: 'Premium models require a Pro subscription'
        });
      }
    }

    // Validate provider preference
    if (ai_provider_preference && !['openrouter', 'gemini', 'auto'].includes(ai_provider_preference)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider preference'
      });
    }

    // Update user preferences
    const updateData: Partial<User> = {};
    if (preferred_ai_model !== undefined) {
      updateData.preferred_ai_model = preferred_ai_model;
    }
    if (ai_provider_preference !== undefined) {
      updateData.ai_provider_preference = ai_provider_preference;
    }

    await user.update(updateData);

    res.json({
      success: true,
      message: 'AI preferences updated successfully',
      data: {
        preferred_ai_model: user.preferred_ai_model,
        ai_provider_preference: user.ai_provider_preference
      }
    });
  } catch (error) {
    console.error('Error updating AI preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update AI preferences'
    });
  }
});

// Analyze project with user's preferred model
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const user = req.user as User;
    const { 
      name, 
      description, 
      type = 'general', 
      scope = 'medium',
      requirements = [],
      constraints = []
    } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Project name and description are required'
      });
    }

    const analysisRequest = {
      projectName: name,
      description,
      type,
      scope,
      requirements,
      constraints
    };

    const suggestions = await aiService.analyzeProject(analysisRequest, user);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error analyzing project:', error);
    
    if (error instanceof Error && error.message === 'AI service is not available') {
      return res.status(503).json({
        success: false,
        error: 'AI service is temporarily unavailable'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to analyze project'
    });
  }
});

export default router; 