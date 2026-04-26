export const drawElement = (ctx, element) => {
  ctx.save();
  ctx.strokeStyle = element.color || '#39FF14';
  ctx.fillStyle = element.color || '#39FF14';
  ctx.lineWidth = element.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (element.type) {
    case 'rectangle':
      ctx.beginPath();
      ctx.rect(element.x, element.y, element.width, element.height);
      ctx.stroke();
      if (element.fill) {
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      break;
    case 'circle': {
      ctx.beginPath();
      const radiusX = Math.abs(element.width) / 2;
      const radiusY = Math.abs(element.height) / 2;
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
      break;
    }
    case 'line':
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(element.x, element.y);
      ctx.lineTo(element.x + element.width, element.y + element.height);
      ctx.stroke();

      if (element.type === 'arrow') {
        const headlen = 15;
        const angle = Math.atan2(element.height, element.width);
        ctx.beginPath();
        ctx.moveTo(element.x + element.width, element.y + element.height);
        ctx.lineTo(
          element.x + element.width - headlen * Math.cos(angle - Math.PI / 6),
          element.y + element.height - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(element.x + element.width, element.y + element.height);
        ctx.lineTo(
          element.x + element.width - headlen * Math.cos(angle + Math.PI / 6),
          element.y + element.height - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
      break;
    }
    case 'text':
      ctx.font = `${element.strokeWidth * 10}px "JetBrains Mono", "Fira Code", monospace`;
      ctx.textBaseline = 'top';
      ctx.fillText(element.text || 'Text', element.x, element.y);
      break;
    default:
      break;
  }
  ctx.restore();
};

export const isPointInElement = (x, y, element) => {
  const { type, x: ex, y: ey, width, height } = element;
  
  const minX = Math.min(ex, ex + width);
  const maxX = Math.max(ex, ex + width);
  const minY = Math.min(ey, ey + height);
  const maxY = Math.max(ey, ey + height);
  
  const hitTestPadding = 10;

  switch (type) {
    case 'rectangle':
    case 'text':
      return (
        x >= minX - hitTestPadding &&
        x <= maxX + hitTestPadding &&
        y >= minY - hitTestPadding &&
        y <= maxY + hitTestPadding
      );
    case 'circle': {
      const centerX = ex + width / 2;
      const centerY = ey + height / 2;
      const radiusX = Math.abs(width) / 2;
      const radiusY = Math.abs(height) / 2;
      if (radiusX === 0 || radiusY === 0) return false;
      const dx = x - centerX;
      const dy = y - centerY;
      return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1.2;
    }
    case 'line':
    case 'arrow': {
      const l2 = width * width + height * height;
      if (l2 === 0) return distance(x, y, ex, ey) < hitTestPadding;
      
      let t = ((x - ex) * width + (y - ey) * height) / l2;
      t = Math.max(0, Math.min(1, t));
      
      const projX = ex + t * width;
      const projY = ey + t * height;
      return distance(x, y, projX, projY) < hitTestPadding;
    }
    default:
      return false;
  }
};

const distance = (x1, y1, x2, y2) => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};
