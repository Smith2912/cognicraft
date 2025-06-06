# CogniCraft Backend API

Node.js/Express.js backend with PostgreSQL, JWT authentication, and AI integration.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your GitHub OAuth and Gemini API credentials

# Start development server
npm run dev
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── models/          # Database models (User, Project, Node, Edge)
│   ├── routes/          # API routes (auth, projects, canvas, ai)
│   ├── middleware/      # Express middleware (auth, validation)
│   ├── services/        # Business logic (AI service)
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── .env.example         # Environment template
├── GITHUB_OAUTH_SETUP.md # OAuth setup guide
├── package.json
└── README.md
```

## 🛠️ Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL with Sequelize ORM
- **Authentication:** JWT + GitHub OAuth (Passport.js)
- **AI:** OpenRouter (primary) & Google Gemini (fallback)
- **Validation:** express-validator
- **Security:** helmet, cors, rate limiting
- **Development:** tsx, nodemon

## 📊 Database Models

### User
- id (UUID, Primary Key)
- github_id (Integer, Unique)
- username (String)
- email (String)
- avatar_url (String)
- created_at, updated_at (Timestamps)

### Project
- id (UUID, Primary Key)
- name (String, Required)
- github_repo_url (String, Optional)
- owner_user_id (UUID, Foreign Key → User)
- created_at, updated_at (Timestamps)

### Node (Canvas Tasks)
- id (UUID, Primary Key)
- title (String, Required)
- description (Text, Optional)
- x_position, y_position (Integer, Required)
- width, height (Integer, Defaults: 200x150)
- status (Enum: ToDo, InProgress, Completed, Blocked)
- icon_id (String, Default: 'github')
- project_id (UUID, Foreign Key → Project)
- created_at, updated_at (Timestamps)

### Edge (Task Dependencies)
- id (UUID, Primary Key)
- source_node_id (UUID, Foreign Key → Node)
- target_node_id (UUID, Foreign Key → Node)
- project_id (UUID, Foreign Key → Project)
- created_at, updated_at (Timestamps)

## 🔌 API Endpoints

### Authentication
```
GET  /api/v1/auth/github           # Start GitHub OAuth flow
GET  /api/v1/auth/github/callback  # GitHub OAuth callback
GET  /api/v1/auth/me               # Get current user
POST /api/v1/auth/logout           # Logout user
```

### Project Management
```
GET    /api/v1/projects            # List user's projects
GET    /api/v1/projects/:id        # Get project with canvas data
POST   /api/v1/projects            # Create new project
PUT    /api/v1/projects/:id        # Update project
DELETE /api/v1/projects/:id        # Delete project
```

### Canvas State Management
```
GET    /api/v1/projects/:id/canvas           # Get canvas state (nodes & edges)
PUT    /api/v1/projects/:id/canvas           # Save canvas state (atomic)
POST   /api/v1/projects/:id/nodes            # Create single node
PUT    /api/v1/projects/:id/nodes/:nodeId    # Update node
DELETE /api/v1/projects/:id/nodes/:nodeId    # Delete node (with edge cleanup)
```

### AI Features
```
GET  /api/v1/ai/status                       # Check AI service availability
POST /api/v1/ai/chat                         # General AI chat completion
POST /api/v1/ai/analyze-project              # Analyze project and suggest tasks
POST /api/v1/ai/break-down-task              # Break down task into subtasks
POST /api/v1/ai/optimize-workflow/:projectId # Optimize project workflow
```

### System
```
GET /health              # Health check endpoint
GET /api/v1/status       # API status and version
```

## 🔐 Authentication

All API endpoints (except auth routes and health checks) require JWT authentication:

```bash
Authorization: Bearer <jwt_token>
```

OAuth flow:
1. Frontend redirects to `/api/v1/auth/github`
2. User authorizes on GitHub
3. GitHub redirects to callback with code
4. Backend exchanges code for user info and returns JWT
5. Frontend stores JWT for subsequent requests

## 🤖 AI Integration

### Providers:
- **OpenRouter** (Primary): Access to Claude-3.5-Sonnet, GPT-4, and other models
- **Gemini** (Fallback): Google's Generative AI

### Available AI Features:

1. **Project Analysis** - Analyzes project and suggests tasks
2. **Task Breakdown** - Breaks complex tasks into subtasks  
3. **Workflow Optimization** - Suggests improvements to task flow
4. **General Chat** - AI assistant for development questions
5. **Model Selection** - Configure preferred AI model via environment

### Example AI Request:
```bash
curl -X POST http://localhost:3001/api/v1/ai/analyze-project \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "E-commerce Website",
    "projectType": "web-app",
    "additionalContext": "React frontend with Node.js backend"
  }'
```

## 🧪 Development

```bash
# Start development server with auto-reload
npm run dev

# Build TypeScript for production
npm run build

# Start production server
npm start

# Database operations (when DB is connected)
npm run migrate
npm run seed
```

## 🌐 Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Set up GitHub OAuth:** Follow `GITHUB_OAUTH_SETUP.md`

3. **Get AI API keys:**
   - OpenRouter: https://openrouter.ai/keys (recommended)
   - Gemini: https://makersuite.google.com/app/apikey (fallback)

4. **Key environment variables:**
   ```env
   # GitHub OAuth (required for auth)
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   
   # AI Integration (choose one or both)
   AI_PROVIDER=openrouter
   OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key
   OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
   GEMINI_API_KEY=your_gemini_api_key  # fallback
   
   # Security (generate strong keys)
   JWT_SECRET=your-super-secret-jwt-key
   
   # Database (Railway PostgreSQL or local)
   DATABASE_URL=postgresql://localhost:5432/cognicraft
   ```

## 📈 Features Status

### ✅ Completed (Phase 1)
- JWT Authentication with GitHub OAuth
- PostgreSQL database with full ORM
- Complete project & canvas management APIs
- AI-powered project analysis & task suggestions
- Request validation & error handling  
- Security middleware & rate limiting
- Development-friendly configuration
- Comprehensive API documentation

### 🔄 Next Phase
- Frontend service layer integration
- Real-time updates (Socket.IO)
- Advanced AI autonomous agent
- Stripe payment integration
- Advanced project collaboration features

## 🚀 Deployment

### Railway (Recommended)
1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically

### Manual Deployment
- Compatible with Heroku, DigitalOcean, AWS, etc.
- Requires Node.js 18+ and PostgreSQL
- Set `NODE_ENV=production`

## 🔧 Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test API status  
curl http://localhost:3001/api/v1/status

# Test AI service (requires auth)
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/ai/status
```

## 🆘 Support

- See `GITHUB_OAUTH_SETUP.md` for OAuth setup
- Check `.env.example` for all configuration options
- Backend runs on `http://localhost:3001` by default
- Frontend expected at `http://localhost:5173` 