import { DataTypes, Model, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';
import { sequelize } from '../config/database.js';
import { User } from './User.js';

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare owner_user_id: ForeignKey<User['id']>;
  declare github_repo_url: CreationOptional<string>;
  declare team_member_usernames: CreationOptional<string[]>;
  declare team_members: CreationOptional<Array<{ username: string; role: 'editor' | 'viewer' }>>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  // Associations
  declare owner?: User;
}

Project.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 255],
      notEmpty: true
    }
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  github_repo_url: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  team_member_usernames: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  team_members: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
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
  modelName: 'Project',
  tableName: 'projects',
  timestamps: true,
  underscored: true
});

export default Project; 