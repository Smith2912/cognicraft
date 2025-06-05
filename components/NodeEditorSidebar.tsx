
import React, { useState, useEffect, useCallback } from 'react';
import { NodeData, NodeStatus } from '../types';
import { generateText } from '../services/geminiService';
import { DEFAULT_NODE_DESCRIPTION_PROMPT, DEFAULT_SUBTASK_PROMPT } from '../constants';
import { SparklesIcon, TrashIcon, PlusIcon, ICON_MAP, LinkIcon } from './icons';

interface NodeEditorSidebarProps {
  node: NodeData | null;
  onUpdateNode: (updatedNode: NodeData) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddSubtaskNode: (parentNodeId: string, subtaskTitle: string) => void;
  currentProjectGitHubRepoUrl?: string; // Added prop
}

const PREDEFINED_TAGS = [
  // Software Dev
  "Frontend", "Backend", "API", "Database", "UI/UX", "Test",
  "Bugfix", "Feature", "Refactor", "Documentation", "DevOps", "Mobile",
  // Game Dev
  "Game Design", "Level Design", "3D Modeling", "Animation", "Sound Design", 
  "Game Logic", "Physics", "Rendering", "Quest Design", "UI (Game)", "Networking (Game)",
  "Shader Dev", "VFX", "Prototyping",
  // Mod Dev
  "Scripting (Mod)", "Modding Tools", "Asset Creation (Mod)", "Reverse Engineering",
  "Patching", "Compatibility (Mod)", "Localization (Mod)", "Testing (Mod)",
  // General
  "Research", "Optimization"
];


const NodeEditorSidebar = ({ node, onUpdateNode, onDeleteNode, onAddSubtaskNode, currentProjectGitHubRepoUrl }: NodeEditorSidebarProps): JSX.Element | null => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<NodeStatus>(NodeStatus.ToDo);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTagInput, setCurrentTagInput] = useState('');
  const [selectedIconId, setSelectedIconId] = useState<string>('default');
  const [githubIssueUrl, setGithubIssueUrl] = useState<string>(''); // New state for GitHub Issue URL
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false);

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setDescription(node.description);
      setStatus(node.status);
      setTags(node.tags || []);
      setSelectedIconId(node.iconId || 'default');
      setGithubIssueUrl(node.githubIssueUrl || ''); // Populate GitHub Issue URL
      setCurrentTagInput('');
    }
  }, [node]);

  const handleSave = useCallback(() => {
    if (node) {
      onUpdateNode({ ...node, title, description, status, tags, iconId: selectedIconId, githubIssueUrl: githubIssueUrl.trim() });
    }
  }, [node, title, description, status, tags, selectedIconId, githubIssueUrl, onUpdateNode]);

  const handleIconChange = (iconId: string) => {
    setSelectedIconId(iconId);
    if (node) {
      // Use current state values for title, description etc. as they might have been edited
      // but not yet blurred to trigger handleSave.
      onUpdateNode({ ...node, title, description, status, tags, iconId: iconId, githubIssueUrl: githubIssueUrl.trim() });
    }
  };

  const handleAddOrRemovePredefinedTag = (tagToAddOrRemove: string) => {
    let updatedTags;
    if (tags.includes(tagToAddOrRemove)) {
      updatedTags = tags.filter(tag => tag !== tagToAddOrRemove);
    } else {
      updatedTags = [...tags, tagToAddOrRemove];
    }
    setTags(updatedTags);
    if (node) {
      onUpdateNode({ ...node, title, description, status, iconId: selectedIconId, tags: updatedTags, githubIssueUrl: githubIssueUrl.trim() });
    }
  };

  const handleAddTag = () => {
    const newTag = currentTagInput.trim();
    if (newTag && !tags.includes(newTag)) {
      const updatedTags = [...tags, newTag];
      setTags(updatedTags);
      setCurrentTagInput('');
      if (node) {
        onUpdateNode({ ...node, title, description, status, iconId: selectedIconId, tags: updatedTags, githubIssueUrl: githubIssueUrl.trim() });
      }
    } else if (!newTag) {
        setCurrentTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    if (node) {
      onUpdateNode({ ...node, title, description, status, iconId: selectedIconId, tags: updatedTags, githubIssueUrl: githubIssueUrl.trim() });
    }
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleGenerateDescription = async () => {
    if (!node || !title) return;
    setIsLoadingDescription(true);
    const prompt = DEFAULT_NODE_DESCRIPTION_PROMPT(title);
    try {
      const generatedDesc = await generateText(prompt);
      if (!generatedDesc.startsWith("Error:")) {
        setDescription(generatedDesc);
        // Pass the currently edited title, new description, and other current states
        onUpdateNode({ ...node, title, description: generatedDesc, status, tags, iconId: selectedIconId, githubIssueUrl: githubIssueUrl.trim() });
      } else {
        console.error(generatedDesc);
        alert(generatedDesc);
      }
    } catch (error) {
      console.error("Failed to generate description:", error);
      alert("Failed to generate description. See console for details.");
    } finally {
      setIsLoadingDescription(false);
    }
  };
  
  const handleGenerateSubtasks = async () => {
    if (!node || !title) return;
    setIsLoadingSubtasks(true);
    const prompt = DEFAULT_SUBTASK_PROMPT(title, description);
    try {
      const generatedSubtasksText = await generateText(prompt);
      if (!generatedSubtasksText.startsWith("Error:")) {
        const subtaskTitles = generatedSubtasksText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        subtaskTitles.forEach(subTitle => {
          onAddSubtaskNode(node.id, subTitle); 
        });
      } else {
        console.error(generatedSubtasksText);
        alert(generatedSubtasksText);
      }
    } catch (error) {
      console.error("Failed to generate subtasks:", error);
      alert("Failed to generate subtasks. See console for details.");
    } finally {
      setIsLoadingSubtasks(false);
    }
  };

  const handleCreateGitHubIssue = () => {
    if (!node || !currentProjectGitHubRepoUrl || !node.title) return;
    
    const repoUrl = currentProjectGitHubRepoUrl.endsWith('/') 
      ? currentProjectGitHubRepoUrl 
      : currentProjectGitHubRepoUrl + '/';

    const issueTitle = encodeURIComponent(node.title);
    const issueBody = encodeURIComponent(node.description || `Task details for: ${node.title}`);
    const newIssueUrl = `${repoUrl}issues/new?title=${issueTitle}&body=${issueBody}`;
    window.open(newIssueUrl, '_blank');
  };


  if (!node) {
    return (
      <aside className="bg-dark-surface p-6 h-full flex flex-col items-center justify-center text-dark-text-secondary shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 opacity-30 mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-center text-sm">Select a node to view or edit its details.</p>
      </aside>
    );
  }

  const isValidGitHubIssueUrl = githubIssueUrl.trim().startsWith('https://github.com/') && githubIssueUrl.includes('/issues/');

  return (
    <aside className="bg-dark-surface p-6 h-full overflow-y-auto flex flex-col shadow-lg text-dark-text-primary">
      <div className="flex-grow">
        <h3 className="text-xl font-semibold mb-5">Edit Node</h3>
        
        <div className="mb-4">
          <label htmlFor="node-title" className="block text-sm font-medium text-dark-text-secondary mb-1">Title</label>
          <input
            type="text"
            id="node-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full p-2.5 bg-dark-card border border-dark-border rounded-md shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="node-description" className="block text-sm font-medium text-dark-text-secondary mb-1">Description</label>
          <textarea
            id="node-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            rows={5}
            className="w-full p-2.5 bg-dark-card border border-dark-border rounded-md shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm"
          />
          <button
            onClick={handleGenerateDescription}
            disabled={isLoadingDescription || !title}
            className="mt-2 w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-surface focus:ring-blue-500 disabled:opacity-60 transition-colors duration-150"
          >
            <SparklesIcon className="w-4 h-4 mr-2" />
            {isLoadingDescription ? 'Generating...' : 'AI Suggest Description'}
          </button>
        </div>

        <div className="mb-4">
          <label htmlFor="node-status" className="block text-sm font-medium text-dark-text-secondary mb-1">Status</label>
          <select
            id="node-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as NodeStatus)}
            onBlur={handleSave}
            className="w-full p-2.5 bg-dark-card border border-dark-border rounded-md shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm"
          >
            {Object.values(NodeStatus).map(s => (
              <option key={s} value={s} className="bg-dark-card text-dark-text-primary">{s}</option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-text-secondary mb-1">Icon</label>
          <div className="grid grid-cols-5 gap-2 p-2 bg-dark-card border border-dark-border rounded-md">
            {Object.entries(ICON_MAP).filter(([key]) => key !== 'default').map(([key, IconComponent]) => (
              <button
                key={key}
                onClick={() => handleIconChange(key)}
                className={`p-2 rounded-md flex items-center justify-center transition-colors duration-150 ${selectedIconId === key 
                              ? 'bg-dark-accent text-white ring-2 ring-dark-accent-hover ring-offset-1 ring-offset-dark-card' 
                              : 'bg-dark-surface hover:bg-dark-border text-dark-text-secondary hover:text-dark-text-primary'}`}
                title={`Select ${key} icon`}
                aria-pressed={selectedIconId === key}
              >
                <IconComponent className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4"> {/* GitHub Issue Section */}
          <label htmlFor="node-github-issue" className="block text-sm font-medium text-dark-text-secondary mb-1">GitHub Issue URL</label>
          <input
            type="url"
            id="node-github-issue"
            value={githubIssueUrl}
            onChange={(e) => setGithubIssueUrl(e.target.value)}
            onBlur={handleSave}
            placeholder="https://github.com/user/repo/issues/123"
            className="w-full p-2.5 bg-dark-card border border-dark-border rounded-md shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm mb-1"
          />
          {isValidGitHubIssueUrl && (
            <a 
              href={githubIssueUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline break-all"
            >
              {githubIssueUrl}
            </a>
          )}
          <button
            onClick={handleCreateGitHubIssue}
            disabled={!currentProjectGitHubRepoUrl || !node.title}
            className="mt-2 w-full flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-dark-text-primary bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-surface focus:ring-gray-500 disabled:opacity-60 transition-colors duration-150"
            title={!currentProjectGitHubRepoUrl ? "Link project to a GitHub repo in Settings first" : !node.title ? "Node needs a title to create an issue" : "Create Issue on GitHub"}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Issue on GitHub
          </button>
        </div>


        <div className="mb-6">
          <label htmlFor="node-tags-input" className="block text-sm font-medium text-dark-text-secondary mb-1">Tags</label>
          
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PREDEFINED_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => handleAddOrRemovePredefinedTag(tag)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors duration-150 ${tags.includes(tag) 
                                ? 'bg-dark-accent text-white border-dark-accent-hover' 
                                : 'bg-dark-card hover:bg-dark-border text-dark-text-secondary hover:text-dark-text-primary border-dark-border'}`}
              >
                {tag}
              </button>
            ))}
          </div>
          
          <div className="flex items-center mb-2">
            <input
              type="text"
              id="node-tags-input"
              value={currentTagInput}
              onChange={(e) => setCurrentTagInput(e.target.value)}
              onKeyPress={handleTagInputKeyPress}
              onBlur={handleAddTag} 
              placeholder="Add a custom tag..."
              className="flex-grow p-2.5 bg-dark-card border border-dark-border rounded-l-md shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm"
            />
            <button
              onClick={handleAddTag}
              className="p-2.5 bg-dark-accent text-white rounded-r-md hover:bg-dark-accent-hover focus:outline-none focus:ring-2 focus:ring-dark-accent focus:ring-offset-1 focus:ring-offset-dark-surface text-sm font-medium"
              aria-label="Add custom tag"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="flex items-center bg-sky-700 text-sky-100 text-xs font-medium px-2.5 py-1 rounded-full">
                {tag}
                <button 
                  onClick={() => handleRemoveTag(tag)} 
                  className="ml-1.5 text-sky-300 hover:text-sky-100 focus:outline-none"
                  aria-label={`Remove tag ${tag}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-auto space-y-3 pt-4 border-t border-dark-border flex-shrink-0">
         <button
          onClick={handleGenerateSubtasks}
          disabled={isLoadingSubtasks || !title}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-surface focus:ring-green-500 disabled:opacity-60 transition-colors duration-150"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          {isLoadingSubtasks ? 'Generating...' : 'AI Suggest Subtasks'}
        </button>
        <button
          onClick={() => onDeleteNode(node.id)}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-surface focus:ring-red-500 transition-colors duration-150"
        >
          <TrashIcon className="w-4 h-4 mr-2" />
          Delete Node
        </button>
      </div>
    </aside>
  );
};

export default NodeEditorSidebar;