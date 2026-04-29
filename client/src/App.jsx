import { useState, useEffect, useCallback, useRef } from 'react';
import { useWhiteboardState } from './state/useWhiteboardState';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';
import { cleanupMess } from './utils/cleanupUtils';

function App() {
  const stateActions = useWhiteboardState();
  const { elements, connected, addElement, updateElement, updateElementsBulk, deleteElement, deleteElementsBulk, bringToFront, sendToBack, saveHistory, undo, redo, canUndo, canRedo } = stateActions;

  // canvasApiRef holds the live canvas API without triggering renders
  const canvasApiRef = useRef(null);
  // Reactive shadow state — updated only when selection actually changes
  const [selectedId, setSelectedId]       = useState(null);
  const [selectedIds, setSelectedIds]     = useState([]);
  const [currentTool, setCurrentTool]     = useState('select');
  const [currentColor, setCurrentColor]   = useState('#39FF14');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [showPanel, setShowPanel]         = useState(true);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [shareMsg, setShareMsg]           = useState(null);

  // Mouse Telemetry Hook
  useEffect(() => {
    const handleMouseMove = (e) => {
      const coords = document.getElementById('mouse-coords');
      if (coords) coords.innerText = `X: ${Math.round(e.clientX)} Y: ${Math.round(e.clientY)}`;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Shared Link Initialization
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('s');
    if (slug) {
      fetch(`http://localhost:3001/api/share/${slug}`)
        .then(res => res.json())
        .then(data => {
          if (data.elements) {
            stateActions.syncState(data.elements);
            setShareMsg('LOADED SHARED ARCHITECTURE');
            setTimeout(() => setShareMsg(null), 3000);
          }
        })
        .catch(err => console.error("Failed to load share:", err));
    }
  }, []); // Run once on mount

  // Handlers for Phase 7 Tools
  const handleShare = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: stateActions.elements })
      });
      const data = await res.json();
      if (data.slug) {
        const url = `${window.location.origin}/?s=${data.slug}`;
        await navigator.clipboard.writeText(url);
        setShareMsg('LINK COPIED: ' + url);
        setTimeout(() => setShareMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setShareMsg('SHARE FAILED');
      setTimeout(() => setShareMsg(null), 3000);
    }
  };

  const handleExportPng = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `architex-export-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Canvas calls this once with its stable API object
  const registerCanvasAPI = useCallback((api) => {
    canvasApiRef.current = api;

    // Wire up reactive mirrors — canvas API calls these to notify App
    api._onSelectedIdChange   = (id)  => setSelectedId(id);
    api._onSelectedIdsChange  = (ids) => setSelectedIds([...ids]);
    api._onToolChange         = (t)   => setCurrentTool(t);
    api._onColorChange        = (c)   => setCurrentColor(c);
    api._onStrokeChange       = (s)   => setCurrentStrokeWidth(s);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'h' || e.key === 'H') {
      setShowPanel(v => !v);
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      redo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const api = canvasApiRef.current;
      if (!api) return;
      const ids = api.selectedIds ?? [];
      if (ids.length > 0) {
        e.preventDefault();
        saveHistory(elements);
        ids.length === 1 ? deleteElement(ids[0]) : deleteElementsBulk(ids);
        api.setSelectedIds([]);
        api.setSelectedId(null);
      }
    }
  }, [undo, redo, elements, saveHistory, deleteElement, deleteElementsBulk]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Derive selected element for the Properties Panel
  const selectedElement = selectedId ? elements.find(e => e.id === selectedId) : null;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-surface">
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-40 mix-blend-overlay opacity-50" style={{
        backgroundImage: 'linear-gradient(transparent 50%, rgba(0, 0, 0, 0.4) 50%)',
        backgroundSize: '100% 4px'
      }} />

      {/* Top Banner Message */}
      {shareMsg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 panel-brutal !border-neon-cyan !bg-surface text-neon-cyan px-6 py-2 text-xs font-mono font-bold tracking-widest animate-pulse-neon shadow-lg">
          {shareMsg}
        </div>
      )}

      {/* Purge Modal */}
      {showPurgeModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto select-none">
          <div className="panel-brutal p-8 flex flex-col items-center gap-6 border-2 !border-[#FF00FF]">
            <h2 className="text-[#FF00FF] font-mono text-xl tracking-widest uppercase font-bold animate-pulse">Warning: Permanent Architecture Delete?</h2>
            <div className="flex gap-8 mt-4">
              <button className="btn-brutal px-8 py-3 text-neon-green hover:bg-neon-green/20" onClick={() => setShowPurgeModal(false)}>
                [NO] ABORT
              </button>
              <button className="btn-brutal px-8 py-3 text-[#FF00FF] !border-[#FF00FF] hover:bg-[#FF00FF]/20" onClick={() => {
                stateActions.wipeCanvas();
                setShowPurgeModal(false);
              }}>
                [YES] PURGE
              </button>
            </div>
          </div>
        </div>
      )}

      <Canvas
        elements={elements}
        stateActions={stateActions}
        registerCanvasAPI={registerCanvasAPI}
      />

      <Toolbar
        currentTool={currentTool}
        setCurrentTool={(t) => { canvasApiRef.current?.setCurrentTool(t); setCurrentTool(t); }}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <PropertiesPanel
        visible={showPanel}
        elements={elements}
        selectedElement={selectedElement}
        selectedIds={selectedIds}
        updateElement={updateElement}
        updateElementsBulk={updateElementsBulk}
        addElement={addElement}
        saveHistory={saveHistory}
        bringToFront={(id) => { saveHistory(elements); bringToFront(id); }}
        sendToBack={(id) => { saveHistory(elements); sendToBack(id); }}
        deleteElement={(id) => {
          saveHistory(elements);
          const ids = canvasApiRef.current?.selectedIds ?? [];
          if (ids.length > 1) deleteElementsBulk(ids);
          else deleteElement(id);
          canvasApiRef.current?.setSelectedIds([]);
          canvasApiRef.current?.setSelectedId(null);
        }}
        currentColor={currentColor}
        setCurrentColor={(c) => { canvasApiRef.current?.setCurrentColor(c); setCurrentColor(c); }}
        currentStrokeWidth={currentStrokeWidth}
        setCurrentStrokeWidth={(s) => { canvasApiRef.current?.setCurrentStrokeWidth(s); setCurrentStrokeWidth(s); }}
      />

      {/* Bottom Left: HUD & System Operations */}
      <div className="absolute bottom-4 left-4 flex items-end gap-2 z-10">
        <StatusBar
          connected={connected}
          elementCount={elements.length}
          selectedId={selectedId}
          selectedCount={selectedIds.length}
          showPanelHint={!showPanel}
        />
        
        {/* SYSTEM OPERATIONS */}
        <div className="panel-brutal !p-1 flex gap-[6.5px] border-b-4 !border-b-[#FF00FF]">
          <button
            title="Share Board"
            className="btn-brutal flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] p-0 hover:text-neon-green hover:border-neon-green"
            onClick={handleShare}
          >
            <span className="text-base leading-none">↗</span>
            <span className="text-[9px] uppercase tracking-widest opacity-70">Share</span>
          </button>
          <button
            title="Export PNG"
            className="btn-brutal flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] p-0 hover:text-neon-cyan hover:border-neon-cyan"
            onClick={handleExportPng}
          >
            <span className="text-base leading-none">⤓</span>
            <span className="text-[9px] uppercase tracking-widest opacity-70">Export</span>
          </button>
          <button
            title="Wipe Canvas"
            className="btn-brutal flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] p-0 text-[#FF00FF] border-[#FF00FF] hover:bg-[#FF00FF]/20"
            onClick={() => setShowPurgeModal(true)}
          >
            <span className="text-base leading-none font-bold">☠</span>
            <span className="text-[9px] uppercase tracking-widest opacity-70">Purge</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
