import { useState, useEffect, useCallback } from 'react';
import { useWhiteboardState } from './state/useWhiteboardState';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';
import { cleanupMess } from './utils/cleanupUtils';

function App() {
  const stateActions = useWhiteboardState();
  const { elements, connected, updateElement, updateElementsBulk, deleteElement, bringToFront, sendToBack } = stateActions;
  
  const [canvasApi, setCanvasApi] = useState(null);
  const [showPanel, setShowPanel] = useState(true);

  // H key toggles Properties Panel
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'h' || e.key === 'H') {
      if (e.target.tagName !== 'INPUT') {
        setShowPanel(v => !v);
      }
    }
  }, []);

  // Register H key globally
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedElement = canvasApi?.selectedId
    ? elements.find(e => e.id === canvasApi.selectedId)
    : null;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-surface">
      <Canvas 
        elements={elements} 
        stateActions={stateActions} 
        registerCanvasAPI={setCanvasApi}
      />
      
      {canvasApi && (
        <Toolbar 
          currentTool={canvasApi.currentTool} 
          setCurrentTool={canvasApi.setCurrentTool} 
        />
      )}

      <PropertiesPanel
        visible={showPanel}
        selectedElement={selectedElement}
        updateElement={updateElement}
        bringToFront={bringToFront}
        sendToBack={sendToBack}
        deleteElement={(id) => {
          deleteElement(id);
          canvasApi?.setSelectedId(null);
        }}
        currentColor={canvasApi?.currentColor ?? '#39FF14'}
        setCurrentColor={canvasApi?.setCurrentColor ?? (() => {})}
        currentStrokeWidth={canvasApi?.currentStrokeWidth ?? 2}
        setCurrentStrokeWidth={canvasApi?.setCurrentStrokeWidth ?? (() => {})}
      />

      <StatusBar 
        connected={connected} 
        elementCount={elements.length} 
        selectedId={canvasApi?.selectedId}
        showPanelHint={!showPanel}
      />

      <button 
        className="absolute bottom-4 right-4 btn-brutal !bg-neon-magenta !text-black !border-black hover:!bg-neon-cyan shadow-brutal flex items-center gap-2 z-20"
        title="Mess Clean-up: Grid Snap, Align, Space"
        onClick={() => {
          if (elements.length > 0) {
            const cleaned = cleanupMess(elements);
            updateElementsBulk(cleaned);
          }
        }}
      >
        <span className="text-xl">✨</span> Magic Wand
      </button>
    </div>
  );
}

export default App;
