export function Toolbar({
  currentTool,
  setCurrentTool,
  undo,
  redo,
  canUndo,
  canRedo,
  replicate,
  hasSelection,
}) {
  const tools = [
    { id: "select", label: "Select", icon: "↖" },
    { id: "text", label: "Text", icon: "T" },
    { id: "pen", label: "Pen", icon: "✎" },
    { id: "rectangle", label: "Rect", icon: "▭" },
    { id: "circle", label: "Circle", icon: "◯" },
    { id: "line", label: "Line", icon: "╱" },
    { id: "arrow", label: "Arrow", icon: "→" },
    { id: "curve", label: "CurveArr", icon: "⤵" },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-[10px] z-10">
      {/* UNDO BUTTON */}
      <div className="panel-brutal !p-1 border-b-4 !border-b-neon-green flex">
        <button
          className="btn-brutal flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] p-0"
          onClick={undo}
          disabled={!canUndo}
          style={{
            opacity: canUndo ? 1 : 0.4,
            cursor: canUndo ? "pointer" : "not-allowed",
          }}
          title="Undo (Ctrl+Z)"
        >
          <span className="text-2xl leading-none text-neon-cyan mt-1">↶</span>
          <span className="text-[10px] uppercase tracking-widest opacity-70 mb-1">
            Undo
          </span>
        </button>
      </div>

      {/* MAIN TOOLS */}
      <div className="panel-brutal !p-1 flex gap-[6.5px] border-b-4 !border-b-neon-green">
        {tools.map((tool) => (
          <button
            key={tool.id}
            title={tool.label}
            className={`btn-brutal flex flex-col items-center justify-center gap-0.5 w-[52px] h-[52px] p-0 ${currentTool === tool.id ? "active" : ""}`}
            onClick={() => setCurrentTool(tool.id)}
          >
            <span className="text-base leading-none">{tool.icon}</span>
            <span className="text-[9px] uppercase tracking-widest opacity-70">
              {tool.label}
            </span>
          </button>
        ))}

        {/* REPLICATE BUTTON - Consolidated into main tool panel */}
        <button
          title="Replicate (Ctrl+D)"
          className="btn-brutal flex flex-col items-center justify-center gap-0.5 w-[52px] h-[52px] p-0"
          onClick={replicate}
          disabled={!hasSelection}
          style={{
            opacity: hasSelection ? 1 : 0.4,
            cursor: hasSelection ? "pointer" : "not-allowed",
          }}
        >
          <span className="text-xl leading-none text-[#FF00FF]">❐</span>
          <span className="text-[9px] uppercase tracking-widest opacity-70">
            Dupl
          </span>
        </button>
      </div>

      {/* REDO BUTTON */}
      <div className="panel-brutal !p-1 border-b-4 !border-b-neon-green flex">
        <button
          className="btn-brutal flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] p-0"
          onClick={redo}
          disabled={!canRedo}
          style={{
            opacity: canRedo ? 1 : 0.4,
            cursor: canRedo ? "pointer" : "not-allowed",
          }}
          title="Redo (Ctrl+Y)"
        >
          <span className="text-2xl leading-none text-neon-cyan mt-1">↷</span>
          <span className="text-[10px] uppercase tracking-widest opacity-70 mb-1">
            Redo
          </span>
        </button>
      </div>
    </div>
  );
}
