// User model - basic structure for now
// Will be completed once Sequelize is installed

import { DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { sequelize } from '../config/database.js';

export interface UserAttributes {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  password_hash?: string;
  github_id?: string;
  subscription_tier: 'free' | 'pro';
  preferred_ai_model?: string;
  ai_provider_preference?: 'openrouter' | 'gemini' | 'auto';
  created_at: Date;
  updated_at: Date;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare username: string;
  declare email: CreationOptional<string>;
  declare avatar_url: CreationOptional<string>;
  declare password_hash: CreationOptional<string>;
  declare github_id: CreationOptional<string>;
  declare subscription_tier: CreationOptional<'free' | 'pro'>;
  declare preferred_ai_model: CreationOptional<string>;
  declare ai_provider_preference: CreationOptional<'openrouter' | 'gemini' | 'auto'>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Helper methods
  toPublicJSON(): object {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      avatar_url: this.avatar_url,
      subscription_tier: this.subscription_tier,
      created_at: this.created_at
    };
  }
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      isAlphanumeric: true
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  avatar_url: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  github_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  subscription_tier: {
    type: DataTypes.ENUM('free', 'pro'),
    defaultValue: 'free',
    allowNull: false
  },
  preferred_ai_model: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'openai/gpt-3.5-turbo' // Default to free model
  },
  ai_provider_preference: {
    type: DataTypes.ENUM('openrouter', 'gemini', 'auto'),
    defaultValue: 'auto',
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  underscored: true
});

export default User; 