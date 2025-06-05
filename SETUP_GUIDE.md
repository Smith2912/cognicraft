# CogniCraft Development Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- GitHub OAuth application

### 1. Frontend Setup
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure frontend environment
# Edit .env and set:
VITE_API_URL=http://localhost:3001
VITE_GITHUB_CLIENT_ID=your_github_client_id
```

### 2. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure backend environment
# Edit backend/.env and set all required variables (see backend/README.md)
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb cognicraft_dev

# The backend will automatically create tables on first run
```

### 4. GitHub OAuth Setup
Follow `backend/GITHUB_OAUTH_SETUP.md` for detailed OAuth configuration.

### 5. Run Development Servers

#### Terminal 1: Backend
```bash
cd backend
npm run dev
# Backend runs on http://localhost:3001
```

#### Terminal 2: Frontend
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

## 🔧 Current Integration Status

### ✅ Completed Features
- **Authentication Layer**: GitHub OAuth with migration flow
- **Service Layer**: Complete API client with error handling
- **Migration System**: Automatic localStorage to backend migration
- **Loading States**: Smooth authentication initialization
- **Environment Configuration**: Separated frontend/backend configs

### 🔄 Integration Flow
1. **Authentication Check**: App loads and checks for existing GitHub token
2. **Migration Detection**: Automatically detects localStorage data needing migration
3. **Migration Dialog**: User-friendly dialog guides through migration process
4. **Cloud Sync**: Projects automatically sync between devices once migrated

### 🎯 What's Next
1. **Header Integration**: Add login/logout buttons and user profile
2. **Project Loading**: Replace localStorage with backend API calls
3. **Real-time Sync**: Implement automatic saves to backend
4. **AI Integration**: Switch from direct Gemini calls to backend proxy

## 🧪 Testing the Integration

### Test Authentication Flow
1. Start both servers
2. Visit http://localhost:5173
3. Should see migration dialog if localStorage data exists
4. Click "Sign In with GitHub" to test OAuth
5. Complete migration process

### Test Offline Mode
- App should work offline with localStorage fallback
- Migration dialog appears when going back online

### Test Clean Install
- Clear localStorage and visit site
- Should see welcome dialog for new users

## 🔍 Development Notes

### Authentication States
- **Loading**: Initial authentication check
- **Unauthenticated**: No GitHub token, can use offline mode
- **Authenticated**: Valid GitHub token, backend access enabled
- **Migration Needed**: Local data needs to be migrated to backend

### Error Handling
- Network errors fall back to offline mode
- Invalid tokens are automatically cleared
- Migration failures can be retried

### Service Layer Architecture
```
AppWithAuth (wrapper)
├── AuthWrapper (authentication state)
├── MigrationDialog (migration UI)
└── App (existing functionality)
```

## 🚨 Troubleshooting

### "Authentication Failed"
- Check GitHub OAuth app configuration
- Verify GITHUB_CLIENT_SECRET in backend .env
- Ensure callback URL matches GitHub app settings

### "Backend Connection Failed"
- Verify backend is running on port 3001
- Check VITE_API_URL in frontend .env
- Check database connection in backend

### "Migration Failed"
- Check browser console for detailed errors
- Verify user is authenticated before migration
- Try refreshing and retrying migration

### TypeScript Errors
- Run `npm install` in both frontend and backend
- Clear node_modules and reinstall if issues persist
- Check all .env files are properly configured

## 📦 Deployment Preparation

The app is designed for Railway deployment:
- **Backend**: Uses Railway PostgreSQL addon
- **Frontend**: Static build deployable anywhere
- **Environment**: Production configs in railway.json

Next steps include completing the integration and setting up production deployment. 