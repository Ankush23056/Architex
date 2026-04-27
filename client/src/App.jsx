import { useState, useEffect, useCallback } from 'react';
import { useWhiteboardState } from './state/useWhiteboardState';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';
import { cleanupMess } from './utils/cleanupUtils';

function App() {
  const stateActions = useWhiteboardState();
  const { elements, connected, addElement, updateElement, updateElementsBulk, deleteElement, bringToFront, sendToBack, saveHistory, undo, redo, canUndo, canRedo } = stateActions;
  
  const [canvasApi, setCanvasApi] = useState(null);
  const [showPanel, setShowPanel] = useState(true);

  // H key toggles Properties Panel, Ctrl+Z/Y for Undo/Redo
  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'h' || e.key === 'H') {
      setShowPanel(v => !v);
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      redo();
    }
  }, [undo, redo]);

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
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      )}

      <PropertiesPanel
        visible={showPanel}
        elements={elements}
        selectedElement={selectedElement}
        updateElement={updateElement}
        updateElementsBulk={updateElementsBulk}
        addElement={addElement}
        saveHistory={saveHistory}
        bringToFront={(id) => {
          saveHistory(elements);
          bringToFront(id);
        }}
        sendToBack={(id) => {
          saveHistory(elements);
          sendToBack(id);
        }}
        deleteElement={(id) => {
          saveHistory(elements);
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
    </div>
  );
}

export default App;
