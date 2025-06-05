import { NodeData, EdgeData } from '../types';
import { NODE_WIDTH as DEFAULT_NODE_WIDTH, NODE_HEIGHT as DEFAULT_NODE_HEIGHT, GRID_SIZE } from '../constants';

const Y_SPACING_PARENT_CHILD = DEFAULT_NODE_HEIGHT * 0.75; // Vertical gap between parent and child row
const X_SPACING_SIBLING_SUBTREE = DEFAULT_NODE_WIDTH * 0.3; // Horizontal gap between sibling subtrees
const X_ROOT_SPACING = DEFAULT_NODE_WIDTH * 0.5; // Horizontal gap between root nodes/components

interface LayoutNode extends NodeData {
  _children: LayoutNode[];
  _parents: string[]; // Keep track of parents for root identification
  _x: number;
  _y: number;
  _width: number; // Actual width of the node
  _height: number; // Actual height of the node
  _subtreeWidth: number; // Calculated width of the subtree rooted at this node
  _isVisited: boolean; // For traversal
  _isRootCandidate: boolean; // Initially true for all, set to false if it's a target
}

// Helper to build the graph structure (adjacency list for children)
function buildGraph(originalNodes: NodeData[], edges: EdgeData[]): Map<string, LayoutNode> {
  const nodeMap = new Map<string, LayoutNode>();

  originalNodes.forEach(n => {
    nodeMap.set(n.id, {
      ...n,
      _children: [],
      _parents: [],
      _x: n.x, // Preserve original if needed for sorting later, but will be overwritten
      _y: n.y,
      _width: n.width || DEFAULT_NODE_WIDTH,
      _height: n.height || DEFAULT_NODE_HEIGHT,
      _subtreeWidth: 0,
      _isVisited: false,
      _isRootCandidate: true, // Assume root until proven otherwise
    });
  });

  edges.forEach(edge => {
    const source = nodeMap.get(edge.sourceId);
    const target = nodeMap.get(edge.targetId);
    if (source && target) {
      source._children.push(target);
      target._parents.push(source.id);
      target._isRootCandidate = false; // It has a parent, so not a root of the main graph
    }
  });
  return nodeMap;
}

// Pass 1: Post-order traversal to calculate subtree widths
function calculateSubtreeWidths(node: LayoutNode): void {
  node._isVisited = true;
  if (node._children.length === 0) {
    node._subtreeWidth = node._width;
    return;
  }

  let childrenTotalWidth = 0;
  node._children.forEach((child, index) => {
    if (!child._isVisited) { // Avoid infinite loops in case of cycles
      calculateSubtreeWidths(child);
    }
    childrenTotalWidth += child._subtreeWidth;
    if (index < node._children.length - 1) {
      childrenTotalWidth += X_SPACING_SIBLING_SUBTREE;
    }
  });

  node._subtreeWidth = Math.max(node._width, childrenTotalWidth);
  node._isVisited = false; // Reset for next pass
}

// Pass 2: Pre-order traversal to assign positions
function assignPositions(node: LayoutNode, currentX: number, currentY: number): void {
  node._isVisited = true;
  // Center the node itself over its potential children block
  node._x = currentX + (node._subtreeWidth - node._width) / 2;
  node._y = currentY;

  if (node._children.length > 0) {
    const childrenY = currentY + node._height + Y_SPACING_PARENT_CHILD;
    let childStartX = currentX; // Children start aligned with the beginning of the parent's subtree allocation

    node._children.forEach(child => {
      if (!child._isVisited) { // Avoid infinite loops
         assignPositions(child, childStartX, childrenY);
      }
      childStartX += child._subtreeWidth + X_SPACING_SIBLING_SUBTREE;
    });
  }
}

export const autoLayoutNodes = (
  originalNodes: NodeData[],
  edges: EdgeData[]
): NodeData[] => {
  if (originalNodes.length === 0) return [];

  const nodeMap = buildGraph(originalNodes, edges);
  const roots: LayoutNode[] = [];
  
  // Identify initial roots and also reset visited flags for subtree calculation pass
  nodeMap.forEach(node => {
    node._isVisited = false;
    if (node._isRootCandidate) {
      roots.push(node);
    }
  });

  // If no explicit roots (e.g. a single cycle), pick an arbitrary node to start.
  // For a more robust solution with complex graphs, a better root selection or cycle breaking might be needed.
  if (roots.length === 0 && nodeMap.size > 0) {
    const firstNode = nodeMap.values().next().value;
    if (firstNode) { // ensure value exists
        roots.push(firstNode); 
    }
  }
  
  // Sort roots by original X position to maintain some stability if possible
  roots.sort((a,b) => (originalNodes.find(n=>n.id === a.id)?.x || 0) - (originalNodes.find(n=>n.id === b.id)?.x || 0));


  // Calculate subtree widths for all trees/components
  roots.forEach(root => {
    if (!root._isVisited) { // If part of a multi-root component, might have been visited
        calculateSubtreeWidths(root);
    }
  });
  // Handle any nodes not reached if they were part of separate components missed by initial root finding
  nodeMap.forEach(node => {
    if (!node._isVisited) { // If not visited, it's a root of a new component
        calculateSubtreeWidths(node);
        if(!roots.includes(node)) roots.push(node); // Add to roots list if it wasn't there
    }
    node._isVisited = false; // Reset for positioning pass
  });


  let currentGlobalX = GRID_SIZE;
  const initialY = GRID_SIZE;

  roots.forEach(root => {
    if(!root._isVisited){
        assignPositions(root, currentGlobalX, initialY);
        currentGlobalX += root._subtreeWidth + X_ROOT_SPACING;
    }
  });
  
  // Handle nodes not visited (e.g. completely disconnected nodes or parts of cycles not reached)
  nodeMap.forEach(node => {
      if(!node._isVisited){
          assignPositions(node, currentGlobalX, initialY); // Place it as a new "root"
          currentGlobalX += node._subtreeWidth + X_ROOT_SPACING;
      }
  });


  // Apply calculated positions back to a new array, and snap to grid
  const finalNodes: NodeData[] = originalNodes.map(n => {
    const layoutInfo = nodeMap.get(n.id);
    if (layoutInfo) {
      return {
        ...n,
        x: Math.round(layoutInfo._x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(layoutInfo._y / GRID_SIZE) * GRID_SIZE,
      };
    }
    return n; // Should not happen if nodeMap is built correctly
  });

  return finalNodes;
};