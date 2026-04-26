import { useEffect } from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { CursorOverlay } from './CursorOverlay';

export function Canvas({ elements, stateActions, registerCanvasAPI }) {
  const canvasApi = useCanvas(elements, stateActions);
  const { activeUsers } = stateActions;
  
  const {
    canvasRef,
    selectedId,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = canvasApi;

  // Provide the API to parent
  useEffect(() => {
    registerCanvasAPI(canvasApi);
  }, [canvasApi, registerCanvasAPI]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && e.target.tagName !== 'INPUT') {
          stateActions.deleteElement(selectedId);
          canvasApi.setSelectedId(null);
        }
      } else if (e.key === 'Escape') {
        canvasApi.setSelectedId(null);
        canvasApi.setCurrentTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, stateActions, canvasApi]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none absolute inset-0 z-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <CursorOverlay activeUsers={activeUsers} />
    </div>
  );
}
