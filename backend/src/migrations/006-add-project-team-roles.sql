-- Add team member roles to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS team_members JSONB NOT NULL DEFAULT '[]';
