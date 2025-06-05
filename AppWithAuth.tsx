import React from 'react';
import App from './App.js';
import AuthWrapper, { type AuthState } from './components/AuthWrapper.js';
import MigrationDialog from './components/MigrationDialog.js';

const AppWithAuth: React.FC = () => {
  return (
    <AuthWrapper>
      {(authState: AuthState) => (
        <>
          {/* Loading State */}
          {authState.isLoading && (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-white mb-2">Loading CogniCraft</h2>
                <p className="text-gray-400">Initializing your planning workspace...</p>
              </div>
            </div>
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