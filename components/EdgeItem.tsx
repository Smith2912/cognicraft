import React from 'react';
import { NodeData, Point } from '../types';
import { NODE_WIDTH, NODE_HEIGHT, COLORS } from '../constants';

interface EdgeItemProps {
  id: string; 
  sourceNode: NodeData;
  targetNode: NodeData;
  sourceHandlePosition?: 'top' | 'bottom' | 'left' | 'right';
  targetHandlePosition?: 'top' | 'bottom' | 'left' | 'right';
  isSelected: boolean; 
  onEdgeClick: (edgeId: string) => void;
  onEdgeContextMenu?: (edgeId: string, clientX: number, clientY: number) => void;
}

const getHandlePosition = (node: NodeData, position?: 'top' | 'bottom' | 'left' | 'right'): Point => {
    const w = node.width || NODE_WIDTH;
    const h = node.height || NODE_HEIGHT;
    let { x, y } = node;

    switch (position) {
        case 'top': return { x: x + w / 2, y: y };
        case 'bottom': return { x: x + w / 2, y: y + h };
        case 'left': return { x: x, y: y + h / 2 };
        case 'right': return { x: x + w, y: y + h / 2 };
        default: return { x: x + w / 2, y: y + h / 2 }; 
    }
};

const EdgeItem = ({ 
    id, 
    sourceNode, 
    targetNode, 
    sourceHandlePosition, 
    targetHandlePosition,
    isSelected,
    onEdgeClick,
    onEdgeContextMenu
}: EdgeItemProps): JSX.Element => {
  const p1 = getHandlePosition(sourceNode, sourceHandlePosition);
  const p2 = getHandlePosition(targetNode, targetHandlePosition);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const pathData = `M ${p1.x} ${p1.y} C ${p1.x + dx * 0.33} ${p1.y + dy * 0.33}, ${p2.x - dx * 0.33} ${p2.y - dy * 0.33}, ${p2.x} ${p2.y}`;

  const handleMouseDown = (e: React.MouseEvent<SVGPathElement>) => {
    e.stopPropagation(); 
    onEdgeClick(id); 
  };

  const handleContextMenu = (e: React.MouseEvent<SVGPathElement>) => {
    if (!onEdgeContextMenu) return;
    e.preventDefault();
    e.stopPropagation();
    onEdgeContextMenu(id, e.clientX, e.clientY);
  };

  return (
    <path
      d={pathData}
      className={isSelected ? "stroke-dark-accent" : "stroke-dark-border"}
      strokeWidth={isSelected ? "3" : "2"} 
      fill="none"
      markerEnd="url(#arrowhead)"
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{ cursor: 'pointer' }}
      aria-label={`Connection from ${sourceNode.title} to ${targetNode.title}${isSelected ? ' (Selected)' : ''}`}
    />
  );
};

export default React.memo(EdgeItem);