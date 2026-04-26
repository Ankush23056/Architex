import { useRef, useEffect, useState } from 'react';
import { drawElement, drawCurveHandle, isPointInElement, isPointNearCurveHandle } from '../utils/drawingUtils';

export function useCanvas(elements, { addElement, updateElement, broadcastCursor }) {
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [currentTool, setCurrentTool] = useState('select');
  const [currentColor, setCurrentColor] = useState('#39FF14');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  
  const isDrawing = useRef(false);
  const isDragging = useRef(false);
  const isDraggingHandle = useRef(false);
  const currentElement = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const lastCursorSend = useRef(0);

  // ── Render loop ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
      
      sortedElements.forEach((el) => {
        drawElement(ctx, el);
        
        if (el.id === selectedId) {
          // Draw curve control handle when curve is selected
          if (el.type === 'curve') {
            drawCurveHandle(ctx, el);
          } else {
            ctx.save();
            ctx.strokeStyle = '#FF00FF';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            const padding = 5;
            const minX = Math.min(el.x, el.x + (el.width || 0));
            const minY = Math.min(el.y, el.y + (el.height || 0));
            const w = Math.abs(el.width || 0);
            const h = Math.abs(el.height || 0);
            
            if (el.type === 'text') {
              ctx.strokeRect(el.x - padding, el.y - padding, (el.text.length * el.strokeWidth * 6) + padding * 2, (el.strokeWidth * 12) + padding * 2);
            } else {
              ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2);
            }
            ctx.restore();
          }
        }
      });
      
      if (isDrawing.current && currentElement.current) {
        drawElement(ctx, currentElement.current);
      }
      
      animationFrameId = requestAnimationFrame(render);
    };
    
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [elements, selectedId]);

  // ── Canvas resize ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // ── Pointer Down ─────────────────────────────────────────────
  const handlePointerDown = (e) => {
    const { x, y } = getMousePos(e);
    
    if (currentTool === 'select') {
      const sortedElements = [...elements].sort((a, b) => b.zIndex - a.zIndex);

      // Check if clicking on a curve control handle first
      if (selectedId) {
        const selectedEl = elements.find(el => el.id === selectedId);
        if (selectedEl?.type === 'curve' && isPointNearCurveHandle(x, y, selectedEl)) {
          isDraggingHandle.current = true;
          return;
        }
      }

      const clickedElement = sortedElements.find(el => {
        if (el.type === 'text') {
          const w = el.text.length * el.strokeWidth * 6;
          const h = el.strokeWidth * 12;
          return x >= el.x && x <= el.x + w && y >= el.y && y <= el.y + h;
        }
        return isPointInElement(x, y, el);
      });
      
      if (clickedElement) {
        setSelectedId(clickedElement.id);
        isDragging.current = true;
        dragStartPos.current = { x, y };
        startOffset.current = { x: clickedElement.x, y: clickedElement.y };
      } else {
        setSelectedId(null);
      }
    } else {
      isDrawing.current = true;
      setSelectedId(null);
      
      const newElement = {
        id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: currentTool,
        x,
        y,
        width: 0,
        height: 0,
        color: currentColor,
        strokeWidth: currentStrokeWidth,
        zIndex: elements.length > 0 ? Math.max(...elements.map(e => e.zIndex)) + 1 : 0,
        text: currentTool === 'text' ? 'New Text' : undefined,
        controlPoint: currentTool === 'curve' ? { x, y } : undefined,
      };
      
      if (currentTool === 'text') {
        addElement(newElement);
        setSelectedId(newElement.id);
        setCurrentTool('select');
        isDrawing.current = false;
      } else {
        currentElement.current = newElement;
      }
    }
  };

  // ── Pointer Move ─────────────────────────────────────────────
  const handlePointerMove = (e) => {
    const { x, y } = getMousePos(e);
    
    // Throttled cursor broadcast at ~30fps
    const now = Date.now();
    if (now - lastCursorSend.current > 33) {
      if (broadcastCursor) broadcastCursor(x, y, currentColor);
      lastCursorSend.current = now;
    }

    // Dragging curve control handle
    if (isDraggingHandle.current && selectedId) {
      const el = elements.find(el => el.id === selectedId);
      if (el) {
        updateElement({ ...el, controlPoint: { x, y } });
      }
      return;
    }
    
    if (currentTool === 'select' && isDragging.current && selectedId) {
      const dx = x - dragStartPos.current.x;
      const dy = y - dragStartPos.current.y;
      const elementToUpdate = elements.find(el => el.id === selectedId);
      if (elementToUpdate) {
        updateElement({
          ...elementToUpdate,
          x: startOffset.current.x + dx,
          y: startOffset.current.y + dy
        });
      }
    } else if (isDrawing.current && currentElement.current) {
      currentElement.current = {
        ...currentElement.current,
        width: x - currentElement.current.x,
        height: y - currentElement.current.y,
      };
    }
  };

  // ── Pointer Up ───────────────────────────────────────────────
  const handlePointerUp = () => {
    if (isDraggingHandle.current) {
      isDraggingHandle.current = false;
      return;
    }

    if (isDrawing.current && currentElement.current) {
      const el = currentElement.current;
      if (Math.abs(el.width) > 5 || Math.abs(el.height) > 5 || el.type === 'text') {
        // For curves, set an initial arched control point
        const finalEl = el.type === 'curve'
          ? {
              ...el,
              controlPoint: {
                x: el.x + el.width / 2,
                y: el.y + el.height / 2 - 60,
              },
            }
          : el;
        addElement(finalEl);
        setSelectedId(finalEl.id);
      }
      isDrawing.current = false;
      currentElement.current = null;
    } else if (isDragging.current) {
      isDragging.current = false;
    }
  };

  return {
    canvasRef,
    selectedId,
    setSelectedId,
    currentTool,
    setCurrentTool,
    currentColor,
    setCurrentColor,
    currentStrokeWidth,
    setCurrentStrokeWidth,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  };
}
