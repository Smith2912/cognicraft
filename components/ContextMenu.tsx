
import React, { useEffect, useRef } from 'react';
import { MousePointerClickIcon, PlusIcon } from './icons'; // Assuming PlusIcon for general add

interface ContextMenuProps {
  clientX: number;
  clientY: number;
  onClose: () => void;
  onCreateNodeAtPosition: () => void; // Will use stored SVG coords from App state
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  clientX,
  clientY,
  onClose,
  onCreateNodeAtPosition,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const handleCreateNode = () => {
    onCreateNodeAtPosition();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-dark-card border border-dark-border rounded-md shadow-xl py-1.5 z-50 text-sm text-dark-text-primary"
      style={{
        top: clientY,
        left: clientX,
      }}
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="options-menu"
    >
      <ul>
        <li
          onClick={handleCreateNode}
          className="px-3 py-1.5 hover:bg-dark-accent hover:text-white flex items-center space-x-2 cursor-pointer"
          role="menuitem"
        >
          <MousePointerClickIcon className="w-4 h-4" />
          <span>Create Node Here</span>
        </li>
        {/* Future actions can be added here */}
        {/* <li className="px-3 py-1.5 hover:bg-dark-accent hover:text-white flex items-center space-x-2 cursor-pointer">
          <PasteIcon className="w-4 h-4" /> 
          <span>Paste Node</span>
        </li> */}
      </ul>
    </div>
  );
};

export default ContextMenu;
