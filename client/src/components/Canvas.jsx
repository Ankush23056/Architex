import { useEffect } from 'react';
import { useCanvas } from '../hooks/useCanvas';

export function Canvas({ elements, stateActions, registerCanvasAPI }) {
  const canvasApi = useCanvas(elements, stateActions);
  
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
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
