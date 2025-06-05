import { DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Project } from './Project.js';

export class ChatMessage extends Model<InferAttributes<ChatMessage>, InferCreationAttributes<ChatMessage>> {
  declare id: CreationOptional<string>;
  declare project_id: ForeignKey<Project['id']>;
  declare text_content: string;
  declare sender_type: 'user' | 'ai';
  declare timestamp: Date;
  declare model: CreationOptional<string | null>;
  declare is_error: CreationOptional<boolean>;
  declare parsed_action: CreationOptional<any | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare project?: Project;
}

ChatMessage.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  text_content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  sender_type: {
    type: DataTypes.ENUM('user', 'ai'),
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  model: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_error: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  parsed_action: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'ChatMessage',
  tableName: 'chat_messages',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['project_id']
    }
  ]
});

export default ChatMessage;