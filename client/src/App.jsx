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

      <StatusBar
        connected={connected}
        elementCount={elements.length}
        selectedId={selectedId}
        selectedCount={selectedIds.length}
        showPanelHint={!showPanel}
      />
    </div>
  );
}

export default App;
