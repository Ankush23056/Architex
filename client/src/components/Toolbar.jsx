export function Toolbar({ currentTool, setCurrentTool, undo, redo, canUndo, canRedo }) {
  const tools = [
    { id: 'select', label: 'Select', icon: '↖' },
    { id: 'rectangle', label: 'Rect', icon: '▭' },
    { id: 'circle', label: 'Circle', icon: '◯' },
    { id: 'line', label: 'Line', icon: '╱' },
    { id: 'arrow', label: 'Arrow', icon: '→' },
    { id: 'curve', label: 'CurveArr', icon: '⤵' },
    { id: 'text', label: 'Text', icon: 'T' },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
      
      {/* UNDO BUTTON */}
      <div className="panel-brutal border-b-4 !border-b-neon-green flex">
        <button 
          className="btn-brutal flex flex-col items-center gap-0.5 px-3 py-2 min-w-[52px]" 
          onClick={undo} 
          disabled={!canUndo}
          style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}
          title="Undo (Ctrl+Z)"
        >
          <span className="text-base leading-none">↶</span>
          <span className="text-[9px] uppercase tracking-widest opacity-70">Undo</span>
        </button>
      </div>

      {/* MAIN TOOLS */}
      <div className="panel-brutal flex gap-1 border-b-4 !border-b-neon-green">
        {tools.map((tool) => (
          <button
            key={tool.id}
            title={tool.label}
            className={`btn-brutal flex flex-col items-center gap-0.5 px-3 py-2 min-w-[52px] ${currentTool === tool.id ? 'active' : ''}`}
            onClick={() => setCurrentTool(tool.id)}
          >
            <span className="text-base leading-none">{tool.icon}</span>
            <span className="text-[9px] uppercase tracking-widest opacity-70">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* REDO BUTTON */}
      <div className="panel-brutal border-b-4 !border-b-neon-green flex">
        <button 
          className="btn-brutal flex flex-col items-center gap-0.5 px-3 py-2 min-w-[52px]" 
          onClick={redo} 
          disabled={!canRedo}
          style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}
          title="Redo (Ctrl+Y)"
        >
          <span className="text-base leading-none">↷</span>
          <span className="text-[9px] uppercase tracking-widest opacity-70">Redo</span>
        </button>
      </div>

    </div>
  );
}
