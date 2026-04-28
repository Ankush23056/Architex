import { useRef, useEffect, useState } from 'react';
import { drawElement, drawCurveHandle, isPointInElement, isPointNearCurveHandle } from '../utils/drawingUtils';

export function useCanvas(elements, { addElement, updateElement, updateElementsBulk, broadcastCursor, saveHistory }) {
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null); // Primary selected for properties
  const [selectedIds, setSelectedIds] = useState([]); // Array for multi-select
  const [marquee, setMarquee] = useState(null);
  const [currentTool, setCurrentTool] = useState('select');
  const [currentColor, setCurrentColor] = useState('#39FF14');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  
  const isDrawing = useRef(false);
  const isDragging = useRef(false);
  const isDraggingHandle = useRef(false);
  const currentElement = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const startOffsets = useRef({}); // id -> {x, y, points}
  const lastCursorSend = useRef(0);
  const elementsSnapshot = useRef(null);

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
        
        if (el.id === selectedId || selectedIds.includes(el.id)) {
          // Draw curve control handle when curve is selected
          if (el.type === 'curve' && el.id === selectedId) {
            drawCurveHandle(ctx, el);
          } else {
            ctx.save();
            ctx.strokeStyle = '#FF00FF';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            const padding = 5;
            let minX = el.x;
            let minY = el.y;
            let w = el.width || 0;
            let h = el.height || 0;
            
            if (el.type === 'path' && el.points && el.points.length > 0) {
              const xs = el.points.map(p => p.x);
              const ys = el.points.map(p => p.y);
              minX = Math.min(...xs);
              minY = Math.min(...ys);
              w = Math.max(...xs) - minX;
              h = Math.max(...ys) - minY;
              ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2);
            } else if (el.type === 'text') {
              ctx.strokeRect(el.x - padding, el.y - padding, (el.text.length * el.strokeWidth * 6) + padding * 2, (el.strokeWidth * 12) + padding * 2);
            } else {
              minX = Math.min(el.x, el.x + w);
              minY = Math.min(el.y, el.y + h);
              w = Math.abs(w);
              h = Math.abs(h);
              ctx.strokeRect(minX - padding, minY - padding, w + padding * 2, h + padding * 2);
            }
            ctx.restore();
          }
        }
      });

      // Group Marquee bounding box
      if (selectedIds.length > 1) {
        let allMinX = Infinity, allMinY = Infinity, allMaxX = -Infinity, allMaxY = -Infinity;
        selectedIds.forEach(id => {
          const el = elements.find(e => e.id === id);
          if (el) {
             let ex = el.x, ey = el.y, ew = el.width || 0, eh = el.height || 0;
             if (el.type === 'path' && el.points) {
               ex = Math.min(...el.points.map(p => p.x));
               ey = Math.min(...el.points.map(p => p.y));
               ew = Math.max(...el.points.map(p => p.x)) - ex;
               eh = Math.max(...el.points.map(p => p.y)) - ey;
             }
             allMinX = Math.min(allMinX, Math.min(ex, ex + ew));
             allMinY = Math.min(allMinY, Math.min(ey, ey + eh));
             allMaxX = Math.max(allMaxX, Math.max(ex, ex + ew));
             allMaxY = Math.max(allMaxY, Math.max(ey, ey + eh));
          }
        });
        if (allMinX !== Infinity) {
          ctx.save();
          ctx.strokeStyle = '#39FF14';
          ctx.setLineDash([8, 8]);
          ctx.lineWidth = 2;
          ctx.strokeRect(allMinX - 10, allMinY - 10, (allMaxX - allMinX) + 20, (allMaxY - allMinY) + 20);
          ctx.restore();
        }
      }

      // Marquee selection box
      if (marquee) {
        ctx.save();
        ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
        ctx.strokeStyle = '#39FF14';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.fillRect(marquee.startX, marquee.startY, marquee.currentX - marquee.startX, marquee.currentY - marquee.startY);
        ctx.strokeRect(marquee.startX, marquee.startY, marquee.currentX - marquee.startX, marquee.currentY - marquee.startY);
        ctx.restore();
      }
      
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
    elementsSnapshot.current = elements; // Capture state before any modification
    
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
        if (!selectedIds.includes(clickedElement.id)) {
          setSelectedId(clickedElement.id);
          setSelectedIds([clickedElement.id]);
        }
        isDragging.current = true;
        dragStartPos.current = { x, y };
        
        const currentSelected = selectedIds.includes(clickedElement.id) ? selectedIds : [clickedElement.id];
        const newOffsets = {};
        currentSelected.forEach(id => {
          const el = elements.find(e => e.id === id);
          if (el) {
            newOffsets[id] = { x: el.x, y: el.y, points: el.points ? el.points.map(p => ({...p})) : null };
          }
        });
        startOffsets.current = newOffsets;
      } else {
        setSelectedId(null);
        setSelectedIds([]);
        setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
      }
    } else {
      isDrawing.current = true;
      setSelectedId(null);
      setSelectedIds([]);
      
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
        points: currentTool === 'pen' ? [{ x, y }] : undefined,
      };
      
      if (currentTool === 'text') {
        addElement(newElement);
        setSelectedId(newElement.id);
        setSelectedIds([newElement.id]);
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
    
    if (currentTool === 'select' && isDragging.current && Object.keys(startOffsets.current).length > 0) {
      const dx = x - dragStartPos.current.x;
      const dy = y - dragStartPos.current.y;
      
      const updatedElements = [];
      Object.keys(startOffsets.current).forEach(id => {
        const el = elements.find(e => e.id === id);
        if (el) {
          const offset = startOffsets.current[id];
          const newEl = { ...el, x: offset.x + dx, y: offset.y + dy };
          if (el.type === 'path' && offset.points) {
            newEl.points = offset.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
          }
          updatedElements.push(newEl);
        }
      });
      
      if (updatedElements.length > 0) {
        if (updateElementsBulk && updatedElements.length > 1) {
          updateElementsBulk(updatedElements);
        } else {
          updateElement(updatedElements[0]);
        }
      }
    } else if (currentTool === 'select' && marquee) {
      setMarquee(prev => ({ ...prev, currentX: x, currentY: y }));
    } else if (isDrawing.current && currentElement.current) {
      if (currentTool === 'pen') {
        currentElement.current.points.push({ x, y });
      } else {
        currentElement.current = {
          ...currentElement.current,
          width: x - currentElement.current.x,
          height: y - currentElement.current.y,
        };
      }
    }
  };

  // ── Pointer Up ───────────────────────────────────────────────
  const handlePointerUp = () => {
    if (isDraggingHandle.current) {
      if (saveHistory) saveHistory(elementsSnapshot.current);
      isDraggingHandle.current = false;
      return;
    }

    if (marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX);
      const maxX = Math.max(marquee.startX, marquee.currentX);
      const minY = Math.min(marquee.startY, marquee.currentY);
      const maxY = Math.max(marquee.startY, marquee.currentY);

      const selected = elements.filter(el => {
        let ex = el.x, ey = el.y, ew = el.width || 0, eh = el.height || 0;
        if (el.type === 'path' && el.points && el.points.length > 0) {
          const xs = el.points.map(p => p.x);
          const ys = el.points.map(p => p.y);
          ex = Math.min(...xs);
          ey = Math.min(...ys);
          ew = Math.max(...xs) - ex;
          eh = Math.max(...ys) - ey;
        }
        const elMinX = Math.min(ex, ex + ew);
        const elMaxX = Math.max(ex, ex + ew);
        const elMinY = Math.min(ey, ey + eh);
        const elMaxY = Math.max(ey, ey + eh);
        return !(elMaxX < minX || elMinX > maxX || elMaxY < minY || elMinY > maxY);
      });

      if (selected.length > 0) {
        const ids = selected.map(s => s.id);
        setSelectedIds(ids);
        setSelectedId(ids[0]); // fallback for single-select UI
      } else {
        setSelectedIds([]);
        setSelectedId(null);
      }
      setMarquee(null);
    } else if (isDrawing.current && currentElement.current) {
      const el = currentElement.current;
      if (el.type === 'pen' || Math.abs(el.width) > 5 || Math.abs(el.height) > 5 || el.type === 'text') {
        if (saveHistory) saveHistory(elementsSnapshot.current);
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
        if (currentTool !== 'pen') {
          setSelectedId(finalEl.id);
          setSelectedIds([finalEl.id]);
        }
      }
      isDrawing.current = false;
      currentElement.current = null;
    } else if (isDragging.current) {
      if (saveHistory) saveHistory(elementsSnapshot.current);
      isDragging.current = false;
      startOffsets.current = {};
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
