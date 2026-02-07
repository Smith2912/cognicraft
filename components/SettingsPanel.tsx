
import React, { useEffect, useState, useCallback } from 'react';
import { 
  PlusIcon, LoginIcon, LogoutIcon, GithubIcon, TrashIcon, 
  ShareIcon as SwitchIcon, CogIcon as EditIcon, UserCircleIcon,
  FolderIcon, CreditCardIcon, ArrowDownTrayIcon, PaintBrushIcon, AcademicCapIcon,
  ProIcon, DocumentTextIcon, CheckIcon // Added CheckIcon
} from './icons'; 
import { User, Project } from '../types'; 

interface EditableProjectDetails {
  name: string;
  githubRepoUrl: string;
  teamMemberUsernames: string; // Comma-separated string for input (legacy)
}

interface EditableTeamMember {
  username: string;
  role: 'editor' | 'viewer';
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLogin: (username: string) => void;
  onLogout: () => void;
  projects: Project[]; 
  currentProjectId: string | null; 
  onCreateProject: (projectName: string) => void; 
  onSwitchProject: (projectId: string) => void; 
  onDeleteProject: (projectId: string) => void; 
  onUpdateProjectDetails: (projectId: string, updates: Partial<Pick<Project, 'name' | 'githubRepoUrl' | 'teamMemberUsernames' | 'teamMembers'>>) => void;
  onExportMarkdown: () => void; 
  currentNodesCount: number; 
  currentProjectId: string | null;
  recentOpenclawActions: Array<{ action: string; payload?: any; timestamp: number }>;
  requireAiApproval: boolean;
  onToggleAiApproval: (value: boolean) => void;
  pendingAiActions: Array<{ id: string; projectId: string; actions: Array<{ action: string; title?: string; parentNodeTitle?: string; subtasks?: Array<{ title: string }> }> }>;
  onApplyPendingAiAction: (pendingId: string) => void;
}

interface SettingsSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, icon, children }) => (
  <div className="bg-dark-card p-4 rounded-lg border border-dark-border shadow-sm">
    <div className="flex items-center text-dark-text-secondary mb-3">
      {icon}
      <h3 className="text-md font-semibold ml-2">{title}</h3>
    </div>
    <div className="space-y-3">
      {children}
    </div>
  </div>
);


const SettingsPanel = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  onLogin, 
  onLogout,
  projects,
  currentProjectId,
  onCreateProject,
  onSwitchProject,
  onDeleteProject,
  onUpdateProjectDetails,
  onExportMarkdown,
  currentNodesCount,
  recentOpenclawActions,
  requireAiApproval,
  onToggleAiApproval,
  pendingAiActions,
  onApplyPendingAiAction,
}: SettingsPanelProps): JSX.Element | null => {
  const [githubUsername, setGithubUsername] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editableProjectData, setEditableProjectData] = useState<EditableProjectDetails>({ name: '', githubRepoUrl: '', teamMemberUsernames: '' });
  const [editableTeamMembers, setEditableTeamMembers] = useState<EditableTeamMember[]>([]);

  useEffect(() => {
    const styleId = 'settings-panel-animation-style';
    if (!document.getElementById(styleId) && isOpen) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.innerHTML = `
        @keyframes fadeInScaleUp {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-fadeInScaleUp {
          animation: fadeInScaleUp 0.3s forwards cubic-bezier(0.165, 0.84, 0.44, 1);
        }
      `;
      document.head.appendChild(styleElement);
    }
  }, [isOpen]);

  const handleLoginClick = () => {
    if (githubUsername.trim()) {
      onLogin(githubUsername.trim());
      setGithubUsername(''); 
    }
  };
  
  const handleUsernameKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLoginClick();
    }
  };

  const handleCreateProjectClick = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
    }
  };

  const handleNewProjectNameKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleCreateProjectClick();
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditableProjectData({
      name: project.name,
      githubRepoUrl: project.githubRepoUrl || '',
      teamMemberUsernames: (project.teamMemberUsernames || []).join(', ')
    });

    const members = project.teamMembers?.length
      ? project.teamMembers
      : (project.teamMemberUsernames || []).map(username => ({ username, role: 'editor' as const }));
    setEditableTeamMembers(members);
  };

  const handleSaveProjectDetails = () => {
    if (!editingProjectId) return;
    const usernamesArray = editableProjectData.teamMemberUsernames.split(',')
      .map(u => u.trim()).filter(u => u);

    const normalizedMembers = editableTeamMembers.length
      ? editableTeamMembers.map(member => ({
          username: member.username.trim(),
          role: member.role
        })).filter(member => member.username)
      : usernamesArray.map(username => ({ username, role: 'editor' as const }));
    
    onUpdateProjectDetails(editingProjectId, {
      name: editableProjectData.name.trim() || "Untitled Project", 
      githubRepoUrl: editableProjectData.githubRepoUrl.trim(),
      teamMemberUsernames: normalizedMembers.map(member => member.username),
      teamMembers: normalizedMembers,
    });
    setEditingProjectId(null);
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
  };

  const handleAddTeamMember = () => {
    setEditableTeamMembers(prev => [...prev, { username: '', role: 'editor' }]);
  };

  const handleTeamMemberChange = (index: number, field: 'username' | 'role', value: string) => {
    setEditableTeamMembers(prev => prev.map((member, idx) => (
      idx === index ? { ...member, [field]: value } : member
    )));
  };

  const handleRemoveTeamMember = (index: number) => {
    setEditableTeamMembers(prev => prev.filter((_, idx) => idx !== index));
  };
  
  const handleEditableInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditableProjectData(prev => ({ ...prev, [name]: value }));
  };


  if (!isOpen) {
    return null;
  }
  
  const proBenefits = [
    "Unlimited Projects & Canvases",
    "Advanced AI Capabilities & Higher Usage Limits",
    "Expanded Version History & Recovery Options",
    "Priority Email Support",
    "Exclusive Pro Node Templates & Icons",
    "Advanced Team Collaboration Features",
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 transition-opacity duration-300 ease-in-out"
      onClick={onClose} 
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-panel-title"
    >
      <div 
        className="bg-dark-surface text-dark-text-primary p-6 rounded-xl shadow-2xl w-full max-w-xl mx-4 transform scale-95 opacity-0 animate-fadeInScaleUp overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-dark-border">
          <h2 id="settings-panel-title" className="text-2xl font-semibold">Application Settings</h2>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-card transition-colors"
            aria-label="Close settings panel"
          >
            <PlusIcon className="w-6 h-6 transform rotate-45" />
          </button>
        </div>
        
        <div className="space-y-6">
          <SettingsSection title="AI Safety" icon={<AcademicCapIcon className="w-5 h-5" />}>
            <label className="flex items-center justify-between text-sm">
              <span>Require approval before applying AI actions</span>
              <input
                type="checkbox"
                checked={requireAiApproval}
                onChange={(e) => onToggleAiApproval(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            {requireAiApproval && pendingAiActions.length > 0 && (
              <div className="text-xs text-dark-text-secondary space-y-2">
                <div className="font-semibold text-dark-text-primary">Pending AI actions</div>
                {pendingAiActions.map(item => (
                  <div key={item.id} className="p-2 bg-dark-surface rounded-md border border-dark-border">
                    <div className="text-dark-text-primary">{item.actions.length} action(s)</div>
                    <button
                      type="button"
                      onClick={() => onApplyPendingAiAction(item.id)}
                      className="text-xs mt-1 px-2 py-1 rounded-md bg-dark-accent hover:bg-dark-accent-hover text-white"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>
          {/* Account Section */}
          <SettingsSection title="Account" icon={<UserCircleIcon className="w-5 h-5" />}>
            {currentUser ? (
              <div className="flex items-center justify-between p-3 bg-dark-surface rounded-md ">
                <div className="flex items-center space-x-3">
                  <img src={currentUser.avatarUrl} alt={currentUser.username} className="w-10 h-10 rounded-full border-2 border-dark-accent" />
                  <div>
                    <p className="text-sm font-medium">{currentUser.username}</p>
                    <p className="text-xs text-dark-text-secondary">Logged in with GitHub (Simulated)</p>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-1.5 text-sm text-red-400 hover:text-red-300 bg-red-900/30 hover:bg-red-800/50 px-3 py-1.5 rounded-md transition-colors"
                >
                  <LogoutIcon className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-dark-text-secondary">Connect your GitHub account (simulated).</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    onKeyPress={handleUsernameKeyPress}
                    placeholder="GitHub Username"
                    className="flex-grow p-2 bg-dark-surface border border-dark-border rounded-md shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm"
                    aria-label="GitHub username for login"
                  />
                  <button
                    onClick={handleLoginClick}
                    disabled={!githubUsername.trim()}
                    className="flex items-center space-x-1.5 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-md shadow-sm text-sm transition-colors disabled:opacity-50"
                  >
                    <GithubIcon className="w-4 h-4" />
                    <span>Login</span>
                  </button>
                </div>
                <p className="text-xs text-dark-text-secondary/70">This is a simulated login. No real authentication occurs.</p>
              </>
            )}
          </SettingsSection>

          {/* Projects Section */}
          <SettingsSection title="Projects" icon={<FolderIcon className="w-5 h-5" />}>
            <div className="flex items-center justify-between p-2 bg-dark-surface rounded-md border border-dark-border mb-3">
              <div>
                <div className="text-xs text-dark-text-secondary">Current Project ID</div>
                <div className="text-sm font-mono text-dark-text-primary break-all">
                  {currentProjectId || 'No project selected'}
                </div>
              </div>
              {currentProjectId && (
                <button
                  onClick={() => navigator.clipboard.writeText(currentProjectId)}
                  className="text-xs px-2 py-1 rounded-md bg-dark-card hover:bg-dark-border text-dark-text-secondary"
                >
                  Copy
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyPress={handleNewProjectNameKeyPress}
                placeholder="New project name..."
                className="flex-grow p-2 bg-dark-surface border border-dark-border rounded-md shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm"
                aria-label="New project name"
              />
              <button
                onClick={handleCreateProjectClick}
                disabled={!newProjectName.trim()}
                className="flex items-center space-x-1.5 bg-dark-accent hover:bg-dark-accent-hover text-white font-medium py-2 px-3 rounded-md shadow-sm text-sm transition-colors disabled:opacity-50"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Create</span>
              </button>
            </div>
            {projects.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {projects.map(project => (
                  <div key={project.id} className={`p-3 rounded-md border ${project.id === currentProjectId ? 'bg-dark-accent/10 border-dark-accent' : 'bg-dark-surface border-dark-border hover:border-dark-card/70'}`}>
                    {editingProjectId === project.id ? (
                      <div className="space-y-2 text-sm">
                        <div>
                          <label className="text-xs text-dark-text-secondary block mb-0.5">Project Name</label>
                          <input type="text" name="name" value={editableProjectData.name} onChange={handleEditableInputChange} className="w-full p-1.5 bg-dark-card border-dark-border rounded-md text-sm"/>
                        </div>
                        <div>
                          <label className="text-xs text-dark-text-secondary block mb-0.5">GitHub Repo URL (Optional)</label>
                          <input type="text" name="githubRepoUrl" value={editableProjectData.githubRepoUrl} onChange={handleEditableInputChange} placeholder="https://github.com/user/repo" className="w-full p-1.5 bg-dark-card border-dark-border rounded-md text-sm"/>
                        </div>
                        <div>
                          <label className="text-xs text-dark-text-secondary block mb-0.5">Team Members</label>
                          <div className="space-y-2">
                            {editableTeamMembers.map((member, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={member.username}
                                  onChange={(e) => handleTeamMemberChange(index, 'username', e.target.value)}
                                  placeholder="GitHub username"
                                  className="flex-1 p-1.5 bg-dark-card border-dark-border rounded-md text-sm"
                                />
                                <select
                                  value={member.role}
                                  onChange={(e) => handleTeamMemberChange(index, 'role', e.target.value)}
                                  className="p-1.5 bg-dark-card border-dark-border rounded-md text-sm"
                                >
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeamMember(index)}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={handleAddTeamMember}
                              className="text-xs text-dark-text-secondary hover:text-dark-text-primary"
                            >
                              + Add team member
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-2">
                          <button onClick={handleCancelEdit} className="text-xs px-3 py-1 rounded-md bg-dark-border hover:bg-dark-card/80">Cancel</button>
                          <button onClick={handleSaveProjectDetails} className="text-xs px-3 py-1 rounded-md bg-dark-accent hover:bg-dark-accent-hover text-white">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="overflow-hidden mr-2">
                          <div className="flex items-center">
                              <span className={`text-sm font-medium mr-2 truncate ${project.id === currentProjectId ? 'text-dark-accent-hover' : ''}`}>{project.name}</span>
                              {project.githubRepoUrl && (
                                  <a href={project.githubRepoUrl} target="_blank" rel="noopener noreferrer" title={project.githubRepoUrl} className="text-dark-text-secondary hover:text-dark-accent flex-shrink-0">
                                      <GithubIcon className="w-3.5 h-3.5"/>
                                  </a>
                              )}
                          </div>
                          {((project.teamMembers && project.teamMembers.length > 0) || (project.teamMemberUsernames && project.teamMemberUsernames.length > 0)) && (
                              <div className="flex flex-col space-y-1 mt-1.5">
                                  <div className="flex space-x-1">
                                    {(project.teamMembers?.length ? project.teamMembers.map(member => member.username) : (project.teamMemberUsernames || [])).slice(0, 5).map(username => (
                                        <img key={username} src={`https://github.com/${username.trim()}.png`} alt={username} title={username} className="w-4 h-4 rounded-full border border-dark-card"/>
                                    ))}
                                    {(project.teamMembers?.length ? project.teamMembers.length : (project.teamMemberUsernames?.length || 0)) > 5 && (
                                      <span className="text-xs text-dark-text-secondary/70 self-center">+
                                        {(project.teamMembers?.length ? project.teamMembers.length : (project.teamMemberUsernames?.length || 0)) - 5}
                                      </span>
                                    )}
                                  </div>
                                  {project.teamMembers && project.teamMembers.length > 0 && (
                                    <div className="text-xs text-dark-text-secondary">
                                      {project.teamMembers.slice(0, 3).map(member => `${member.username} (${member.role})`).join(', ')}
                                      {project.teamMembers.length > 3 && ` +${project.teamMembers.length - 3} more`}
                                    </div>
                                  )}
                              </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {project.id !== currentProjectId && (
                            <button 
                              onClick={() => onSwitchProject(project.id)} 
                              className="p-1.5 text-blue-400 hover:text-blue-300 rounded-md hover:bg-blue-500/20"
                              title="Switch to this project" aria-label="Switch to this project"
                            > <SwitchIcon className="w-4 h-4" /> </button>
                          )}
                           <button onClick={() => handleEditProject(project)} className="p-1.5 text-gray-400 hover:text-gray-200 rounded-md hover:bg-gray-500/20" title="Edit project details" aria-label="Edit project details">
                              <EditIcon className="w-4 h-4" />
                           </button>
                          <button 
                            onClick={() => onDeleteProject(project.id)} 
                            className="p-1.5 text-red-400 hover:text-red-300 rounded-md hover:bg-red-500/20"
                            title="Delete project" aria-label="Delete project"
                            disabled={projects.length <= 1 && project.id === currentProjectId} 
                          > <TrashIcon className="w-4 h-4" /> </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-dark-text-secondary/70 text-center py-1">No projects yet. Create one above.</p>
            )}
          </SettingsSection>

          {/* Subscription Section */}
          <SettingsSection title="Subscription" icon={<CreditCardIcon className="w-5 h-5" />}>
            <div className="text-center mb-4">
                <p className="text-sm text-dark-text-primary mb-1">
                    Current Plan: <span className="font-semibold text-sky-400">CogniCraft Free</span>
                </p>
                <p className="text-xs text-dark-text-secondary mb-3">
                    You are currently on the free plan. Upgrade to CogniCraft Pro for powerful enhancements!
                </p>
                <button
                    disabled 
                    className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-md shadow-lg text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    title="CogniCraft Pro - Coming Soon!"
                >
                    <ProIcon className="w-4 h-4" />
                    <span>Upgrade to Pro (Coming Soon)</span>
                </button>
            </div>
            <div className="mt-1 text-left">
                <p className="text-xs font-medium text-dark-text-secondary mb-2">CogniCraft Pro will include features like:</p>
                <ul className="space-y-1.5">
                    {proBenefits.map((benefit, index) => (
                        <li key={index} className="flex items-start text-xs text-dark-text-primary">
                            <CheckIcon className="w-3.5 h-3.5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{benefit}</span>
                        </li>
                    ))}
                </ul>
            </div>
          </SettingsSection>
          
          <SettingsSection title="OpenClaw Actions" icon={<AcademicCapIcon className="w-5 h-5" />}>
            {recentOpenclawActions.length === 0 ? (
              <p className="text-sm text-dark-text-secondary">No recent OpenClaw actions.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
                {recentOpenclawActions.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="p-2 bg-dark-surface rounded-md border border-dark-border">
                    <div className="text-dark-text-primary font-semibold">{entry.action}</div>
                    <div className="text-dark-text-secondary">
                      {new Date(entry.timestamp).toLocaleTimeString()} — {entry.payload?.title || entry.payload?.parentNodeTitle || ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="Data Management" icon={<ArrowDownTrayIcon className="w-5 h-5" />}>
            <button
              onClick={onExportMarkdown}
              disabled={!currentProjectId || currentNodesCount === 0}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm text-sm transition-colors disabled:opacity-50"
              title={!currentProjectId || currentNodesCount === 0 ? "Create some nodes in a project to export" : "Export plan as Markdown"}
            >
              <DocumentTextIcon className="w-4 h-4" /> 
              <span>Export Plan as Markdown</span>
            </button>
            <p className="text-xs text-dark-text-secondary/70 text-center">
                Import Plan Data - <span className="italic">Coming Soon</span>
            </p>
          </SettingsSection>

          <SettingsSection title="Appearance" icon={<PaintBrushIcon className="w-5 h-5" />}>
            <p className="text-sm text-dark-text-secondary">Theme (Dark/Light) - <span className="italic">Coming Soon</span></p>
          </SettingsSection>
          
          <SettingsSection title="AI Configuration" icon={<AcademicCapIcon className="w-5 h-5" />}>
            <p className="text-sm text-dark-text-secondary">API Key Management - <span className="italic">Handled by environment variable</span></p>
            <p className="text-sm text-dark-text-secondary">Model Preferences - <span className="italic">Coming Soon</span></p>
          </SettingsSection>
        </div>

        <div className="mt-8 text-center border-t border-dark-border pt-6">
            <button
                onClick={onClose}
                className="bg-dark-accent hover:bg-dark-accent-hover text-white font-semibold py-2.5 px-8 rounded-lg shadow-md text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:ring-offset-2 focus:ring-offset-dark-surface"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
