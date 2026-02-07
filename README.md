# CogniCraft

Security-first AI planning workspace with OpenClaw local automation.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run backend + frontend:
   `npm run dev:all:open`
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

## Backend Setup

- Ensure PostgreSQL is available.
- Run migrations in `backend/src/migrations`:
  - `005-add-project-team-members.sql`
  - `006-add-project-team-roles.sql`

## OpenClaw (Local AI)

- Local AI runs entirely on-device and can emit JSON actions for nodes/subtasks.
- AI actions require approval by default (Settings → Pending AI Actions).
- Set `OPENCLAW_TOKEN` and `VITE_OPENCLAW_TOKEN` to the same value for local-only access.

## UX Highlights

- Edge delete (context menu or Delete/Backspace)
- Node copy/paste (Ctrl/Cmd+C, Ctrl/Cmd+V)
- Node search/filter (header search bar)

## Roadmap

See `ROADMAP.md` for current phase status.
