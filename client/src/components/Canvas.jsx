import { useEffect } from 'react';
import { useCanvas } from '../hooks/useCanvas';
import { CursorOverlay } from './CursorOverlay';

export function Canvas({ elements, stateActions, registerCanvasAPI }) {
  // useCanvas now returns a single stable object (built with useRef internally)
  const api = useCanvas(elements, stateActions);
  const { activeUsers } = stateActions;

  // Register with parent once — the api object is stable and uses getters/setters
  // for live value access, so no re-registration is needed on re-renders.
  useEffect(() => {
    registerCanvasAPI(api);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — api is stable

  // Escape key: deselect + reset tool
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        api.setSelectedId(null);
        api.setSelectedIds([]);
        api.setCurrentTool('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas
        ref={api.canvasRef}
        className="w-full h-full cursor-crosshair touch-none absolute inset-0 z-0"
        onPointerDown={api.handlePointerDown}
        onPointerMove={api.handlePointerMove}
        onPointerUp={api.handlePointerUp}
        onPointerLeave={api.handlePointerUp}
      />
      <CursorOverlay activeUsers={activeUsers} />
    </div>
  );
}
