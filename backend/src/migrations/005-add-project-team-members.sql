-- Add team member usernames to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS team_member_usernames JSONB NOT NULL DEFAULT '[]';
