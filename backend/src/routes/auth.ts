import express from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { config } from '../config/env.js';
import { generateTokenPair, createOrUpdateUserFromGitHub } from '../utils/auth.js';
import { User } from '../models/User.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// Configure GitHub OAuth Strategy
passport.use(new GitHubStrategy({
  clientID: config.GITHUB_CLIENT_ID,
  clientSecret: config.GITHUB_CLIENT_SECRET,
  callbackURL: config.GITHUB_CALLBACK_URL
}, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
  try {
    const user = await createOrUpdateUserFromGitHub(profile);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Configure JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.JWT_SECRET
}, async (payload: any, done: any) => {
  try {
    const user = await User.findByPk(payload.userId);
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
}));

// Initialize passport
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Routes

// GitHub OAuth login
router.get('/github', passport.authenticate('github', {
  scope: ['user:email']
}));

// GitHub OAuth callback
router.get('/github/callback', 
  passport.authenticate('github', { session: false }),
  async (req: express.Request, res: express.Response) => {
    try {
      const user = req.user as User;
      
      if (!user) {
        return res.redirect(`${config.FRONTEND_URL}/auth/error?message=Authentication failed`);
      }

      // Generate tokens
      const tokens = generateTokenPair(user);
      
      // Redirect to frontend with tokens
      const redirectUrl = `${config.FRONTEND_URL}/auth/success?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`;
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.redirect(`${config.FRONTEND_URL}/auth/error?message=Authentication failed`);
    }
  }
);

// Get current user info
router.get('/me', authenticateToken, (req: express.Request, res: express.Response) => {
  const user = (req as AuthenticatedRequest).user;
  res.json({ user: user.toPublicJSON() });
});

// Logout (client-side token deletion)
router.post('/logout', authenticateToken, (req: express.Request, res: express.Response) => {
  // For JWT, logout is handled client-side by deleting the token
  res.json({ message: 'Logged out successfully' });
});

// Refresh token endpoint (placeholder for future implementation)
router.post('/refresh', (req: express.Request, res: express.Response) => {
  res.status(501).json({ 
    error: 'Not Implemented', 
    message: 'Token refresh not yet implemented' 
  });
});

export default router; 