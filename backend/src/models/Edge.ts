import { DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Project } from './Project.js';
import { Node } from './Node.js';

export type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

export class Edge extends Model<InferAttributes<Edge>, InferCreationAttributes<Edge>> {
  declare id: string; // Client-generated UUID
  declare project_id: ForeignKey<Project['id']>;
  declare source_node_id: ForeignKey<Node['id']>;
  declare target_node_id: ForeignKey<Node['id']>;
  declare source_handle: CreationOptional<HandlePosition>;
  declare target_handle: CreationOptional<HandlePosition>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare project?: Project;
  declare sourceNode?: Node;
  declare targetNode?: Node;
}

Edge.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false // Client-generated ID
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Project,
      key: 'id'
    }
  },
  source_node_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Node,
      key: 'id'
    }
  },
  target_node_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Node,
      key: 'id'
    }
  },
  source_handle: {
    type: DataTypes.ENUM('top', 'bottom', 'left', 'right'),
    allowNull: true
  },
  target_handle: {
    type: DataTypes.ENUM('top', 'bottom', 'left', 'right'),
    allowNull: true
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
  modelName: 'Edge',
  tableName: 'edges',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['project_id']
    },
    {
      fields: ['source_node_id']
    },
    {
      fields: ['target_node_id']
    }
  ]
});

export default Edge; 