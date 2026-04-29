import { useRef, useEffect, useCallback, useMemo } from 'react';
import { drawElement, drawCurveHandle, isPointInElement, isPointNearCurveHandle } from '../utils/drawingUtils';

// ── Constants ────────────────────────────────────────────────────
const GRID_SIZE = 20;
const ALIGN_THRESHOLD = 5;

// ── Helpers ──────────────────────────────────────────────────────
const snapToGrid = (v) => Math.round(v / GRID_SIZE) * GRID_SIZE;
const snapPos = (x, y) => ({ x: snapToGrid(x), y: snapToGrid(y) });

function drawGrid(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let x = 0; x <= width; x += GRID_SIZE) {
    for (let y = 0; y <= height; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function computeGuides(movingEl, allElements, movingIds) {
  const guides = [];
  if (!movingEl) return guides;
  const { x: mx, y: my } = movingEl;
  const mw = movingEl.width || 0;
  const mh = movingEl.height || 0;
  const edgesX = [mx, mx + mw, mx + mw / 2];
  const edgesY = [my, my + mh, my + mh / 2];

  allElements.filter(el => !movingIds.includes(el.id)).forEach(el => {
    let ex = el.x, ey = el.y, ew = el.width || 0, eh = el.height || 0;
    if (el.type === 'path' && el.points?.length > 0) {
      const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y);
      ex = Math.min(...xs); ey = Math.min(...ys);
      ew = Math.max(...xs) - ex; eh = Math.max(...ys) - ey;
    }
    const cEdgesX = [ex, ex + ew, ex + ew / 2];
    const cEdgesY = [ey, ey + eh, ey + eh / 2];

    cEdgesX.forEach(cx => {
      edgesX.forEach(mx2 => {
        if (Math.abs(mx2 - cx) <= ALIGN_THRESHOLD) {
          if (!guides.some(g => g.type === 'v' && Math.abs(g.value - cx) < 1))
            guides.push({ type: 'v', value: cx });
        }
      });
    });
    cEdgesY.forEach(cy => {
      edgesY.forEach(my2 => {
        if (Math.abs(my2 - cy) <= ALIGN_THRESHOLD) {
          if (!guides.some(g => g.type === 'h' && Math.abs(g.value - cy) < 1))
            guides.push({ type: 'h', value: cy });
        }
      });
    });
  });
  return guides;
}

function drawGuides(ctx, guides, width, height) {
  if (!guides?.length) return;
  ctx.save();
  ctx.strokeStyle = '#BF00FF';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  guides.forEach(g => {
    ctx.beginPath();
    if (g.type === 'v') { ctx.moveTo(g.value, 0); ctx.lineTo(g.value, height); }
    else { ctx.moveTo(0, g.value); ctx.lineTo(width, g.value); }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Main Hook ────────────────────────────────────────────────────
export function useCanvas(elements, { addElement, updateElement, updateElementsBulk, broadcastCursor, saveHistory }) {
  const canvasRef = useRef(null);

  // ── All mutable state lives in refs — zero React re-renders from this hook ──
  const selectedIdRef   = useRef(null);
  const selectedIdsRef  = useRef([]);
  const marqueeRef      = useRef(null);
  const currentToolRef  = useRef('select');
  const currentColorRef = useRef('#39FF14');
  const currentStrokeWidthRef = useRef(2);

  // Operational refs
  const isDrawing        = useRef(false);
  const isDragging       = useRef(false);
  const isDraggingHandle = useRef(false);
  const currentElement   = useRef(null);
  const dragStartPos     = useRef({ x: 0, y: 0 });
  const currentPointer   = useRef({ x: 0, y: 0 });
  const startOffsets     = useRef({});
  const lastCursorSend   = useRef(0);
  const elementsSnapshot = useRef(null);
  const guidesRef        = useRef([]);
  const elementsRef      = useRef(elements);

  // Callbacks registered by parent (App.jsx) for reactive updates
  const onSelectedIdChange   = useRef(null);
  const onSelectedIdsChange  = useRef(null);
  const onToolChange         = useRef(null);
  const onColorChange        = useRef(null);
  const onStrokeChange       = useRef(null);

  // Keep elements ref in sync
  useEffect(() => { elementsRef.current = elements; }, [elements]);

  // ── Setters (read by parent via stable API object) ─────────────
  const setSelectedId = useCallback((id) => {
    selectedIdRef.current = id;
    onSelectedIdChange.current?.(id);
  }, []);

  const setSelectedIds = useCallback((ids) => {
    selectedIdsRef.current = ids;
    onSelectedIdsChange.current?.(ids);
  }, []);

  const setCurrentTool = useCallback((t) => {
    currentToolRef.current = t;
    onToolChange.current?.(t);
  }, []);

  const setCurrentColor = useCallback((c) => {
    currentColorRef.current = c;
    onColorChange.current?.(c);
  }, []);

  const setCurrentStrokeWidth = useCallback((s) => {
    currentStrokeWidthRef.current = s;
    onStrokeChange.current?.(s);
  }, []);

  // ── Render loop (single persistent rAF) ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animFrameId;

    const render = () => {
      const els    = elementsRef.current;
      const selId  = selectedIdRef.current;
      const selIds = selectedIdsRef.current;
      const mq     = marqueeRef.current;
      const guides = guidesRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid(ctx, canvas.width, canvas.height);

      const sorted = [...els].sort((a, b) => a.zIndex - b.zIndex);

      sorted.forEach(el => {
        let renderEl = el;

        if (isDragging.current && startOffsets.current[el.id]) {
          const dx = currentPointer.current.x - dragStartPos.current.x;
          const dy = currentPointer.current.y - dragStartPos.current.y;
          const off = startOffsets.current[el.id];
          const { x: sx, y: sy } = snapPos(off.x + dx, off.y + dy);
          renderEl = { ...el, x: sx, y: sy };
          if (el.type === 'path' && off.points) {
            const sdx = sx - off.x, sdy = sy - off.y;
            renderEl.points = off.points.map(p => ({ x: p.x + sdx, y: p.y + sdy }));
          }
        }

        drawElement(ctx, renderEl);

        // Selection outline
        if (renderEl.id === selId || selIds.includes(renderEl.id)) {
          if (renderEl.type === 'curve' && renderEl.id === selId) {
            drawCurveHandle(ctx, renderEl);
          } else {
            ctx.save();
            ctx.strokeStyle = selIds.length > 1 ? '#39FF14' : '#FF00FF';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            const pad = 5;
            if (renderEl.type === 'path' && renderEl.points?.length > 0) {
              const xs = renderEl.points.map(p => p.x), ys = renderEl.points.map(p => p.y);
              const bx = Math.min(...xs), by = Math.min(...ys);
              const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
              ctx.strokeRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
            } else if (renderEl.type === 'text') {
              ctx.strokeRect(renderEl.x - pad, renderEl.y - pad,
                (renderEl.text.length * renderEl.strokeWidth * 6) + pad * 2,
                (renderEl.strokeWidth * 12) + pad * 2);
            } else {
              const bx = Math.min(renderEl.x, renderEl.x + (renderEl.width || 0));
              const by = Math.min(renderEl.y, renderEl.y + (renderEl.height || 0));
              ctx.strokeRect(bx - pad, by - pad, Math.abs(renderEl.width || 0) + pad * 2, Math.abs(renderEl.height || 0) + pad * 2);
            }
            ctx.restore();
          }
        }
      });

      // Group bounding box
      if (selIds.length > 1) {
        let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
        selIds.forEach(id => {
          let el = els.find(e => e.id === id);
          if (!el) return;
          if (isDragging.current && startOffsets.current[el.id]) {
            const dx = currentPointer.current.x - dragStartPos.current.x;
            const dy = currentPointer.current.y - dragStartPos.current.y;
            const off = startOffsets.current[el.id];
            const { x: sx, y: sy } = snapPos(off.x + dx, off.y + dy);
            el = { ...el, x: sx, y: sy };
          }
          const ex = el.x, ey = el.y;
          const ew = el.type === 'path' && el.points?.length ? Math.max(...el.points.map(p => p.x)) - Math.min(...el.points.map(p => p.x)) : (el.width || 0);
          const eh = el.type === 'path' && el.points?.length ? Math.max(...el.points.map(p => p.y)) - Math.min(...el.points.map(p => p.y)) : (el.height || 0);
          gMinX = Math.min(gMinX, Math.min(ex, ex + ew));
          gMinY = Math.min(gMinY, Math.min(ey, ey + eh));
          gMaxX = Math.max(gMaxX, Math.max(ex, ex + ew));
          gMaxY = Math.max(gMaxY, Math.max(ey, ey + eh));
        });
        if (gMinX !== Infinity) {
          ctx.save();
          ctx.strokeStyle = '#39FF14';
          ctx.setLineDash([8, 8]);
          ctx.lineWidth = 2;
          ctx.strokeRect(gMinX - 10, gMinY - 10, (gMaxX - gMinX) + 20, (gMaxY - gMinY) + 20);
          ctx.restore();
        }
      }

      // Marquee (lime green)
      if (mq) {
        ctx.save();
        ctx.fillStyle = 'rgba(50,205,50,0.08)';
        ctx.strokeStyle = '#32CD32';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.5;
        ctx.fillRect(mq.startX, mq.startY, mq.currentX - mq.startX, mq.currentY - mq.startY);
        ctx.strokeRect(mq.startX, mq.startY, mq.currentX - mq.startX, mq.currentY - mq.startY);
        ctx.restore();
      }

      // In-progress drawing
      if (isDrawing.current && currentElement.current) drawElement(ctx, currentElement.current);

      // Alignment guides
      drawGuides(ctx, guides, canvas.width, canvas.height);

      animFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrameId);
  }, []); // single mount — reads everything from refs

  // ── Canvas resize ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── Pointer Down ─────────────────────────────────────────────
  const handlePointerDown = (e) => {
    const { x, y } = getMousePos(e);
    currentPointer.current = { x, y };
    elementsSnapshot.current = elementsRef.current;
    guidesRef.current = [];

    if (currentToolRef.current === 'select') {
      const sorted = [...elementsRef.current].sort((a, b) => b.zIndex - a.zIndex);

      // Curve handle check
      if (selectedIdRef.current) {
        const selEl = elementsRef.current.find(el => el.id === selectedIdRef.current);
        if (selEl?.type === 'curve' && isPointNearCurveHandle(x, y, selEl)) {
          isDraggingHandle.current = true;
          return;
        }
      }

      const clicked = sorted.find(el => {
        if (el.type === 'text') {
          const w = el.text.length * el.strokeWidth * 6, h = el.strokeWidth * 12;
          return x >= el.x && x <= el.x + w && y >= el.y && y <= el.y + h;
        }
        return isPointInElement(x, y, el);
      });

      if (clicked) {
        if (!selectedIdsRef.current.includes(clicked.id)) {
          setSelectedId(clicked.id);
          setSelectedIds([clicked.id]);
        }
        isDragging.current = true;
        dragStartPos.current = { x, y };

        const group = selectedIdsRef.current.includes(clicked.id) ? selectedIdsRef.current : [clicked.id];
        const offsets = {};
        group.forEach(id => {
          const el = elementsRef.current.find(e => e.id === id);
          if (el) offsets[id] = { x: el.x, y: el.y, points: el.points?.map(p => ({ ...p })) ?? null };
        });
        startOffsets.current = offsets;
      } else {
        setSelectedId(null);
        setSelectedIds([]);
        marqueeRef.current = { startX: x, startY: y, currentX: x, currentY: y };
      }
    } else {
      isDrawing.current = true;
      setSelectedId(null);
      setSelectedIds([]);

      const { x: sx, y: sy } = snapPos(x, y);
      const tool = currentToolRef.current;
      const newEl = {
        id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: tool === 'pen' ? 'path' : tool,
        x: sx, y: sy, width: 0, height: 0,
        color: currentColorRef.current,
        strokeWidth: currentStrokeWidthRef.current,
        zIndex: elementsRef.current.length > 0 ? Math.max(...elementsRef.current.map(e => e.zIndex)) + 1 : 0,
        text: tool === 'text' ? 'New Text' : undefined,
        controlPoint: tool === 'curve' ? { x: sx, y: sy } : undefined,
        points: tool === 'pen' ? [{ x: sx, y: sy }] : undefined,
      };

      if (tool === 'text') {
        addElement(newEl);
        setSelectedId(newEl.id);
        setSelectedIds([newEl.id]);
        setCurrentTool('select');
        isDrawing.current = false;
      } else {
        currentElement.current = newEl;
      }
    }
  };

  // ── Pointer Move ─────────────────────────────────────────────
  const handlePointerMove = (e) => {
    const { x, y } = getMousePos(e);
    currentPointer.current = { x, y };

    const now = Date.now();
    if (now - lastCursorSend.current > 33) {
      if (broadcastCursor) broadcastCursor(x, y, currentColorRef.current);
      lastCursorSend.current = now;
    }

    if (isDraggingHandle.current && selectedIdRef.current) {
      const el = elementsRef.current.find(el => el.id === selectedIdRef.current);
      if (el) updateElement({ ...el, controlPoint: { x, y } });
      return;
    }

    if (currentToolRef.current === 'select' && isDragging.current) {
      // Compute alignment guides for primary dragged element
      const primaryId = Object.keys(startOffsets.current)[0];
      if (primaryId) {
        const off = startOffsets.current[primaryId];
        const dx = x - dragStartPos.current.x, dy = y - dragStartPos.current.y;
        const { x: sx, y: sy } = snapPos(off.x + dx, off.y + dy);
        const primaryEl = elementsRef.current.find(e => e.id === primaryId);
        if (primaryEl) {
          guidesRef.current = computeGuides(
            { ...primaryEl, x: sx, y: sy },
            elementsRef.current,
            Object.keys(startOffsets.current)
          );
        }
      }
    } else if (currentToolRef.current === 'select' && marqueeRef.current) {
      marqueeRef.current = { ...marqueeRef.current, currentX: x, currentY: y };
    } else if (isDrawing.current && currentElement.current) {
      if (currentToolRef.current === 'pen') {
        const last = currentElement.current.points[currentElement.current.points.length - 1];
        if (Math.hypot(x - last.x, y - last.y) > 3)
          currentElement.current.points.push({ x, y });
      } else {
        const { x: sx, y: sy } = snapPos(x, y);
        currentElement.current = {
          ...currentElement.current,
          width: sx - currentElement.current.x,
          height: sy - currentElement.current.y,
        };
      }
    }
  };

  // ── Pointer Up ───────────────────────────────────────────────
  const handlePointerUp = () => {
    guidesRef.current = [];

    if (isDraggingHandle.current) {
      if (saveHistory) saveHistory(elementsSnapshot.current);
      isDraggingHandle.current = false;
      return;
    }

    const mq = marqueeRef.current;
    if (mq) {
      marqueeRef.current = null;
      const minX = Math.min(mq.startX, mq.currentX), maxX = Math.max(mq.startX, mq.currentX);
      const minY = Math.min(mq.startY, mq.currentY), maxY = Math.max(mq.startY, mq.currentY);

      const hit = elementsRef.current.filter(el => {
        let ex = el.x, ey = el.y, ew = el.width || 0, eh = el.height || 0;
        if (el.type === 'path' && el.points?.length > 0) {
          const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y);
          ex = Math.min(...xs); ey = Math.min(...ys);
          ew = Math.max(...xs) - ex; eh = Math.max(...ys) - ey;
        }
        return Math.min(ex, ex + ew) >= minX && Math.max(ex, ex + ew) <= maxX &&
               Math.min(ey, ey + eh) >= minY && Math.max(ey, ey + eh) <= maxY;
      });

      const ids = hit.map(s => s.id);
      setSelectedIds(ids);
      setSelectedId(ids[0] ?? null);
      return;
    }

    if (isDrawing.current && currentElement.current) {
      const el = currentElement.current;
      if (el.type === 'path' || Math.abs(el.width) > 5 || Math.abs(el.height) > 5) {
        if (saveHistory) saveHistory(elementsSnapshot.current);
        const finalEl = el.type === 'curve'
          ? { ...el, controlPoint: { x: el.x + el.width / 2, y: el.y + el.height / 2 - 60 } }
          : el;
        addElement(finalEl);
        if (currentToolRef.current !== 'pen') {
          setSelectedId(finalEl.id);
          setSelectedIds([finalEl.id]);
        }
      }
      isDrawing.current = false;
      currentElement.current = null;
      return;
    }

    if (isDragging.current) {
      if (saveHistory) saveHistory(elementsSnapshot.current);
      const dx = currentPointer.current.x - dragStartPos.current.x;
      const dy = currentPointer.current.y - dragStartPos.current.y;

      const updated = [];
      Object.keys(startOffsets.current).forEach(id => {
        const el = elementsRef.current.find(e => e.id === id);
        if (!el) return;
        const off = startOffsets.current[id];
        const { x: sx, y: sy } = snapPos(off.x + dx, off.y + dy);
        const newEl = { ...el, x: sx, y: sy };
        if (el.type === 'path' && off.points) {
          const sdx = sx - off.x, sdy = sy - off.y;
          newEl.points = off.points.map(p => ({ x: p.x + sdx, y: p.y + sdy }));
        }
        updated.push(newEl);
      });

      if (updated.length > 0) {
        updateElementsBulk && updated.length > 1 ? updateElementsBulk(updated) : updateElement(updated[0]);
      }

      isDragging.current = false;
      startOffsets.current = {};
    }
  };

  // ── Stable API object ─────────────────────────────────────────
  // useMemo with [] so the object is created exactly once.
  // Function slots (handlePointer*) are updated on every render below
  // so they always hold the latest closures.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const api = useMemo(() => Object.defineProperties({}, {
    canvasRef:           { value: canvasRef, enumerable: true },
    setSelectedId:       { value: setSelectedId, enumerable: true },
    setSelectedIds:      { value: setSelectedIds, enumerable: true },
    setCurrentTool:      { value: setCurrentTool, enumerable: true },
    setCurrentColor:     { value: setCurrentColor, enumerable: true },
    setCurrentStrokeWidth: { value: setCurrentStrokeWidth, enumerable: true },
    // Mutable function slots — updated after memo below
    handlePointerDown:   { value: null, writable: true, enumerable: true },
    handlePointerMove:   { value: null, writable: true, enumerable: true },
    handlePointerUp:     { value: null, writable: true, enumerable: true },
    // Live-ref getters
    selectedId:          { get: () => selectedIdRef.current, enumerable: true },
    selectedIds:         { get: () => selectedIdsRef.current, enumerable: true },
    currentTool:         { get: () => currentToolRef.current, enumerable: true },
    currentColor:        { get: () => currentColorRef.current, enumerable: true },
    currentStrokeWidth:  { get: () => currentStrokeWidthRef.current, enumerable: true },
    // Parent notification setters
    _onSelectedIdChange:  { set: (fn) => { onSelectedIdChange.current = fn; } },
    _onSelectedIdsChange: { set: (fn) => { onSelectedIdsChange.current = fn; } },
    _onToolChange:        { set: (fn) => { onToolChange.current = fn; } },
    _onColorChange:       { set: (fn) => { onColorChange.current = fn; } },
    _onStrokeChange:      { set: (fn) => { onStrokeChange.current = fn; } },
  }), []); // eslint-disable-line

  // Refresh function slots every render (closures must be current)
  api.handlePointerDown = handlePointerDown;
  api.handlePointerMove = handlePointerMove;
  api.handlePointerUp   = handlePointerUp;

  return api;
}
