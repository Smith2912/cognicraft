import React, { useState } from 'react';
import { type MigrationStatus } from '../services/index.js';

interface MigrationDialogProps {
  isOpen: boolean;
  migrationStatus: MigrationStatus | null;
  isAuthenticated: boolean;
  onLogin: () => void;
  onMigrate: () => Promise<void>;
  onDismiss: () => void;
}

const MigrationDialog: React.FC<MigrationDialogProps> = ({
  isOpen,
  migrationStatus,
  isAuthenticated,
  onLogin,
  onMigrate,
  onDismiss,
}) => {
  const [isMigrating, setIsMigrating] = useState(false);

  if (!isOpen || !migrationStatus) return null;

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      await onMigrate();
    } finally {
      setIsMigrating(false);
    }
  };

  const getDialogContent = () => {
    if (!migrationStatus.hasLocalData) {
      return {
        title: "Welcome to CogniCraft!",
        message: "You're ready to start planning your projects with cloud sync.",
        primaryAction: null,
        secondaryAction: "Get Started",
      };
    }

    if (!isAuthenticated) {
      return {
        title: "Local Projects Found",
        message: "We found existing projects on your device. Sign in with GitHub to sync them to the cloud and access them anywhere.",
        primaryAction: "Sign In with GitHub",
        secondaryAction: "Continue Offline",
      };
    }

    if (migrationStatus.needsMigration) {
      return {
        title: "Migrate Your Projects",
        message: "We found local projects that can be synced to your account. This will make them available across all your devices.",
        primaryAction: "Migrate Projects",
        secondaryAction: "Skip for Now",
      };
    }

    return {
      title: "Migration Complete!",
      message: "Your projects are now safely stored in the cloud.",
      primaryAction: null,
      secondaryAction: "Continue",
    };
  };

  const content = getDialogContent();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            {migrationStatus.hasLocalData ? (
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            ) : (
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-medium text-white mb-2">
            {content.title}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-300 mb-6">
            {content.message}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {content.primaryAction && (
              <button
                onClick={isAuthenticated ? handleMigrate : onLogin}
                disabled={isMigrating}
                className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isMigrating
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isMigrating ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Migrating...
                  </span>
                ) : (
                  content.primaryAction
                )}
              </button>
            )}

            <button
              onClick={onDismiss}
              className="w-full py-2 px-4 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              {content.secondaryAction}
            </button>
          </div>

          {/* Info text */}
          {migrationStatus.hasLocalData && (
            <p className="text-xs text-gray-400 mt-4">
              Your local data will remain safe during this process.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationDialog; 