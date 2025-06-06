# 🐘 PostgreSQL Setup Guide for CogniCraft

This guide will help you install and configure PostgreSQL locally for CogniCraft development.

## Quick Setup

### 1. Install PostgreSQL

#### Option A: Official Installer (Recommended)
1. Go to: https://www.postgresql.org/download/windows/
2. Download PostgreSQL 16.x for Windows x86-64
3. Run the installer with these settings:
   - **Password for 'postgres' user**: `password` (or update `.env` file)
   - **Port**: `5432` (default)
   - **Components**: Install all (PostgreSQL Server, pgAdmin 4, Command Line Tools)

#### Option B: Chocolatey (If you have it installed)
```bash
# Run as Administrator
choco install postgresql --confirm
```

### 2. Setup Database
```bash
# Run the automated setup script
npm run setup:db
```

### 3. Start Development Servers
```bash
# Start both frontend and backend
npm run start:dev
```

## Manual Setup

If the automated setup doesn't work, follow these manual steps:

### 1. Check PostgreSQL Installation
```bash
# Test if PostgreSQL is running
psql -U postgres -d postgres
```

### 2. Create Database Manually
```sql
-- Connect to PostgreSQL as postgres user
psql -U postgres

-- Create the database
CREATE DATABASE cognicraft;

-- List databases to verify
\l

-- Exit
\q
```

### 3. Update Environment Variables

Your `backend/.env` file should have:
```env
DATABASE_URL=postgresql://localhost:5432/cognicraft
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cognicraft
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_SSL=false
```

## Configuration

### Database Credentials
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `cognicraft`
- **User**: `postgres`
- **Password**: `password` (change in both PostgreSQL and `.env`)

### Environment File
The backend uses `backend/.env` for database configuration. Key variables:
- `DATABASE_URL`: Full connection string
- `DATABASE_PASSWORD`: Must match your PostgreSQL postgres user password

## Testing the Connection

### 1. Test Database Connection
```bash
npm run setup:db
```

### 2. Start Backend (with database sync)
```bash
cd backend
npm run dev
```

Look for these success messages:
```
✅ Database connection has been established successfully.
✅ Database synchronized successfully.
```

### 3. Test API Endpoints
Once backend is running, test:
- Health check: http://localhost:3001/api/v1/health
- Auth endpoints: http://localhost:3001/api/v1/auth/

## Troubleshooting

### Connection Issues

**Error: "ECONNREFUSED"**
- PostgreSQL service is not running
- Start via Services (Windows) or `net start postgresql-x64-16`

**Error: "password authentication failed"**
- Password mismatch between PostgreSQL and `.env`
- Reset password: `psql -U postgres` then `\password postgres`

**Error: "database does not exist"**
- Run: `npm run setup:db`
- Or manually: `createdb -U postgres cognicraft`

### Service Management

**Start PostgreSQL (Windows)**
```bash
# Via Services
services.msc
# Find "postgresql-x64-16" and start

# Via Command Line
net start postgresql-x64-16
```

**Stop PostgreSQL**
```bash
net stop postgresql-x64-16
```

### Database Tools

**pgAdmin 4** (GUI tool)
- Installed with PostgreSQL
- Access: Start Menu > pgAdmin 4
- Connect with postgres credentials

**Command Line Tools**
```bash
# Connect to database
psql -U postgres -d cognicraft

# List tables
\dt

# Describe table
\d table_name

# Exit
\q
```

## Database Schema

The backend automatically creates these tables when started:
- `users` - User accounts and profiles
- `projects` - Project data and metadata
- `canvas_nodes` - Node graph data
- `canvas_edges` - Edge connections
- `ai_preferences` - User AI model settings

## Development Workflow

1. **Start PostgreSQL** (if not auto-started)
2. **Run setup** (first time): `npm run setup:db`
3. **Start development**: `npm run start:dev`
4. **Backend**: Connects to PostgreSQL, syncs tables
5. **Frontend**: Connects to backend API

## Production Notes

For production deployment:
- Use strong passwords
- Enable SSL connections
- Use connection pooling
- Set up database backups
- Monitor connection limits

## Backup & Restore

**Backup**
```bash
pg_dump -U postgres cognicraft > backup.sql
```

**Restore**
```bash
psql -U postgres cognicraft < backup.sql
```

## Need Help?

1. Check PostgreSQL service is running
2. Verify credentials in `.env` match PostgreSQL
3. Run `npm run setup:db` for automated diagnosis
4. Check logs in backend console for specific errors 