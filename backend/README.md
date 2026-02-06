# CogniCraft Backend

This is the backend API server for CogniCraft.

## Run Locally

1. Install dependencies:
   `npm install`
2. Start the dev server:
   `npm run dev`

## API Routes (Core)

- `GET  /health` – health check
- `GET  /api/v1/status` – API status
- `GET  /api/v1/auth/*` – auth routes
- `GET  /api/v1/projects` – list projects
- `GET  /api/v1/projects/:id` – project details
- `GET  /api/v1/projects/:id/canvas` – canvas state
- `PUT  /api/v1/projects/:id/canvas` – save canvas state

## OpenClaw Command API

This endpoint is intended for local OpenClaw integration to create/update nodes directly.

### POST `/api/v1/openclaw/action`

**Body:**
```json
{
  "projectId": "<project-uuid>",
  "action": "CREATE_NODE",
  "payload": {
    "title": "New Task",
    "description": "Define requirements and scope",
    "x": 100,
    "y": 200
  }
}
```

Supported actions:
- `CREATE_NODE`
- `CREATE_SUBTASKS`
- `UPDATE_NODE`
- `CREATE_EDGE`

If `OPENCLAW_TOKEN` is set in the environment, include it as:
`X-OpenClaw-Token: <token>`
