import React from 'react';
import { NodeData, NodeStatus } from '../types';
import { NODE_WIDTH, NODE_HEIGHT, NODE_STATUS_CONFIG, RESIZE_HANDLE_SIZE, COLORS } from '../constants';
import { CheckCircleIcon, ICON_MAP, LinkIcon } from './icons'; // Use ICON_MAP and LinkIcon

interface NodeItemProps {
  node: NodeData;
  isSelected: boolean;
  isConnecting: boolean;
  onNodeMouseDown: (e: React.MouseEvent<SVGGElement>, nodeId: string) => void;
  onNodeClick: (e: React.MouseEvent<SVGGElement>, nodeId: string) => void;
  onConnectStart: (nodeId: string, position: 'top' | 'bottom' | 'left' | 'right', shiftKey: boolean) => void;
  onNodeResizeStart: (e: React.MouseEvent<SVGRectElement>, nodeId: string) => void;
}

const NodeItem: React.FC<NodeItemProps> = ({ node, isSelected, isConnecting, onNodeMouseDown, onNodeClick, onConnectStart, onNodeResizeStart }) => {
  const width = node.width || NODE_WIDTH;
  const height = node.height || NODE_HEIGHT;
  const statusConfig = NODE_STATUS_CONFIG[node.status] || NODE_STATUS_CONFIG[NodeStatus.ToDo];

  const AVERAGE_TAG_WIDTH_PX = 70;
  const MIN_TAGS_TO_SHOW = 1;
  const ABSOLUTE_MAX_TAGS = 5;
  
  const internalPaddingAndGaps = 24 + 8;
  const availableWidthForTags = width - internalPaddingAndGaps;
  
  let maxTagsToShow = Math.floor(availableWidthForTags / AVERAGE_TAG_WIDTH_PX);
  maxTagsToShow = Math.max(MIN_TAGS_TO_SHOW, Math.min(maxTagsToShow, ABSOLUTE_MAX_TAGS));
  if (!node.tags || node.tags.length === 0) {
    maxTagsToShow = 0;
  }

  const displayDescription = node.description.length > (maxTagsToShow > 0 ? 40 : 50)
    ? node.description.substring(0, (maxTagsToShow > 0 ? 37 : 47)) + "..."
    : node.description;

  const handleConnectMouseDown = (e: React.MouseEvent, position: 'top' | 'bottom' | 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    onConnectStart(node.id, position, e.shiftKey);
  };

  const handleResizeMouseDown = (e: React.MouseEvent<SVGRectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onNodeResizeStart(e, node.id);
  };

  const SelectedIcon = ICON_MAP[node.iconId || 'default'] || ICON_MAP.default;
  const tagsToDisplay = node.tags?.slice(0, maxTagsToShow) || [];
  const hasMoreTags = (node.tags?.length || 0) > maxTagsToShow && maxTagsToShow > 0;
  const isValidGitHubIssueUrl = node.githubIssueUrl && node.githubIssueUrl.trim().startsWith('https://github.com/') && node.githubIssueUrl.includes('/issues/');

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseDown={(e) => onNodeMouseDown(e, node.id)}
      onClick={(e) => onNodeClick(e, node.id)}
      className={`grab ${isConnecting ? 'cursor-crosshair' : ''} transition-all duration-100 ease-in-out`}
      aria-label={`Node: ${node.title}, Status: ${node.status}${isSelected ? ', Selected' : ''}`}
    >
      <rect
        width={width}
        height={height}
        rx={8}
        ry={8}
        className={`fill-dark-surface ${isSelected ? 'stroke-dark-accent' : 'stroke-dark-border'}`}
        style={{
          strokeWidth: isSelected ? 2 : 1.5,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2)) drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
        }}
      />
      <foreignObject x="0" y="0" width={width} height={height} style={{ pointerEvents: isConnecting ? 'none' : 'auto' }}>
        <div
            className="p-3 flex flex-col justify-between h-full overflow-hidden text-dark-text-primary relative" // Added relative for absolute positioning of link icon
            style={{ pointerEvents: isConnecting ? 'none' : 'auto' }}
        >
          {/* GitHub Issue Link Icon */}
          {isValidGitHubIssueUrl && (
            <a 
              href={node.githubIssueUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute top-2 right-2 text-dark-text-secondary hover:text-dark-accent z-10"
              onClick={(e) => e.stopPropagation()} // Prevent node click when clicking link
              title="View GitHub Issue"
              aria-label="View GitHub Issue"
            >
              <LinkIcon className="w-4 h-4" />
            </a>
          )}

          {/* Top section: Icon, Title, Description */}
          <div className="flex-shrink-0">
            <div className="flex items-start space-x-2.5 mb-1">
              <SelectedIcon className="w-5 h-5 mt-0.5 text-dark-text-secondary flex-shrink-0" />
              <div className="flex-grow overflow-hidden mr-4"> {/* Added mr-4 if link icon is present */}
                <div className="font-semibold text-sm text-dark-text-primary truncate" title={node.title}>
                  {node.title}
                </div>
                <div className="text-xs mt-0.5 text-dark-text-secondary truncate" title={node.description}>
                  {displayDescription || "No description"}
                </div>
              </div>
            </div>
          </div>

          {/* Tags section */}
          {node.tags && node.tags.length > 0 && maxTagsToShow > 0 && (
            <div 
                className="my-1 flex flex-wrap gap-1 overflow-hidden items-center flex-shrink-0" 
                title={node.tags.join(', ')}
            >
              {tagsToDisplay.map(tag => (
                <span key={tag} className="text-xs bg-dark-card text-dark-text-secondary px-1.5 py-0.5 rounded-sm">
                  {tag}
                </span>
              ))}
              {hasMoreTags && (
                <span className="text-xs text-dark-text-secondary ml-0.5">...</span>
              )}
            </div>
          )}
          
          {/* Bottom section: Status, Updated recently */}
          <div className="mt-auto flex items-center justify-between text-xs flex-shrink-0">
            <div className={`flex items-center ${statusConfig.color}`}>
              {node.status === NodeStatus.Done && <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />}
              <span className="font-medium">{node.status}</span>
            </div>
            <span className="text-dark-text-secondary">Updated recently</span>
          </div>
        </div>
      </foreignObject>

      {(isSelected || isConnecting) && (
        <>
          <circle cx={width / 2} cy={0} r={5} className="fill-dark-border hover:fill-dark-accent stroke-dark-surface stroke-1 cursor-pointer opacity-80 hover:opacity-100" onMouseDown={(e) => handleConnectMouseDown(e, 'top')} />
          <circle cx={width / 2} cy={height} r={5} className="fill-dark-border hover:fill-dark-accent stroke-dark-surface stroke-1 cursor-pointer opacity-80 hover:opacity-100" onMouseDown={(e) => handleConnectMouseDown(e, 'bottom')} />
          <circle cx={0} cy={height / 2} r={5} className="fill-dark-border hover:fill-dark-accent stroke-dark-surface stroke-1 cursor-pointer opacity-80 hover:opacity-100" onMouseDown={(e) => handleConnectMouseDown(e, 'left')} />
          <circle cx={width} cy={height / 2} r={5} className="fill-dark-border hover:fill-dark-accent stroke-dark-surface stroke-1 cursor-pointer opacity-80 hover:opacity-100" onMouseDown={(e) => handleConnectMouseDown(e, 'right')} />
        </>
      )}

      {isSelected && (
        <rect
          x={width - RESIZE_HANDLE_SIZE / 2}
          y={height - RESIZE_HANDLE_SIZE / 2}
          width={RESIZE_HANDLE_SIZE}
          height={RESIZE_HANDLE_SIZE}
          className="fill-dark-accent hover:fill-dark-accent-hover stroke-dark-surface stroke-1 cursor-nwse-resize opacity-80 hover:opacity-100"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </g>
  );
};

export default React.memo(NodeItem);