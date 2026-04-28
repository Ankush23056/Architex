import { useState, useRef, useEffect, useCallback } from 'react';
import { cleanupMess } from '../utils/cleanupUtils';

const PANEL_STORAGE_KEY = 'architex_panel_pos';
const DEFAULT_POS = { x: window.innerWidth - 280, y: 16 };

function loadPos() {
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return DEFAULT_POS;
}

function useScramble(text, active) {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setDisplayText(text);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
    intervalRef.current = setInterval(() => {
      setDisplayText(
        text.split('').map(c => c === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)]).join('')
      );
    }, 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]); // only re-run when active changes, not on every render

  return displayText;
}

export function PropertiesPanel({
  elements,
  selectedElement,
  updateElement,
  updateElementsBulk,
  addElement,
  saveHistory,
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

  // ── AI Analysis ─────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const scrambleText = useScramble('AI ANALYZE', isAnalyzing);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAiResult(null);
    setAiError('');
    try {
      console.log('[AI] Sending request to server with', elements.length, 'elements');
      const res = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements, context: 'MERN Stack Application' })
      });

      const data = await res.json();
      console.log('[AI] Server response:', res.status, data);

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status} ${res.statusText}`);
      }
      if (data.error) throw new Error(data.error);
      setAiResult(data);
    } catch (e) {
      console.error('[AI] Fetch failed:', e);
      setAiError(e.message || 'Failed to fetch. Is the server running on port 3001?');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddMissing = (compName) => {
    const newElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'text',
      x: window.innerWidth / 2 - 50,
      y: window.innerHeight / 2 - 20,
      width: 0,
      height: 0,
      color: '#00FFFF', // cyan for suggested components
      strokeWidth: 2,
      zIndex: elements.length > 0 ? Math.max(...elements.map(e => e.zIndex)) + 1 : 0,
      text: compName,
    };
    if (saveHistory) saveHistory(elements);
    addElement(newElement);
    
    setAiResult(prev => ({
      ...prev,
      missing: prev.missing.filter(m => m !== compName)
    }));
  };

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

          {/* ── Global Tools ── */}
          <div className="flex flex-col gap-2 pt-3 border-t border-border-brutal">
            <button 
              className="btn-brutal !bg-neon-magenta !text-black !border-black hover:!bg-neon-cyan shadow-brutal flex items-center justify-center gap-2"
              title="Mess Clean-up: Grid Snap, Align, Space"
              onClick={() => {
                if (elements.length > 0) {
                  if (saveHistory) saveHistory(elements);
                  const cleaned = cleanupMess(elements);
                  if (updateElementsBulk) updateElementsBulk(cleaned);
                }
              }}
            >
              <span>✨ Magic Wand</span>
            </button>

            <button
              className="btn-brutal !bg-groq-orange !text-black !border-black hover:!bg-neon-yellow shadow-brutal flex items-center justify-center gap-2"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              <span>🧠 {scrambleText}</span>
            </button>
          </div>

          {/* AI Feedback */}
          {aiError && (
            <div className="text-xs text-red-500 font-mono border border-red-500 p-2 bg-red-500/10">
              {aiError}
            </div>
          )}
          
          {aiResult && (
            <div className="flex flex-col gap-3 font-mono text-xs border border-groq-orange p-3 bg-groq-orange/10">
              <div className="text-groq-orange font-bold uppercase border-b border-groq-orange/30 pb-1">AI Analysis</div>
              
              {aiResult.analysis && aiResult.analysis.length > 0 && (
                <ul className="list-disc pl-4 space-y-1 opacity-90">
                  {aiResult.analysis.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              )}

              {aiResult.missing && aiResult.missing.length > 0 && (
                <div>
                  <div className="uppercase opacity-70 mb-2 mt-2">Suggested (Click to Add):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiResult.missing.map(m => (
                      <button
                        key={m}
                        className="bg-groq-orange/20 text-groq-orange border border-groq-orange/50 px-2 py-1 rounded-sm hover:bg-groq-orange hover:text-black transition-colors"
                        onClick={() => handleAddMissing(m)}
                      >
                        + {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
