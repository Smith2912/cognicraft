import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';

export interface JWTPayload {
  userId: string;
  username: string;
  subscription_tier: 'free' | 'pro';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Generate JWT access token
export const generateAccessToken = (user: User): string => {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    subscription_tier: user.subscription_tier
  };

  return jwt.sign(payload, config.JWT_SECRET);
};

// Generate JWT refresh token
export const generateRefreshToken = (user: User): string => {
  const payload = {
    userId: user.id,
    type: 'refresh'
  };

  return jwt.sign(payload, config.REFRESH_TOKEN_SECRET);
};

// Generate both tokens
export const generateTokenPair = (user: User): TokenPair => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
};

// Verify JWT access token
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      issuer: 'cognicraft-api',
      audience: 'cognicraft-client'
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Verify JWT refresh token
export const verifyRefreshToken = (token: string): { userId: string; type: string } => {
  try {
    const decoded = jwt.verify(token, config.REFRESH_TOKEN_SECRET, {
      issuer: 'cognicraft-api'
    }) as { userId: string; type: string };
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

// Extract token from Authorization header
export const extractBearerToken = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

// Create or update user from GitHub profile
export const createOrUpdateUserFromGitHub = async (profile: any): Promise<User> => {
  const {
    id: githubId,
    username,
    displayName,
    emails,
    photos
  } = profile;

  const email = emails && emails.length > 0 ? emails[0].value : null;
  const avatarUrl = photos && photos.length > 0 ? photos[0].value : null;

  try {
    // Try to find existing user by GitHub ID
    let user = await User.findOne({ where: { github_id: githubId.toString() } });

    if (user) {
      // Update existing user
      user.username = username || user.username;
      user.email = email || user.email;
      user.avatar_url = avatarUrl || user.avatar_url;
      await user.save();
    } else {
      // Check if username already exists
      const existingUser = await User.findOne({ where: { username } });
      
      if (existingUser) {
        throw new Error(`Username ${username} is already taken`);
      }

      // Create new user
      user = await User.create({
        username,
        email,
        avatar_url: avatarUrl,
        github_id: githubId.toString(),
        subscription_tier: 'free'
      });
    }

    return user;
  } catch (error) {
    console.error('Error creating/updating user from GitHub:', error);
    throw error;
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,
  createOrUpdateUserFromGitHub
}; 