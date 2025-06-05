# GitHub OAuth Setup Guide

This guide will help you set up GitHub OAuth authentication for CogniCraft.

## 📝 **Step 1: Create GitHub OAuth App**

1. **Go to GitHub Developer Settings:**
   - Visit: https://github.com/settings/applications/new
   - Or navigate to: Settings → Developer settings → OAuth Apps → New OAuth App

2. **Fill in the Application Details:**
   ```
   Application name: CogniCraft Development
   Homepage URL: http://localhost:5173
   Application description: AI-powered planning tool for software development
   Authorization callback URL: http://localhost:3001/api/v1/auth/github/callback
   ```

3. **Create the Application:**
   - Click "Register application"
   - You'll be redirected to your app's settings page

## 🔑 **Step 2: Get Your OAuth Credentials**

1. **Copy the Client ID:**
   - It's displayed on the app settings page
   - Example: `Ov23liABCDEF123456789`

2. **Generate Client Secret:**
   - Click "Generate a new client secret"
   - **⚠️ IMPORTANT:** Copy this immediately - you won't be able to see it again!
   - Example: `1234567890abcdef1234567890abcdef12345678`

## ⚙️ **Step 3: Configure Environment Variables**

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update your `.env` file:**
   ```env
   # Replace with your actual GitHub OAuth credentials
   GITHUB_CLIENT_ID=Ov23liABCDEF123456789
   GITHUB_CLIENT_SECRET=1234567890abcdef1234567890abcdef12345678
   GITHUB_CALLBACK_URL=http://localhost:3001/api/v1/auth/github/callback
   ```

3. **Add a Gemini AI key (for AI features):**
   - Get a free API key from: https://makersuite.google.com/app/apikey
   - Add it to your `.env` file:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

## 🧪 **Step 4: Test the Integration**

1. **Start the backend server:**
   ```bash
   npm run dev
   ```

2. **Test the GitHub OAuth flow:**
   ```bash
   # Test OAuth initiation endpoint
   curl http://localhost:3001/api/v1/auth/github
   
   # Should redirect to GitHub authorization page
   ```

3. **Check AI service status:**
   ```bash
   curl http://localhost:3001/api/v1/ai/status
   
   # Should return: {"available": true, "message": "AI service is available"}
   ```

## 🌐 **Step 5: Production Setup (Later)**

When you're ready to deploy to production:

1. **Create a production OAuth app:**
   - Use your production domain instead of localhost
   - Example callback URL: `https://your-domain.com/api/v1/auth/github/callback`

2. **Update environment variables:**
   ```env
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-domain.com
   GITHUB_CALLBACK_URL=https://your-api-domain.com/api/v1/auth/github/callback
   ```

## 🔧 **Frontend Integration**

The frontend will use these endpoints:

```typescript
// GitHub OAuth login
GET /api/v1/auth/github

// Handle callback (automatic)
GET /api/v1/auth/github/callback

// Get current user
GET /api/v1/auth/me

// Logout
POST /api/v1/auth/logout
```

## 🛡️ **Security Notes**

1. **Never commit your `.env` file** - it's already in `.gitignore`
2. **Use different OAuth apps for development and production**
3. **Regenerate secrets regularly in production**
4. **Use HTTPS in production**

## 🚨 **Troubleshooting**

**Error: "The redirect_uri MUST match the registered callback URL"**
- Make sure your callback URL in GitHub exactly matches the one in your code
- Common issue: http vs https, trailing slashes, port numbers

**Error: "Bad verification code"**
- This usually means your client secret is incorrect
- Double-check your `.env` file

**Error: "AI service is not configured"**
- Add your Gemini API key to the `.env` file
- Restart the backend server

## ✅ **Verification Checklist**

- [ ] GitHub OAuth app created
- [ ] Client ID and Secret copied to `.env`
- [ ] Gemini API key added to `.env`
- [ ] Backend server starts without errors
- [ ] `/api/v1/auth/github` redirects to GitHub
- [ ] `/api/v1/ai/status` returns `{"available": true}`

Your GitHub OAuth integration is now ready! 🎉 