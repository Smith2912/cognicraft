import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractBearerToken } from '../utils/auth.js';
import { User } from '../models/User.js';

// Extend Request interface to include user
export interface AuthenticatedRequest extends Request {
  user: User;
}

// Authentication middleware
export const authenticateToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Access token required' 
      });
      return;
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Get user from database
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User not found' 
      });
      return;
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = user;
    next();
    
  } catch (error) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
};

// Optional authentication middleware (doesn't require token)
export const optionalAuth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findByPk(decoded.userId);
      
      if (user) {
        (req as AuthenticatedRequest).user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

export default {
  authenticateToken,
  optionalAuth
}; 