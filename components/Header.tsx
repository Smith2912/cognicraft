import React, { useState } from 'react';
import { PlusIcon, AppIcon, CogIcon, TrashIcon, UserCircleIcon, GithubIcon } from './icons'; // Added GithubIcon
import { User } from '../types';

// Import AI Model components
import AIModelSelector from './AIModelSelector';

interface HeaderProps {
  onCreateNode: () => void;
  onClearCanvas: () => void;
  onSettingsClick: () => void;
  currentUser: User | null;
  currentProjectName?: string;
  currentProjectRepoUrl?: string; // Added
  currentProjectTeamAvatars?: string[]; // Added
}

const Header: React.FC<HeaderProps> = ({
  onCreateNode,
  onClearCanvas,
  onSettingsClick,
  currentUser,
  currentProjectName,
  currentProjectRepoUrl,
  currentProjectTeamAvatars = [],
}) => {
  const [showAIModelSelector, setShowAIModelSelector] = useState(false);

  const iconButtonClass = "p-2 rounded-md text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-card transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:ring-offset-2 focus:ring-offset-dark-bg";

  return (
    <>
      <header className="bg-dark-bg h-16 flex items-center justify-between px-4 border-b border-dark-border shadow-sm flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0"> {/* Added min-w-0 for shrinking */}
          <AppIcon className="w-8 h-8 text-dark-accent flex-shrink-0" />
          <div className="flex items-center space-x-2 overflow-hidden">
              <h1 className="text-xl font-semibold text-dark-text-primary truncate">
              CogniCraft
              {currentProjectName && <span className="text-dark-text-secondary text-lg"> - {currentProjectName}</span>}
              </h1>
              {currentProjectRepoUrl && (
              <a
                  href={currentProjectRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dark-text-secondary hover:text-dark-accent flex-shrink-0"
                  title="Go to GitHub Repository"
                  aria-label="Go to GitHub Repository"
              >
                  <GithubIcon className="w-4.5 h-4.5" />
              </a>
              )}
          </div>
        </div>

        <div className="flex-1 min-w-0"></div> {/* Spacer */}

        <div className="flex items-center space-x-2 flex-shrink-0">
          {currentProjectTeamAvatars.length > 0 && (
              <div className="flex -space-x-2 items-center mr-2">
                  {currentProjectTeamAvatars.map((avatarUrl, index) => (
                      <img
                          key={index}
                          src={avatarUrl}
                          alt={`Team member ${index + 1}`}
                          className="w-7 h-7 rounded-full border-2 border-dark-surface"
                          style={{ zIndex: currentProjectTeamAvatars.length - index }}
                          title="Simulated team member"
                      />
                  ))}
              </div>
          )}
          <button
              onClick={onClearCanvas}
              className={`${iconButtonClass} flex items-center space-x-1.5 text-sm px-2.5 py-1.5`}
              title="Clear Canvas for Current Project"
          >
              <TrashIcon className="w-4 h-4" />
              <span>Clear</span>
          </button>
          <button
            onClick={() => setShowAIModelSelector(true)}
            className={`${iconButtonClass} flex items-center space-x-2`}
            title="Select AI Model"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6"/>
              <path d="m19.07 4.93-4.24 4.24m0 5.66 4.24 4.24"/>
              <path d="M5.64 5.64l4.24 4.24m5.66 0 4.24-4.24"/>
            </svg>
            <span className="text-sm text-dark-text-secondary">AI Model</span>
          </button>
          <button
            onClick={onCreateNode}
            className="bg-dark-accent hover:bg-dark-accent-hover text-white font-semibold py-1.5 px-3 rounded-md shadow-sm flex items-center text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:ring-offset-2 focus:ring-offset-dark-bg"
            title="Create New Node"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Create
          </button>
          {currentUser && (
            <img
              src={currentUser.avatarUrl}
              alt={`${currentUser.username}'s avatar`}
              className="w-8 h-8 rounded-full ml-1 border-2 border-dark-border"
              title={`Logged in as ${currentUser.username}`}
            />
          )}
        </div>
      </header>

      {/* AI Model Selector Modal */}
      {showAIModelSelector && (
        <AIModelSelector
          isOpen={showAIModelSelector}
          onClose={() => setShowAIModelSelector(false)}
        />
      )}
    </>
  );
};

export default Header;
