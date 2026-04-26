import { useState, useRef, useEffect, useCallback } from 'react';

const PANEL_STORAGE_KEY = 'architex_panel_pos';
const DEFAULT_POS = { x: window.innerWidth - 280, y: 16 };

function loadPos() {
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return DEFAULT_POS;
}

export function PropertiesPanel({
  selectedElement,
  updateElement,
  bringToFront,
  sendToBack,
  deleteElement,
  currentColor,
  setCurrentColor,
  currentStrokeWidth,
  setCurrentStrokeWidth,
  visible,
}) {
  const [pos, setPos] = useState(loadPos);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const panelRef = useRef(null);

  const colors = ['#39FF14', '#00FFFF', '#FF00FF', '#FFE600', '#FF4500', '#FFFFFF'];

  // ── Drag logic ──────────────────────────────────────────────
  const onHeaderMouseDown = useCallback((e) => {
    e.preventDefault();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    };

    const onMove = (me) => {
      if (!dragRef.current.active) return;
      const nx = dragRef.current.originX + (me.clientX - dragRef.current.startX);
      const ny = dragRef.current.originY + (me.clientY - dragRef.current.startY);
      // Clamp inside viewport
      const clamped = {
        x: Math.max(0, Math.min(window.innerWidth - 260, nx)),
        y: Math.max(0, Math.min(window.innerHeight - 48, ny)),
      };
      setPos(clamped);
    };

    const onUp = () => {
      dragRef.current.active = false;
      setPos(prev => {
        localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos.x, pos.y]);

  // ── Color / stroke handlers ─────────────────────────────────
  const handleColorChange = (color) => {
    setCurrentColor(color);
    if (selectedElement) updateElement({ ...selectedElement, color });
  };

  const handleStrokeChange = (width) => {
    setCurrentStrokeWidth(width);
    if (selectedElement) updateElement({ ...selectedElement, strokeWidth: width });
  };

  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      className="absolute z-20 w-64 select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* ── Header / drag handle ── */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-surface-2 border-2 border-border-brutal cursor-grab active:cursor-grabbing"
        onMouseDown={onHeaderMouseDown}
        style={{ borderBottom: isMinimized ? '' : 'none' }}
      >
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-neon-green">
          ⬡ Properties
        </span>
        <div className="flex gap-1" onMouseDown={e => e.stopPropagation()}>
          <button
            title="Minimize"
            className="w-5 h-5 text-xs font-bold border border-border-brutal hover:border-neon-green hover:text-neon-green flex items-center justify-center transition-colors"
            onClick={() => setIsMinimized(v => !v)}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {!isMinimized && (
        <div
          className="border-2 border-border-brutal border-t-0 p-4 flex flex-col gap-4"
          style={{
            background: 'rgba(10,10,10,0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* No selection placeholder */}
          {!selectedElement && (
            <p className="text-xs font-mono text-center opacity-40 py-2 border border-dashed border-border-brutal">
              No element selected
            </p>
          )}

          {/* Color palette */}
          <div>
            <label className="block text-xs font-mono mb-2 opacity-60 uppercase tracking-widest">Color</label>
            <div className="flex gap-1.5 flex-wrap">
              {colors.map(c => (
                <button
                  key={c}
                  title={c}
                  className="w-7 h-7 border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: (selectedElement?.color || currentColor) === c ? '#fff' : '#333',
                    boxShadow: (selectedElement?.color || currentColor) === c ? `0 0 8px ${c}` : 'none',
                  }}
                  onClick={() => handleColorChange(c)}
                />
              ))}
            </div>
          </div>

          {/* Stroke width */}
          <div>
            <label className="block text-xs font-mono mb-2 opacity-60 uppercase tracking-widest">
              Stroke — {selectedElement?.strokeWidth || currentStrokeWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="20"
              className="w-full accent-neon-green"
              value={selectedElement?.strokeWidth || currentStrokeWidth}
              onChange={(e) => handleStrokeChange(Number(e.target.value))}
            />
          </div>

          {/* Text editing */}
          {selectedElement?.type === 'text' && (
            <div>
              <label className="block text-xs font-mono mb-2 opacity-60 uppercase tracking-widest">Text Content</label>
              <input
                type="text"
                className="w-full bg-surface-2 border-2 border-border-brutal p-2 text-white font-mono text-sm outline-none focus:border-neon-green transition-colors"
                value={selectedElement.text || ''}
                onChange={(e) => updateElement({ ...selectedElement, text: e.target.value })}
              />
            </div>
          )}

          {/* Curve hint */}
          {selectedElement?.type === 'curve' && (
            <p className="text-xs font-mono opacity-40 border border-dashed border-border-brutal p-2">
              Drag the ● handle on the canvas to bend the curve
            </p>
          )}

          {/* Z-index & Delete */}
          {selectedElement && (
            <div className="flex flex-col gap-2 pt-3 border-t border-border-brutal">
              <div className="flex gap-2">
                <button
                  className="btn-brutal flex-1 text-xs py-1.5"
                  onClick={() => bringToFront(selectedElement.id)}
                >
                  ↑ Front
                </button>
                <button
                  className="btn-brutal flex-1 text-xs py-1.5"
                  onClick={() => sendToBack(selectedElement.id)}
                >
                  ↓ Back
                </button>
              </div>
              <button
                className="btn-brutal text-xs py-1.5 !border-[#FF00FF] !text-[#FF00FF] hover:!bg-[#FF00FF] hover:!text-black"
                onClick={() => deleteElement(selectedElement.id)}
              >
                ✕ Delete Element
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
