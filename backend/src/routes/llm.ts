import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { llmService } from '../services/llmService.js';
import { Project, ChatMessage } from '../models/index.js';

const router = Router();

// All LLM routes require authentication
router.use(authenticateToken);

/**
 * Get available LLM models
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = llmService.getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch available models' });
  }
});

/**
 * Create a chat completion
 */
router.post('/chat/completions', async (req: Request, res: Response) => {
  try {
    const { model, messages, temperature, maxTokens, projectId } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // Validate request
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request. Model and messages are required.' 
      });
    }

    // Check if model is available
    const modelInfo = llmService.getModel(model);
    if (!modelInfo) {
      return res.status(400).json({ 
        error: `Model ${model} is not available` 
      });
    }

    // Create chat completion
    const response = await llmService.createChatCompletion({
      model,
      messages,
      temperature,
      maxTokens,
      userId,
      projectId
    });

    // Store the interaction in the database if projectId is provided
    if (projectId) {
      const project = await Project.findByPk(projectId);

      if (project && project.owner_user_id === userId) {
        // Store user message
        const userMessage = messages[messages.length - 1];
        if (userMessage && userMessage.role === 'user') {
          await ChatMessage.create({
            project_id: projectId,
            text_content: userMessage.content,
            sender_type: 'user',
            timestamp: new Date()
          });
        }

        // Store AI response
        if (response.choices[0]?.message?.content) {
          await ChatMessage.create({
            project_id: projectId,
            text_content: response.choices[0].message.content,
            sender_type: 'ai',
            timestamp: new Date(),
            model: model
          });
        }
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error creating chat completion:', error);
    res.status(500).json({ 
      error: 'Failed to generate response' 
    });
  }
});

/**
 * Stream a chat completion
 */
router.post('/chat/completions/stream', async (req: Request, res: Response) => {
  try {
    const { model, messages, temperature, maxTokens, projectId } = req.body;
    const userId = (req as AuthenticatedRequest).user.id;

    // Validate request
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request. Model and messages are required.' 
      });
    }

    // Check if model is available
    const modelInfo = llmService.getModel(model);
    if (!modelInfo) {
      return res.status(400).json({ 
        error: `Model ${model} is not available` 
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Store user message if projectId is provided
    if (projectId) {
      const project = await Project.findByPk(projectId);

      if (project && project.owner_user_id === userId) {
        const userMessage = messages[messages.length - 1];
        if (userMessage && userMessage.role === 'user') {
          await ChatMessage.create({
            project_id: projectId,
            text_content: userMessage.content,
            sender_type: 'user',
            timestamp: new Date()
          });
        }
      }
    }

    // Stream the response
    let fullResponse = '';
    const stream = llmService.streamChatCompletion({
      model,
      messages,
      temperature,
      maxTokens,
      userId,
      projectId
    });

    for await (const chunk of stream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    // Send completion event
    res.write(`data: [DONE]\n\n`);

    // Store AI response if projectId is provided
    if (projectId && fullResponse) {
      const project = await Project.findByPk(projectId);

      if (project && project.owner_user_id === userId) {
        await ChatMessage.create({
          project_id: projectId,
          text_content: fullResponse,
          sender_type: 'ai',
          timestamp: new Date(),
          model: model
        });
      }
    }

    res.end();
  } catch (error) {
    console.error('Error streaming chat completion:', error);
    res.status(500).json({ 
      error: 'Failed to stream response' 
    });
  }
});

/**
 * Get chat history for a project
 */
router.get('/projects/:projectId/chat/messages', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { limit = 50, beforeTimestamp } = req.query;
    const userId = (req as AuthenticatedRequest).user.id;

    // Verify project ownership
    const project = await Project.findByPk(projectId);

    if (!project || project.owner_user_id !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Build where clause
    const whereClause: any = { project_id: projectId };
    if (beforeTimestamp) {
      const { Op } = await import('sequelize');
      whereClause.timestamp = { [Op.lt]: new Date(beforeTimestamp as string) };
    }

    // Fetch messages
    const messages = await ChatMessage.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: Number(limit),
      attributes: [
        'id',
        'text_content',
        'sender_type',
        'timestamp',
        'model',
        'is_error',
        'parsed_action'
      ]
    });

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

/**
 * Reset chat history for a project
 */
router.post('/projects/:projectId/chat/reset', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;

    // Verify project ownership
    const project = await Project.findByPk(projectId);

    if (!project || project.owner_user_id !== userId) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete all chat messages for the project
    await ChatMessage.destroy({
      where: { project_id: projectId }
    });

    res.json({ message: 'Chat history has been cleared' });
  } catch (error) {
    console.error('Error resetting chat history:', error);
    res.status(500).json({ error: 'Failed to reset chat history' });
  }
});

export default router;