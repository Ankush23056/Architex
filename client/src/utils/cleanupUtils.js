export const cleanupMess = (elements) => {
  if (!elements || elements.length === 0) return [];

  const GRID_SIZE = 20;
  
  // Create deep copy to avoid mutating existing state directly
  let newElements = elements.map(el => ({ 
    ...el,
    // Snap X and Y to the nearest grid line
    x: Math.round(el.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(el.y / GRID_SIZE) * GRID_SIZE
  }));

  // Helper to normalize padding in a 1D array of elements
  const normalize1DSpacing = (group, isHorizontal) => {
    if (group.length <= 1) return;
    
    // Sort items along the axis
    group.sort((a, b) => isHorizontal ? a.x - b.x : a.y - b.y);
    
    const PADDING = 40; // Target padding between elements
    
    // Set the first element's position
    let currentPos = isHorizontal ? group[0].x : group[0].y;
    
    group.forEach((el, index) => {
      if (index > 0) {
        if (isHorizontal) {
          el.x = currentPos;
        } else {
          el.y = currentPos;
        }
      }
      
      const size = isHorizontal ? (el.width || 0) : (el.height || 0);
      let step = Math.abs(size) + PADDING;
      
      // Heuristic for text elements (which don't store exact width/height reliably here)
      if (el.type === 'text') {
        step = isHorizontal ? 100 : 40;
      }
      
      // Snap the next position to grid
      currentPos = Math.round((currentPos + step) / GRID_SIZE) * GRID_SIZE;
    });
  };

  // 1. Horizontal Alignment & Spacing
  // Group elements that now share the exact same Y (thanks to snapping)
  const yGroups = {};
  newElements.forEach(el => {
    if (!yGroups[el.y]) yGroups[el.y] = [];
    yGroups[el.y].push(el);
  });

  Object.values(yGroups).forEach(group => {
    normalize1DSpacing(group, true); // true = horizontal
  });

  // 2. Vertical Alignment & Spacing
  // Group elements that share the exact same X
  const xGroups = {};
  newElements.forEach(el => {
    if (!xGroups[el.x]) xGroups[el.x] = [];
    xGroups[el.x].push(el);
  });

  Object.values(xGroups).forEach(group => {
    normalize1DSpacing(group, false); // false = vertical
  });

  return newElements;
};
