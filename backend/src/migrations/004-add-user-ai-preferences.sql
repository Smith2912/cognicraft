-- Migration: Add AI preference columns to users table
-- Description: Add preferred_ai_model and ai_provider_preference columns

ALTER TABLE users 
ADD COLUMN preferred_ai_model VARCHAR(255) DEFAULT 'openai/gpt-3.5-turbo',
ADD COLUMN ai_provider_preference VARCHAR(20) DEFAULT 'auto' CHECK (ai_provider_preference IN ('openrouter', 'gemini', 'auto'));

-- Add indexes for better query performance
CREATE INDEX idx_users_ai_preferences ON users(ai_provider_preference, preferred_ai_model);

-- Update existing users to have default preferences
UPDATE users 
SET 
  preferred_ai_model = CASE 
    WHEN subscription_tier = 'free' THEN 'openai/gpt-3.5-turbo'
    ELSE 'anthropic/claude-3.5-sonnet'
  END,
  ai_provider_preference = 'auto'
WHERE preferred_ai_model IS NULL OR ai_provider_preference IS NULL; 