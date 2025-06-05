
import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { NodeData, EdgeData, Point } from '../types';
import {
    NODE_WIDTH, NODE_HEIGHT,
    INITIAL_VIEWBOX_WIDTH, INITIAL_VIEWBOX_HEIGHT,
    MIN_SCALE, MAX_SCALE, ZOOM_SENSITIVITY, PAN_SENSITIVITY,
    MIN_NODE_WIDTH, MIN_NODE_HEIGHT, RESIZE_HANDLE_SIZE,
    GRID_SIZE, COLORS
} from '../constants';
import NodeItem from './NodeItem';
import EdgeItem from './EdgeItem';

export interface NodePlannerCanvasHandle {
  zoomInCanvas: () => void;
  zoomOutCanvas: () => void;
  fitView: (nodesToFit?: NodeData[]) => void;
}

interface NodePlannerCanvasProps {
  nodes: NodeData[];
  edges: EdgeData[];
  setNodes: (updater: React.SetStateAction<NodeData[]>) => void; 
  setEdges: (updater: React.SetStateAction<EdgeData[]>) => void; 
  selectedNodeIds: string[];
  setSelectedNodeIds: (updater: React.SetStateAction<string[]>) => void; 
  selectedEdgeId: string | null;
  setSelectedEdgeId: (updater: React.SetStateAction<string | null>) => void; 
  connectingInfo: { sourceId: string; sourceHandle: 'top' | 'bottom' | 'left' | 'right'; mousePosition: Point } | null;
  setConnectingInfo: (info: { sourceId: string; sourceHandle: 'top' | 'bottom' | 'left' | 'right'; mousePosition: Point } | null) => void;
  showGrid: boolean;
  onInteractionEnd: () => void; 
  onCanvasDoubleClick: (position: Point) => void; 
  onCanvasContextMenu: (clientX: number, clientY: number, svgX: number, svgY: number) => void; // New prop
}

const generateId = (prefix: string = 'id'): string => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const NodePlannerCanvas = forwardRef<NodePlannerCanvasHandle, NodePlannerCanvasProps>(({
  nodes,
  edges,
  setNodes,
  setEdges,
  selectedNodeIds,
  setSelectedNodeIds,
  selectedEdgeId,      
  setSelectedEdgeId,   
  connectingInfo,
  setConnectingInfo,
  showGrid,
  onInteractionEnd,
  onCanvasDoubleClick,
  onCanvasContextMenu, 
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<[number, number, number, number]>([
    -INITIAL_VIEWBOX_WIDTH / 2,
    -INITIAL_VIEWBOX_HEIGHT / 2,
    INITIAL_VIEWBOX_WIDTH,
    INITIAL_VIEWBOX_HEIGHT,
  ]);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState<Point | null>(null);

  const [draggingNodesInfo, setDraggingNodesInfo] = useState<Array<{ nodeId: string; offsetX: number; offsetY: number; initialX: number; initialY: number }> | null>(null);
  const [resizingNodeInfo, setResizingNodeInfo] = useState<{ nodeId: string; initialWidth: number; initialHeight: number; startX: number; startY: number; nodeStartX: number; nodeStartY: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ clientStartX: number; clientStartY: number; startX: number; startY: number; currentX: number; currentY: number } | null>(null);


  const getMousePositionInSVG = useCallback((e: MouseEvent | React.MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return {
      x: (e.clientX - ctm.e) / ctm.a,
      y: (e.clientY - ctm.f) / ctm.d,
    };
  }, []);
  
  const applyZoom = useCallback((scaleFactor: number, anchorX?: number, anchorY?: number) => {
    setViewBox(currentViewBox => {
        const [vx, vy, vw, vh] = currentViewBox;
        
        const newWidthUnbounded = vw / scaleFactor; 
        const newHeightUnbounded = vh / scaleFactor;

        const newWidth = Math.max(INITIAL_VIEWBOX_WIDTH / MAX_SCALE, Math.min(INITIAL_VIEWBOX_WIDTH / MIN_SCALE, newWidthUnbounded));
        const newHeight = Math.max(INITIAL_VIEWBOX_HEIGHT / MAX_SCALE, Math.min(INITIAL_VIEWBOX_HEIGHT / MIN_SCALE, newHeightUnbounded));

        if ((newWidthUnbounded > INITIAL_VIEWBOX_WIDTH / MIN_SCALE && newWidth === INITIAL_VIEWBOX_WIDTH / MIN_SCALE) ||
            (newWidthUnbounded < INITIAL_VIEWBOX_WIDTH / MAX_SCALE && newWidth === INITIAL_VIEWBOX_WIDTH / MAX_SCALE)) {
            if (scaleFactor > 1 && newWidth === INITIAL_VIEWBOX_WIDTH / MAX_SCALE) { /* Allow if zooming in and at max zoom */ }
            else if (scaleFactor < 1 && newWidth === INITIAL_VIEWBOX_WIDTH / MIN_SCALE) { /* Allow if zooming out and at min zoom */ }
            else {
                // return currentViewBox; // This condition might be too restrictive
            }
        }

        const mouseX = anchorX === undefined ? vx + vw / 2 : anchorX;
        const mouseY = anchorY === undefined ? vy + vh / 2 : anchorY;

        const newVx = mouseX - (mouseX - vx) * (newWidth / vw);
        const newVy = mouseY - (mouseY - vy) * (newHeight / vh);
        return [newVx, newVy, newWidth, newHeight];
    });
  }, []);


  useImperativeHandle(ref, () => ({
    zoomInCanvas: () => applyZoom(1.2), 
    zoomOutCanvas: () => applyZoom(1 / 1.2), 
    fitView: (nodesToFit: NodeData[] = nodes) => {
        if (nodesToFit.length === 0) {
            setViewBox([
                -INITIAL_VIEWBOX_WIDTH / 2,
                -INITIAL_VIEWBOX_HEIGHT / 2,
                INITIAL_VIEWBOX_WIDTH,
                INITIAL_VIEWBOX_HEIGHT,
            ]);
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodesToFit.forEach(node => {
            const nodeW = node.width || NODE_WIDTH;
            const nodeH = node.height || NODE_HEIGHT;
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + nodeW);
            maxY = Math.max(maxY, node.y + nodeH);
        });

        const actualContentWidth = maxX - minX;
        const actualContentHeight = maxY - minY;

        const contentCenterX = minX + actualContentWidth / 2;
        const contentCenterY = minY + actualContentHeight / 2;

        const padding = 100; 
        const targetViewWidth = actualContentWidth + 2 * padding;
        const targetViewHeight = actualContentHeight + 2 * padding;

        if (targetViewWidth <= 0 || targetViewHeight <= 0) { 
             setViewBox([
                -INITIAL_VIEWBOX_WIDTH / 2,
                -INITIAL_VIEWBOX_HEIGHT / 2,
                INITIAL_VIEWBOX_WIDTH,
                INITIAL_VIEWBOX_HEIGHT,
            ]);
            return;
        }

        const canvasClientWidth = svgRef.current?.clientWidth || INITIAL_VIEWBOX_WIDTH;
        const canvasClientHeight = svgRef.current?.clientHeight || INITIAL_VIEWBOX_HEIGHT;
        
        const aspectRatioCanvas = canvasClientWidth / (canvasClientHeight || 1); 
        const aspectRatioTarget = targetViewWidth / (targetViewHeight || 1); 

        let finalVw: number;
        let finalVh: number;

        if (aspectRatioTarget > aspectRatioCanvas) {
            finalVw = targetViewWidth;
            finalVh = targetViewWidth / aspectRatioCanvas;
        } else {
            finalVh = targetViewHeight;
            finalVw = targetViewHeight * aspectRatioCanvas;
        }
        
        if (finalVw <=0) finalVw = INITIAL_VIEWBOX_WIDTH;
        if (finalVh <=0) finalVh = INITIAL_VIEWBOX_HEIGHT;


        const finalVx = contentCenterX - finalVw / 2;
        const finalVy = contentCenterY - finalVh / 2;
        
        setViewBox([finalVx, finalVy, finalVw, finalVh]);
    }
  }), [applyZoom, nodes, NODE_WIDTH, NODE_HEIGHT, INITIAL_VIEWBOX_WIDTH, INITIAL_VIEWBOX_HEIGHT]);


  const handleWheel = useCallback((e: WheelEvent) => { 
    e.preventDefault();
    const scaleFactor = 1 - e.deltaY * ZOOM_SENSITIVITY;
    const mousePos = getMousePositionInSVG(e);
    applyZoom(scaleFactor, mousePos.x, mousePos.y);
  }, [getMousePositionInSVG, applyZoom]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (svgElement) {
      const wheelHandler = (e: WheelEvent) => handleWheel(e);
      svgElement.addEventListener('wheel', wheelHandler, { passive: false });
      return () => {
        svgElement.removeEventListener('wheel', wheelHandler);
      };
    }
  }, [handleWheel]);


  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const targetIsSvgBackground = e.target === svgRef.current || (e.target as SVGElement).classList.contains('svg-background-rect');
    
    if (targetIsSvgBackground && selectedEdgeId !== null) {
      setSelectedEdgeId(null); 
      onInteractionEnd();
    }

    if (e.button === 0 && !e.shiftKey && targetIsSvgBackground) {
        const svgMousePos = getMousePositionInSVG(e);
        setSelectionRect({ clientStartX: e.clientX, clientStartY: e.clientY, startX: svgMousePos.x, startY: svgMousePos.y, currentX: svgMousePos.x, currentY: svgMousePos.y });
        if (selectedNodeIds.length > 0) {
          setSelectedNodeIds([]); 
        }
    } else if (e.button === 0 && e.shiftKey && targetIsSvgBackground) {
        const svgMousePos = getMousePositionInSVG(e);
        setSelectionRect({ clientStartX: e.clientX, clientStartY: e.clientY, startX: svgMousePos.x, startY: svgMousePos.y, currentX: svgMousePos.x, currentY: svgMousePos.y });
    } else if ((e.button === 1 || (e.button === 0 && e.altKey)) && !resizingNodeInfo && targetIsSvgBackground) { 
      e.preventDefault();
      setIsPanning(true);
      setLastMousePosition({ x: e.clientX, y: e.clientY });
      if (svgRef.current) svgRef.current.classList.add('grabbing');
    }

    if (connectingInfo && targetIsSvgBackground) {
      setConnectingInfo(null); 
      onInteractionEnd();
    }
  }, [getMousePositionInSVG, resizingNodeInfo, connectingInfo, setSelectedNodeIds, setSelectedEdgeId, setConnectingInfo, selectedNodeIds, selectedEdgeId, onInteractionEnd]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent<SVGGElement>, nodeId: string) => {
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode) {
        e.stopPropagation(); 
        return;
    }

    if (connectingInfo && connectingInfo.sourceId !== nodeId) {
      e.preventDefault(); 
      e.stopPropagation(); 
      const sourceNode = nodes.find(n => n.id === connectingInfo.sourceId);
      if (!sourceNode) {
        setConnectingInfo(null);
        return;
      }

      let targetHandle: 'top' | 'bottom' | 'left' | 'right' = 'left'; 
      const dx = (targetNode.x + (targetNode.width || NODE_WIDTH) / 2) - (sourceNode.x + (sourceNode.width || NODE_WIDTH) / 2);
      const dy = (targetNode.y + (targetNode.height || NODE_HEIGHT) / 2) - (sourceNode.y + (sourceNode.height || NODE_HEIGHT) / 2);

      if (Math.abs(dx) > Math.abs(dy)) { 
        targetHandle = dx > 0 ? 'left' : 'right';
      } else { 
        targetHandle = dy > 0 ? 'top' : 'bottom';
      }
      
      const newEdge: EdgeData = {
        id: generateId('edge'),
        sourceId: connectingInfo.sourceId,
        targetId: nodeId,
        sourceHandle: connectingInfo.sourceHandle,
        targetHandle: targetHandle,
      };
      setEdges(prev => [...prev, newEdge]);
      setConnectingInfo(null);
      setSelectedNodeIds([nodeId]); 
      setSelectedEdgeId(null);
      onInteractionEnd(); 
      return; 
    }

    e.stopPropagation(); 
    const isSelected = selectedNodeIds.includes(nodeId);
    let newSelectedIds = [...selectedNodeIds];
    let selectionChanged = false;

    if (e.shiftKey) {
        newSelectedIds = isSelected ? newSelectedIds.filter(id => id !== nodeId) : [...newSelectedIds, nodeId];
        selectionChanged = JSON.stringify(newSelectedIds) !== JSON.stringify(selectedNodeIds);
    } else if (!isSelected) {
        newSelectedIds = [nodeId];
        selectionChanged = true;
    } else if (newSelectedIds.length > 1) { 
        newSelectedIds = [nodeId];
        selectionChanged = true;
    }
    
    if (selectionChanged) {
        setSelectedNodeIds(newSelectedIds);
        if (selectedEdgeId !== null) setSelectedEdgeId(null);
    }
    
    const mousePos = getMousePositionInSVG(e);
    const nodesToDrag = nodes.filter(n => newSelectedIds.includes(n.id));

    if (nodesToDrag.length > 0 && e.button === 0 && !e.altKey) { 
      setDraggingNodesInfo(
        nodesToDrag.map(n => ({
          nodeId: n.id,
          initialX: n.x, 
          initialY: n.y,
          offsetX: n.x - mousePos.x, 
          offsetY: n.y - mousePos.y,
        }))
      );
      if (svgRef.current) svgRef.current.classList.add('grabbing');
    }

  }, [nodes, selectedNodeIds, setSelectedNodeIds, getMousePositionInSVG, connectingInfo, setEdges, setConnectingInfo, selectedEdgeId, setSelectedEdgeId, onInteractionEnd, NODE_WIDTH, NODE_HEIGHT]);


  const handleMouseMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    const currentMousePos = getMousePositionInSVG(e);

    if (isPanning && lastMousePosition) {
      const dx = (e.clientX - lastMousePosition.x) * PAN_SENSITIVITY * (viewBox[2] / INITIAL_VIEWBOX_WIDTH);
      const dy = (e.clientY - lastMousePosition.y) * PAN_SENSITIVITY * (viewBox[3] / INITIAL_VIEWBOX_HEIGHT);
      setViewBox([viewBox[0] - dx, viewBox[1] - dy, viewBox[2], viewBox[3]]);
      setLastMousePosition({ x: e.clientX, y: e.clientY });
    } else if (draggingNodesInfo) {
        setNodes(prevNodes =>
            prevNodes.map(n => {
              const dragInfo = draggingNodesInfo.find(info => info.nodeId === n.id);
              if (dragInfo) {
                const rawNewX = currentMousePos.x + dragInfo.offsetX;
                const rawNewY = currentMousePos.y + dragInfo.offsetY;
                
                const snappedX = Math.round(rawNewX / GRID_SIZE) * GRID_SIZE;
                const snappedY = Math.round(rawNewY / GRID_SIZE) * GRID_SIZE;

                return { ...n, x: snappedX, y: snappedY };
              }
              return n;
            })
        );
    } else if (resizingNodeInfo) {
        const dx = currentMousePos.x - resizingNodeInfo.startX;
        const dy = currentMousePos.y - resizingNodeInfo.startY;
        setNodes(prevNodes =>
            prevNodes.map(n => {
                if (n.id === resizingNodeInfo.nodeId) {
                    const newWidth = Math.max(MIN_NODE_WIDTH, Math.round((resizingNodeInfo.initialWidth + dx) / GRID_SIZE) * GRID_SIZE);
                    const newHeight = Math.max(MIN_NODE_HEIGHT, Math.round((resizingNodeInfo.initialHeight + dy) / GRID_SIZE) * GRID_SIZE);
                    return { ...n, width: newWidth, height: newHeight };
                }
                return n;
            })
        );
        if (document.body.style.cursor !== 'nwse-resize') {
          document.body.style.cursor = 'nwse-resize';
        }
    } else if (selectionRect) {
        setSelectionRect(prev => prev ? { ...prev, currentX: currentMousePos.x, currentY: currentMousePos.y } : null);
    } else if (connectingInfo) {
        setConnectingInfo({ ...connectingInfo, mousePosition: currentMousePos });
    }
  }, [isPanning, lastMousePosition, viewBox, draggingNodesInfo, resizingNodeInfo, selectionRect, connectingInfo, getMousePositionInSVG, setNodes, setConnectingInfo, GRID_SIZE, MIN_NODE_WIDTH, MIN_NODE_HEIGHT, PAN_SENSITIVITY, INITIAL_VIEWBOX_WIDTH, INITIAL_VIEWBOX_HEIGHT]);

  const handleMouseUp = useCallback((e: React.MouseEvent | MouseEvent) => {
    let interactionOccurred = false;
    if (isPanning) {
      setIsPanning(false);
      if (svgRef.current) svgRef.current.classList.remove('grabbing');
    }
    if (draggingNodesInfo) {
      setNodes(prevNodes =>
        prevNodes.map(n => {
          const dragInfo = draggingNodesInfo.find(info => info.nodeId === n.id);
          if (dragInfo) {
            const snappedX = Math.round(n.x / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(n.y / GRID_SIZE) * GRID_SIZE;
            return { ...n, x: snappedX, y: snappedY };
          }
          return n;
        })
      );
      setDraggingNodesInfo(null);
      if (svgRef.current) svgRef.current.classList.remove('grabbing');
      interactionOccurred = true;
    }
    if (resizingNodeInfo) {
       setNodes(prevNodes =>
        prevNodes.map(n => {
          if (n.id === resizingNodeInfo.nodeId) {
            const snappedWidth = Math.max(MIN_NODE_WIDTH, Math.round((n.width || MIN_NODE_WIDTH) / GRID_SIZE) * GRID_SIZE);
            const snappedHeight = Math.max(MIN_NODE_HEIGHT, Math.round((n.height || MIN_NODE_HEIGHT) / GRID_SIZE) * GRID_SIZE);
            return { ...n, width: snappedWidth, height: snappedHeight };
          }
          return n;
        })
      );
      setResizingNodeInfo(null);
      document.body.style.cursor = 'default';
      interactionOccurred = true;
    }
    if (selectionRect) {
        const { startX, startY, currentX, currentY } = selectionRect;
        const minX = Math.min(startX, currentX);
        const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY);
        const maxY = Math.max(startY, currentY);

        const newlySelectedInRect = nodes
            .filter(node => {
                const nodeCenterX = node.x + (node.width || NODE_WIDTH) / 2;
                const nodeCenterY = node.y + (node.height || NODE_HEIGHT) / 2;
                return nodeCenterX >= minX && nodeCenterX <= maxX && nodeCenterY >= minY && nodeCenterY <= maxY;
            })
            .map(node => node.id);

        const shiftPressed = (e as MouseEvent).shiftKey || (e as React.MouseEvent).shiftKey;
        let finalSelectedIds: string[];

        if (shiftPressed) {
            const currentSelectedSet = new Set(selectedNodeIds);
            newlySelectedInRect.forEach(id => currentSelectedSet.add(id));
            finalSelectedIds = Array.from(currentSelectedSet);
        } else {
            finalSelectedIds = newlySelectedInRect;
        }
        
        if (JSON.stringify(finalSelectedIds) !== JSON.stringify(selectedNodeIds)) {
            setSelectedNodeIds(finalSelectedIds);
            if (selectedEdgeId !== null) setSelectedEdgeId(null);
            interactionOccurred = true;
        }
        setSelectionRect(null);
    }
    
    if (interactionOccurred) {
        onInteractionEnd();
    }
  }, [isPanning, draggingNodesInfo, resizingNodeInfo, selectionRect, nodes, selectedNodeIds, setSelectedNodeIds, setNodes, onInteractionEnd, selectedEdgeId, setSelectedEdgeId, NODE_WIDTH, NODE_HEIGHT, GRID_SIZE, MIN_NODE_WIDTH, MIN_NODE_HEIGHT]);


  const handleNodeClick = useCallback((e: React.MouseEvent<SVGGElement>, nodeId: string) => {
    if (connectingInfo) { 
        if (connectingInfo.sourceId === nodeId) {
            setConnectingInfo(null); 
            onInteractionEnd();
        }
        return; 
    }
    
    const dragThreshold = 3; 
    const clientX = e.clientX; 
    const clientY = e.clientY;
    const wasDrag = draggingNodesInfo || (lastMousePosition && (Math.abs(clientX - lastMousePosition.x) > dragThreshold || Math.abs(clientY - lastMousePosition.y) > dragThreshold));

    if (wasDrag && draggingNodesInfo) { 
      return;
    }

    e.stopPropagation(); 
    
    let newSelectedIds: string[];
    const isSelected = selectedNodeIds.includes(nodeId);
    let selectionChanged = false;

    if (!e.shiftKey) {
        if (!isSelected || selectedNodeIds.length > 1) {
            newSelectedIds = [nodeId];
            selectionChanged = true;
        } else {
            newSelectedIds = selectedNodeIds; 
        }
    } else {
      newSelectedIds = isSelected ? selectedNodeIds.filter(id => id !== nodeId) : [...selectedNodeIds, nodeId];
      selectionChanged = JSON.stringify(newSelectedIds) !== JSON.stringify(selectedNodeIds);
    }

    if (selectionChanged) {
        setSelectedNodeIds(newSelectedIds);
        if (selectedEdgeId !== null) setSelectedEdgeId(null);
        onInteractionEnd(); 
    } else if (isSelected && selectedNodeIds.length === 1 && selectedEdgeId !== null) {
        setSelectedEdgeId(null);
        onInteractionEnd(); 
    }

  }, [connectingInfo, selectedNodeIds, setSelectedNodeIds, setConnectingInfo, setSelectedEdgeId, selectedEdgeId, draggingNodesInfo, lastMousePosition, onInteractionEnd]);

  const handleConnectStart = useCallback((nodeId: string, handle: 'top' | 'bottom' | 'left' | 'right', shiftKey: boolean) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeWidth = node.width || NODE_WIDTH;
    const nodeHeight = node.height || NODE_HEIGHT;
    let startX = node.x, startY = node.y;

    switch(handle) {
        case 'top': startX += nodeWidth/2; break;
        case 'bottom': startX += nodeWidth/2; startY += nodeHeight; break;
        case 'left': startY += nodeHeight/2; break;
        case 'right': startX += nodeWidth; startY += nodeHeight/2; break;
    }
    setConnectingInfo({ sourceId: nodeId, sourceHandle: handle, mousePosition: { x: startX, y: startY }});
    
    let interactionHappened = false;

    if (selectedEdgeId !== null) {
        setSelectedEdgeId(null); 
        interactionHappened = true;
    }

    if (!shiftKey) {
        if (!selectedNodeIds.includes(nodeId) || selectedNodeIds.length > 1) {
            setSelectedNodeIds([nodeId]);
            interactionHappened = true;
        }
    } else {
        if (!selectedNodeIds.includes(nodeId)) {
            setSelectedNodeIds(prev => [...prev, nodeId]);
            interactionHappened = true;
        }
    }
    
    if (interactionHappened) {
        onInteractionEnd();
    }
  }, [nodes, setConnectingInfo, selectedEdgeId, setSelectedEdgeId, selectedNodeIds, setSelectedNodeIds, onInteractionEnd, NODE_WIDTH, NODE_HEIGHT]);
  
  const handleNodeResizeStart = useCallback((e: React.MouseEvent<SVGRectElement>, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const nodeToResize = nodes.find(n => n.id === nodeId);
    if (!nodeToResize) return;

    if (selectedNodeIds.length !== 1 || selectedNodeIds[0] !== nodeId) {
        setSelectedNodeIds([nodeId]);
        if (selectedEdgeId !== null) setSelectedEdgeId(null);
        onInteractionEnd(); 
    }

    const mousePos = getMousePositionInSVG(e);
    setResizingNodeInfo({
      nodeId,
      initialWidth: nodeToResize.width || NODE_WIDTH,
      initialHeight: nodeToResize.height || NODE_HEIGHT,
      startX: mousePos.x,
      startY: mousePos.y,
      nodeStartX: nodeToResize.x,
      nodeStartY: nodeToResize.y,
    });
    document.body.style.cursor = 'nwse-resize';
  }, [nodes, getMousePositionInSVG, selectedNodeIds, setSelectedNodeIds, selectedEdgeId, setSelectedEdgeId, onInteractionEnd, NODE_WIDTH, NODE_HEIGHT]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    let interactionHappened = false;
    if (selectedEdgeId !== edgeId) {
        setSelectedEdgeId(edgeId);
        interactionHappened = true;
    }
    if (selectedNodeIds.length > 0) {
        setSelectedNodeIds([]); 
        interactionHappened = true;
    }
    if (interactionHappened) onInteractionEnd();
  }, [selectedEdgeId, setSelectedEdgeId, selectedNodeIds, setSelectedNodeIds, onInteractionEnd]);


  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = (e: MouseEvent) => handleMouseUp(e);

    if (isPanning || draggingNodesInfo || resizingNodeInfo || selectionRect || connectingInfo) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggingNodesInfo, resizingNodeInfo, selectionRect, connectingInfo, handleMouseMove, handleMouseUp]);

  const handleCanvasDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const targetIsSvgBackground = e.target === svgRef.current || (e.target as SVGElement).classList.contains('svg-background-rect');
    if (targetIsSvgBackground && onCanvasDoubleClick) {
        const svgPoint = getMousePositionInSVG(e);
        onCanvasDoubleClick(svgPoint);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    const targetIsSvgBackground = e.target === svgRef.current || (e.target as SVGElement).classList.contains('svg-background-rect');
    if (targetIsSvgBackground && onCanvasContextMenu) {
        e.preventDefault();
        const svgPoint = getMousePositionInSVG(e);
        onCanvasContextMenu(e.clientX, e.clientY, svgPoint.x, svgPoint.y);
    }
  };

  const renderTemporaryConnectingLine = () => {
    if (!connectingInfo) return null;
    const sourceNode = nodes.find(n => n.id === connectingInfo.sourceId);
    if (!sourceNode) return null;

    const nodeWidth = sourceNode.width || NODE_WIDTH;
    const nodeHeight = sourceNode.height || NODE_HEIGHT;
    let startX = sourceNode.x, startY = sourceNode.y;

    switch(connectingInfo.sourceHandle) {
        case 'top': startX += nodeWidth/2; break;
        case 'bottom': startX += nodeWidth/2; startY += nodeHeight; break;
        case 'left': startY += nodeHeight/2; break;
        case 'right': startX += nodeWidth; startY += nodeHeight/2; break;
    }
    
    return (
      <line
        x1={startX}
        y1={startY}
        x2={connectingInfo.mousePosition.x}
        y2={connectingInfo.mousePosition.y}
        className="stroke-dark-accent stroke-2"
        strokeDasharray="5,5"
      />
    );
  };
  
  const renderSelectionRect = () => {
    if (!selectionRect) return null;
    const x = Math.min(selectionRect.startX, selectionRect.currentX);
    const y = Math.min(selectionRect.startY, selectionRect.currentY);
    const width = Math.abs(selectionRect.startX - selectionRect.currentX);
    const height = Math.abs(selectionRect.startY - selectionRect.currentY);
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className="fill-dark-accent fill-opacity-10 stroke-dark-accent stroke-opacity-50 stroke-1"
      />
    );
  };
  
  const vbX = viewBox[0];
  const vbY = viewBox[1];
  const vbWidth = viewBox[2];
  const vbHeight = viewBox[3];

  const BORDER_BUFFER_FACTOR = 1; 
  const gridRectX = vbX - vbWidth * BORDER_BUFFER_FACTOR;
  const gridRectY = vbY - vbHeight * BORDER_BUFFER_FACTOR;
  const gridRectWidth = vbWidth * (1 + 2 * BORDER_BUFFER_FACTOR);
  const gridRectHeight = vbHeight * (1 + 2 * BORDER_BUFFER_FACTOR);


  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
      onMouseDown={handleSvgMouseDown}
      onMouseUp={handleMouseUp} 
      onMouseMove={(e) => !isPanning && !draggingNodesInfo && !resizingNodeInfo && !selectionRect && !connectingInfo ? null : handleMouseMove(e)}
      onDoubleClick={handleCanvasDoubleClick}
      onContextMenu={handleContextMenu}
      className={`cursor-auto ${isPanning || draggingNodesInfo ? 'grabbing' : 'grab'} bg-dark-surface`}
      style={{ userSelect: 'none' }}
      aria-label="Node planning canvas" 
    >
      <defs>
        <marker
            id="arrowhead"
            viewBox="0 0 12 8" 
            refX="11"          
            refY="4"           
            markerUnits="userSpaceOnUse"
            markerWidth="12"  
            markerHeight="8" 
            orient="auto-start-reverse"
        >
            <path d="M 0 0 L 12 4 L 0 8 z" fill={COLORS.darkBorder} />
        </marker>
        {showGrid && (
            <pattern id="dotGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" className="fill-dark-border opacity-50" />
            </pattern>
        )}
      </defs>
      
      <rect 
        x={gridRectX} 
        y={gridRectY} 
        width={gridRectWidth} 
        height={gridRectHeight} 
        fill={COLORS.darkSurface} 
        className="svg-background-rect" 
      />
      {showGrid && (
        <rect 
            x={gridRectX} 
            y={gridRectY} 
            width={gridRectWidth} 
            height={gridRectHeight} 
            fill="url(#dotGrid)" 
            className="svg-background-rect pointer-events-none" 
        />
      )}


      {edges.map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.sourceId);
        const targetNode = nodes.find(n => n.id === edge.targetId);
        if (!sourceNode || !targetNode) return null;
        return (
            <EdgeItem 
                key={edge.id}
                id={edge.id} 
                sourceNode={sourceNode} 
                targetNode={targetNode} 
                sourceHandlePosition={edge.sourceHandle}
                targetHandlePosition={edge.targetHandle}
                isSelected={edge.id === selectedEdgeId}
                onEdgeClick={handleEdgeClick}
            />
        );
      })}

      {nodes.map(node => (
        <NodeItem
          key={node.id}
          node={node}
          isSelected={selectedNodeIds.includes(node.id)}
          isConnecting={!!connectingInfo}
          onNodeMouseDown={handleNodeMouseDown}
          onNodeClick={handleNodeClick}
          onConnectStart={handleConnectStart}
          onNodeResizeStart={handleNodeResizeStart}
        />
      ))}
      {renderTemporaryConnectingLine()}
      {renderSelectionRect()}
    </svg>
  );
});

export default NodePlannerCanvas;
