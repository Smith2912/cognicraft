# GitHub OAuth Setup

1. Create a GitHub OAuth App.
2. Use the callback URL: `http://localhost:3001/api/v1/auth/github/callback`
3. Set the client ID/secret in `backend/.env`.

## Quick Checks

- `GET /health` should return `{"status":"ok"}`
- `GET /api/v1/status` should return API version info
