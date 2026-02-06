import React from 'react';
import App from './App.js';
import AuthWrapper, { type AuthState } from './components/AuthWrapper.js';
import MigrationDialog from './components/MigrationDialog.js';
import LoadingScreen from './components/layout/LoadingScreen.js';

const AppWithAuth: React.FC = () => {
  return (
    <AuthWrapper>
      {(authState: AuthState) => (
        <>
          {/* Loading State */}
          {authState.isLoading && (
            <LoadingScreen />
          )}

          {/* Migration Dialog */}
          <MigrationDialog
            isOpen={authState.showMigrationDialog}
            migrationStatus={authState.migrationStatus}
            isAuthenticated={authState.isAuthenticated}
            onLogin={authState.handleLogin}
            onMigrate={authState.handleMigration}
            onDismiss={authState.dismissMigration}
          />

          {/* Main App (only render when not loading) */}
          {!authState.isLoading && (
            <App />
          )}
        </>
      )}
    </AuthWrapper>
  );
};

export default AppWithAuth; 