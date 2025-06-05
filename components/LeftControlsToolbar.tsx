
import React from 'react';
import { GridIcon, MaximizeIcon, ZoomInIcon, ZoomOutIcon, UndoIcon, RedoIcon, SquaresPlusIcon } from './icons'; // Added SquaresPlusIcon

interface LeftControlsToolbarProps {
  onToggleGrid: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAutoLayoutNodes: () => void; // New prop
  nodesCount: number; // New prop
}

const LeftControlsToolbar: React.FC<LeftControlsToolbarProps> = ({
  onToggleGrid,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAutoLayoutNodes, // New prop
  nodesCount, // New prop
}) => {
  const iconButtonClass = "p-2.5 rounded-md text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-card transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <aside className="bg-dark-bg p-2 border-r border-dark-border flex flex-col items-center space-y-3 shadow-md">
      <button onClick={onToggleGrid} className={iconButtonClass} title="Toggle Grid">
        <GridIcon className="w-5 h-5" />
      </button>
      <button onClick={onZoomIn} className={iconButtonClass} title="Zoom In">
        <ZoomInIcon className="w-5 h-5" />
      </button>
      <button onClick={onZoomOut} className={iconButtonClass} title="Zoom Out">
        <ZoomOutIcon className="w-5 h-5" />
      </button>
      <button onClick={onFitToScreen} className={iconButtonClass} title="Fit to Screen" disabled={nodesCount === 0}>
        <MaximizeIcon className="w-5 h-5" />
      </button>
      <button 
        onClick={onAutoLayoutNodes} 
        className={iconButtonClass} 
        title="Auto-Layout Nodes"
        disabled={nodesCount < 1} // Changed to allow layout for single node (centers it)
      >
        <SquaresPlusIcon className="w-5 h-5" />
      </button>
      <div className="flex-grow"></div> {/* Spacer */}
      <button onClick={onUndo} className={iconButtonClass} title="Undo" disabled={!canUndo}>
        <UndoIcon className="w-5 h-5" />
      </button>
      <button onClick={onRedo} className={iconButtonClass} title="Redo" disabled={!canRedo}>
        <RedoIcon className="w-5 h-5" />
      </button>
    </aside>
  );
};

export default LeftControlsToolbar;