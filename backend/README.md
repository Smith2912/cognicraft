# CogniCraft Backend

Node.js/Express.js backend for CogniCraft visual planning application.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (local or Railway)
- GitHub OAuth App

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

3. **GitHub OAuth App Setup**
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Create new OAuth App with:
     - Application name: `CogniCraft Dev`
     - Homepage URL: `http://localhost:5173`
     - Authorization callback URL: `http://localhost:3001/api/v1/auth/github/callback`
   - Copy Client ID and Client Secret to `.env`

4. **Database Setup**
   - For development: Update `DATABASE_URL` in `.env`
   - For production: Use Railway PostgreSQL connection string

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🏗️ Architecture

### Models
- **User**: GitHub OAuth users with subscription tiers
- **Project**: User-owned project containers
- **Node**: Canvas nodes with positions and metadata
- **Edge**: Connections between nodes

### Authentication
- **GitHub OAuth** for user login
- **JWT tokens** for API authentication
- **Passport.js** for auth strategy management

### API Endpoints

#### Authentication
- `GET /api/v1/auth/github` - Start GitHub OAuth
- `GET /api/v1/auth/github/callback` - OAuth callback
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout

#### Health Check
- `GET /health` - Server health status
- `GET /api/v1/status` - API status

## 🔧 Development

### Build
```bash
npm run build
```

### Database Migration
```bash
npm run migrate
```

### Run in Production
```bash
npm start
```

## 🚀 Deployment (Railway)

1. Connect GitHub repository to Railway
2. Add environment variables in Railway dashboard
3. Deploy automatically on push to main branch

### Required Environment Variables for Production
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://... (Railway provides this)
JWT_SECRET=your-production-jwt-secret
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
OPENROUTER_API_KEY=your-openrouter-api-key
FRONTEND_URL=https://your-frontend-domain.com
```

# Required Environment Variables
DATABASE_URL=postgresql://user:password@localhost:5432/cognicraft
JWT_SECRET=your-super-secret-jwt-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
OPENROUTER_API_KEY=your-openrouter-api-key

# Optional Environment Variables
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
DEFAULT_LLM_MODEL=google/gemini-2.0-flash-exp:free 