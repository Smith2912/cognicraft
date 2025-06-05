import { DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Project } from './Project.js';

export enum NodeStatus {
  ToDo = 'To Do',
  InProgress = 'In Progress',
  Done = 'Done',
  Blocked = 'Blocked',
}

export class Node extends Model<InferAttributes<Node>, InferCreationAttributes<Node>> {
  declare id: string; // Client-generated UUID
  declare project_id: ForeignKey<Project['id']>;
  declare title: string;
  declare description: CreationOptional<string>;
  declare status: NodeStatus;
  declare x_position: number;
  declare y_position: number;
  declare width: CreationOptional<number>;
  declare height: CreationOptional<number>;
  declare icon_id: CreationOptional<string>;
  declare github_issue_url: CreationOptional<string>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare project?: Project;
}

Node.init({
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
  title: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 1000]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(...Object.values(NodeStatus)),
    allowNull: false,
    defaultValue: NodeStatus.ToDo
  },
  x_position: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  y_position: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 200
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 150
  },
  icon_id: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'github'
  },
  github_issue_url: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true
    }
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
  modelName: 'Node',
  tableName: 'nodes',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['project_id']
    }
  ]
});

export default Node; 