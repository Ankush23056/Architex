export function Toolbar({ currentTool, setCurrentTool }) {
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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 panel-brutal flex gap-1 z-10">
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
  );
}
