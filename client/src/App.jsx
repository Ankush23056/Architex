import { useState } from 'react';
import { useWhiteboardState } from './state/useWhiteboardState';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';

function App() {
  const stateActions = useWhiteboardState();
  const { elements, connected, updateElement, deleteElement, bringToFront, sendToBack } = stateActions;
  
  const [canvasApi, setCanvasApi] = useState(null);

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
        <>
          <Toolbar 
            currentTool={canvasApi.currentTool} 
            setCurrentTool={canvasApi.setCurrentTool} 
          />
          
          <PropertiesPanel 
            selectedElement={selectedElement}
            updateElement={updateElement}
            bringToFront={bringToFront}
            sendToBack={sendToBack}
            deleteElement={(id) => {
               deleteElement(id);
               canvasApi.setSelectedId(null);
            }}
            currentColor={canvasApi.currentColor}
            setCurrentColor={canvasApi.setCurrentColor}
            currentStrokeWidth={canvasApi.currentStrokeWidth}
            setCurrentStrokeWidth={canvasApi.setCurrentStrokeWidth}
          />
        </>
      )}

      <StatusBar 
        connected={connected} 
        elementCount={elements.length} 
        selectedId={canvasApi?.selectedId} 
      />
    </div>
  );
}

export default App;
