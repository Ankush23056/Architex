export function PropertiesPanel({
  selectedElement,
  updateElement,
  bringToFront,
  sendToBack,
  deleteElement,
  currentColor,
  setCurrentColor,
  currentStrokeWidth,
  setCurrentStrokeWidth,
}) {
  const colors = ['#39FF14', '#00FFFF', '#FF00FF', '#FFE600', '#FFFFFF'];

  const handleColorChange = (color) => {
    setCurrentColor(color);
    if (selectedElement) {
      updateElement({ ...selectedElement, color });
    }
  };

  const handleStrokeChange = (width) => {
    setCurrentStrokeWidth(width);
    if (selectedElement) {
      updateElement({ ...selectedElement, strokeWidth: width });
    }
  };

  return (
    <div className="absolute right-4 top-4 w-64 panel-brutal flex flex-col gap-4">
      <h3 className="font-mono font-bold border-b-2 border-border-brutal pb-2">Properties</h3>
      
      <div>
        <label className="block text-sm mb-2">Color</label>
        <div className="flex gap-2">
          {colors.map(c => (
            <button
              key={c}
              className="w-8 h-8 border-2 border-border-brutal transition-transform hover:scale-110"
              style={{ 
                backgroundColor: c,
                borderColor: (selectedElement?.color || currentColor) === c ? '#fff' : '#333'
              }}
              onClick={() => handleColorChange(c)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm mb-2">Stroke Width</label>
        <input 
          type="range" 
          min="1" 
          max="20" 
          className="w-full"
          value={selectedElement?.strokeWidth || currentStrokeWidth}
          onChange={(e) => handleStrokeChange(Number(e.target.value))}
        />
      </div>

      {selectedElement?.type === 'text' && (
        <div>
          <label className="block text-sm mb-2">Text</label>
          <input
            type="text"
            className="w-full bg-surface-2 border-2 border-border-brutal p-2 text-white font-mono outline-none focus:border-neon-green"
            value={selectedElement.text || ''}
            onChange={(e) => updateElement({ ...selectedElement, text: e.target.value })}
          />
        </div>
      )}

      {selectedElement && (
        <div className="flex flex-col gap-2 mt-2 pt-4 border-t-2 border-border-brutal">
          <div className="flex gap-2">
             <button className="btn-brutal flex-1" onClick={() => bringToFront(selectedElement.id)}>Front</button>
             <button className="btn-brutal flex-1" onClick={() => sendToBack(selectedElement.id)}>Back</button>
          </div>
          <button 
            className="btn-brutal !border-[#FF00FF] !text-[#FF00FF] hover:!bg-[#FF00FF] hover:!text-black"
            onClick={() => deleteElement(selectedElement.id)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
