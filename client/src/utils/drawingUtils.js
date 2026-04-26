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
    case 'curve': {
      const endX = element.x + element.width;
      const endY = element.y + element.height;
      const cp = element.controlPoint || {
        x: (element.x + endX) / 2,
        y: (element.y + endY) / 2 - 50,
      };

      // Draw the curve
      ctx.beginPath();
      ctx.moveTo(element.x, element.y);
      ctx.quadraticCurveTo(cp.x, cp.y, endX, endY);
      ctx.stroke();

      // Arrowhead: tangent at t=1 is (endX - cpX, endY - cpY)
      const headLen = 14 + (element.strokeWidth || 2);
      const angle = Math.atan2(endY - cp.y, endX - cp.x);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(angle - Math.PI / 6),
        endY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(angle + Math.PI / 6),
        endY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
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

// Draw control handle for a selected curve element
export const drawCurveHandle = (ctx, element) => {
  if (element.type !== 'curve') return;
  const endX = element.x + element.width;
  const endY = element.y + element.height;
  const cp = element.controlPoint || {
    x: (element.x + endX) / 2,
    y: (element.y + endY) / 2 - 50,
  };

  ctx.save();
  // Dashed tension guide lines
  ctx.strokeStyle = 'rgba(255,0,255,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(element.x, element.y);
  ctx.lineTo(cp.x, cp.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Control point handle
  ctx.setLineDash([]);
  ctx.strokeStyle = '#FF00FF';
  ctx.fillStyle = '#0a0a0a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cp.x, cp.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
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
    case 'curve': {
      // Sample 30 points along the quadratic bezier and check proximity
      const endX = ex + width;
      const endY = ey + height;
      const cp = element.controlPoint || {
        x: (ex + endX) / 2,
        y: (ey + endY) / 2 - 50,
      };
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const bx = (1 - t) * (1 - t) * ex + 2 * (1 - t) * t * cp.x + t * t * endX;
        const by = (1 - t) * (1 - t) * ey + 2 * (1 - t) * t * cp.y + t * t * endY;
        if (distance(x, y, bx, by) < hitTestPadding) return true;
      }
      return false;
    }
    default:
      return false;
  }
};

export const isPointNearCurveHandle = (x, y, element) => {
  if (element.type !== 'curve') return false;
  const endX = element.x + element.width;
  const endY = element.y + element.height;
  const cp = element.controlPoint || {
    x: (element.x + endX) / 2,
    y: (element.y + endY) / 2 - 50,
  };
  return distance(x, y, cp.x, cp.y) < 14;
};

const distance = (x1, y1, x2, y2) => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};
