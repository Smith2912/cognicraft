// Models and Associations Setup
import { sequelize } from '../config/database.js';
import User from './User.js';
import Project from './Project.js';
import Node from './Node.js';
import Edge from './Edge.js';
import ChatMessage from './ChatMessage.js';

// Define associations
// User -> Projects (One-to-Many)
User.hasMany(Project, {
  foreignKey: 'owner_user_id',
  as: 'projects'
});

Project.belongsTo(User, {
  foreignKey: 'owner_user_id',
  as: 'owner'
});

// Project -> Nodes (One-to-Many)
Project.hasMany(Node, {
  foreignKey: 'project_id',
  as: 'nodes'
});

Node.belongsTo(Project, {
  foreignKey: 'project_id',
  as: 'project'
});

// Project -> Edges (One-to-Many)
Project.hasMany(Edge, {
  foreignKey: 'project_id',
  as: 'edges'
});

Edge.belongsTo(Project, {
  foreignKey: 'project_id',
  as: 'project'
});

// Node -> Edges (source and target)
Node.hasMany(Edge, {
  foreignKey: 'source_node_id',
  as: 'outgoingEdges'
});

Node.hasMany(Edge, {
  foreignKey: 'target_node_id',
  as: 'incomingEdges'
});

Edge.belongsTo(Node, {
  foreignKey: 'source_node_id',
  as: 'sourceNode'
});

Edge.belongsTo(Node, {
  foreignKey: 'target_node_id',
  as: 'targetNode'
});

// Project -> ChatMessages (One-to-Many)
Project.hasMany(ChatMessage, {
  foreignKey: 'project_id',
  as: 'chatMessages'
});

ChatMessage.belongsTo(Project, {
  foreignKey: 'project_id',
  as: 'project'
});

// Export all models
export {
  sequelize,
  User,
  Project,
  Node,
  Edge,
  ChatMessage
};

// Sync database function
export const syncModels = async (force: boolean = false): Promise<void> => {
  try {
    await sequelize.sync({ force });
    console.log('✅ All models synchronized successfully');
  } catch (error) {
    console.error('❌ Error synchronizing models:', error);
    throw error;
  }
};

export default {
  sequelize,
  User,
  Project,
  Node,
  Edge,
  ChatMessage,
  syncModels
}; 