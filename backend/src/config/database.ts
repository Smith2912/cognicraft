import { Sequelize } from 'sequelize';
import { config } from './env.js';

const isProduction = config.NODE_ENV === 'production';

// Database configuration
const sequelize = new Sequelize(config.DATABASE_URL!, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: isProduction ? {
      require: true,
      rejectUnauthorized: false // Railway requires this
    } : false
  },
  logging: config.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true, // Use snake_case for auto-generated fields
    freezeTableName: true // Don't pluralize table names
  }
});

export { sequelize };

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    // For development without local PostgreSQL, just log readiness
    if (config.NODE_ENV === 'development' && config.DATABASE_URL.includes('localhost')) {
      console.log('⚠️  Development mode: Skipping database connection');
      console.log('   💡 Install PostgreSQL locally or use Railway for full functionality');
      return;
    }
    
    // Test actual connection for production or real database
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    // Don't throw in development to allow server to start without database
    if (isProduction) {
      throw error;
    } else {
      console.log('⚠️  Continuing without database connection (development mode)');
    }
  }
};

// Sync database (for development)
export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    await sequelize.sync({ force });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Unable to sync database:', error);
    throw error;
  }
}; 