import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  API_VERSION: process.env.API_VERSION || 'v1',

  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/cognicraft',
  DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432', 10),
  DATABASE_NAME: process.env.DATABASE_NAME || 'cognicraft',
  DATABASE_USER: process.env.DATABASE_USER || 'postgres',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || 'password',
  DATABASE_SSL: process.env.DATABASE_SSL === 'true',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key',

  // GitHub OAuth
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  GITHUB_CALLBACK_URL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/github/callback',

  // Frontend URL
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // AI Configuration
  AI_PROVIDER: process.env.AI_PROVIDER || 'openrouter', // 'openrouter' or 'gemini'
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL || 'https://cognicraft.ai',
  OPENROUTER_APP_NAME: process.env.OPENROUTER_APP_NAME || 'CogniCraft',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-pro',

  // Stripe Configuration
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// Validate required environment variables for production
if (config.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET'
  ];

  // Add AI provider specific requirements
  if (config.AI_PROVIDER === 'openrouter') {
    requiredEnvVars.push('OPENROUTER_API_KEY');
  } else if (config.AI_PROVIDER === 'gemini') {
    requiredEnvVars.push('GEMINI_API_KEY');
  }

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }
} else {
  // Development mode - warn about missing keys but don't exit
  const optionalInDev = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  
  if (config.AI_PROVIDER === 'openrouter') {
    optionalInDev.push('OPENROUTER_API_KEY');
  } else if (config.AI_PROVIDER === 'gemini') {
    optionalInDev.push('GEMINI_API_KEY');
  }
  
  for (const envVar of optionalInDev) {
    if (!process.env[envVar]) {
      console.warn(`⚠️  Missing environment variable: ${envVar} (features will be disabled)`);
    }
  }
}

export default config; 