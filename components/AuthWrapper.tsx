import React, { useEffect, useState } from 'react';
import { authService, migrationService, type User, type MigrationStatus } from '../services/index.js';

interface AuthWrapperProps {
  children: (authState: AuthState) => React.ReactNode;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  migrationStatus: MigrationStatus | null;
  showMigrationDialog: boolean;
  handleLogin: () => void;
  handleLogout: () => Promise<void>;
  handleMigration: () => Promise<void>;
  dismissMigration: () => void;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState<boolean>(false);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        console.log('🔐 Initializing authentication...');
        
        // Check if user is already authenticated
        if (authService.isAuthenticated()) {
          console.log('🔍 Token found, verifying with server...');
          const userData = await authService.initializeAuth();
          
          if (userData) {
            console.log('✅ Authentication verified:', userData.username);
            setUser(userData);
            setIsAuthenticated(true);
            
            // Check migration status
            const migStatus = migrationService.checkMigrationStatus();
            setMigrationStatus(migStatus);
            
            if (migStatus.needsMigration) {
              console.log('📦 Migration needed - showing dialog');
              setShowMigrationDialog(true);
            }
          } else {
            console.log('❌ Token invalid, clearing auth');
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          console.log('🔍 No authentication token found');
          
          // Check if user has local data but isn't authenticated
          const migStatus = migrationService.checkMigrationStatus();
          setMigrationStatus(migStatus);
          
          if (migStatus.hasLocalData && !migStatus.isAuthenticated) {
            console.log('📦 Local data found but not authenticated');
            setShowMigrationDialog(true);
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
        authService.clearAuth();
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle login
  const handleLogin = () => {
    console.log('🚀 Starting GitHub OAuth login...');
    authService.startGitHubAuth();
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      console.log('👋 Logging out...');
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      setMigrationStatus(null);
      setShowMigrationDialog(false);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      // Clear local state even if server logout fails
      authService.clearAuth();
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  // Handle migration
  const handleMigration = async () => {
    if (!isAuthenticated) {
      console.log('⚠️ Must be authenticated to migrate');
      handleLogin();
      return;
    }

    try {
      console.log('🔄 Starting migration...');
      const result = await migrationService.performMigration();
      
      if (result.success) {
        console.log(`✅ Migration successful: ${result.migratedProjects} projects migrated`);
        
        // Update migration status
        const newStatus = migrationService.checkMigrationStatus();
        setMigrationStatus(newStatus);
        setShowMigrationDialog(false);
        
        // Optional: Clean up localStorage after successful migration
        if (result.migratedProjects > 0) {
          migrationService.cleanupLocalStorage();
        }
      } else {
        console.error('❌ Migration failed:', result.errors);
        // Keep dialog open to retry
      }
    } catch (error) {
      console.error('❌ Migration error:', error);
    }
  };

  // Dismiss migration dialog
  const dismissMigration = () => {
    setShowMigrationDialog(false);
  };

  const authState: AuthState = {
    isAuthenticated,
    user,
    isLoading,
    migrationStatus,
    showMigrationDialog,
    handleLogin,
    handleLogout,
    handleMigration,
    dismissMigration,
  };

  return <>{children(authState)}</>;
};

export default AuthWrapper; 