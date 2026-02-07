import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config/env.js';
import { testConnection } from './config/database.js';
import { syncModels } from './models/index.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import canvasRoutes from './routes/canvas.js';
import openclawRoutes from './routes/openclaw.js';
import { addClient, removeClient } from './services/openclawHub.js';
import { isLocalSocket } from './middleware/openclawAuth.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = new Set([
  config.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.path.startsWith('/v1/openclaw')
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/v1/auth', authLimiter);
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Passport middleware
app.use(passport.initialize());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.get('/api/v1/status', (req, res) => {
  res.json({
    message: 'CogniCraft API is running!',
    version: config.API_VERSION,
    environment: config.NODE_ENV
  });
});

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// Project and canvas routes
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/projects', canvasRoutes);

// OpenClaw command API (local integration)
app.use('/api/v1/openclaw', openclawRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/v1/openclaw/ws' });

wss.on('connection', (socket, request) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const projectId = url.searchParams.get('projectId');
    const token = url.searchParams.get('token');

    if (!projectId) {
      socket.close();
      return;
    }

    const allowRemote = config.OPENCLAW_ALLOW_REMOTE === true;
    const remoteAddress = request.socket?.remoteAddress || null;
    const host = request.headers.host || null;
    const origin = request.headers.origin || null;

    if (!allowRemote && !isLocalSocket(remoteAddress, host, origin)) {
      socket.close();
      return;
    }

    if (config.OPENCLAW_TOKEN && token !== config.OPENCLAW_TOKEN) {
      socket.close();
      return;
    }

    addClient(projectId, socket);

    socket.on('close', () => {
      removeClient(projectId, socket);
    });
  } catch {
    socket.close();
  }
});

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting CogniCraft Backend Server...');

    // Test database connection
    await testConnection();

    // Sync database models in development (only if database is available)
    if (config.NODE_ENV === 'development' && !config.DATABASE_URL.includes('localhost')) {
      console.log('🔄 Synchronizing database models...');
      await syncModels(false); // Don't force drop tables
    } else if (config.NODE_ENV === 'development') {
      console.log('⚠️  Skipping database sync (no database connection)');
    }

    server.listen(config.PORT, () => {
      console.log(`✅ Server running on port ${config.PORT}`);
      console.log(`📊 Environment: ${config.NODE_ENV}`);
      console.log(`🌐 Frontend URL: ${config.FRONTEND_URL}`);
      console.log(`📚 API Version: ${config.API_VERSION}`);
      console.log(`🔗 Health Check: http://localhost:${config.PORT}/health`);
      console.log(`🛡️  Rate Limit: ${config.RATE_LIMIT_MAX_REQUESTS} requests per ${config.RATE_LIMIT_WINDOW_MS}ms`);
      console.log(`🔌 OpenClaw WS: ws://localhost:${config.PORT}/api/v1/openclaw/ws`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
