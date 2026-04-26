export function Toolbar({ currentTool, setCurrentTool }) {
  const tools = [
    { id: 'select', label: 'Select' },
    { id: 'rectangle', label: 'Rect' },
    { id: 'circle', label: 'Circle' },
    { id: 'line', label: 'Line' },
    { id: 'arrow', label: 'Arrow' },
    { id: 'text', label: 'Text' },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 panel-brutal flex gap-2">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`btn-brutal ${currentTool === tool.id ? 'active' : ''}`}
          onClick={() => setCurrentTool(tool.id)}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}
