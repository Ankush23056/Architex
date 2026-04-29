import React from 'react';

// Custom SVG Cursor
const CursorIcon = ({ color }) => (
  <svg
    width="24"
    height="36"
    viewBox="0 0 24 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' }}
  >
    <path
      d="M5.65376 2.15376C5.40127 1.64879 4.63614 1.69176 4.44498 2.22249L0.0899661 14.3164C-0.126487 14.9176 0.443905 15.488 1.04514 15.2715L13.139 10.9165C13.6698 10.7253 13.7127 9.9602 13.2078 9.7077L9.43128 7.81944C9.17646 7.69203 9.00762 7.45266 8.94827 7.16834L8.03322 2.78442C7.94056 2.34062 7.50975 2.05269 7.07223 2.1466L5.65376 2.15376Z"
      fill={color}
      stroke="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export function CursorOverlay({ activeUsers }) {
  if (!activeUsers) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {Object.entries(activeUsers).map(([clientId, cursor]) => (
        <div
          key={clientId}
          className="absolute top-0 left-0 transition-transform duration-75 ease-linear pointer-events-none flex flex-col items-start"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <CursorIcon color={cursor.color || '#ff00ff'} />
          <div 
            className="ml-6 mt-4 px-2 py-0.5 text-xs text-neon-green font-mono border-2 font-bold shadow-brutal uppercase pointer-events-none whitespace-nowrap"
            style={{ borderColor: cursor.color || '#ff00ff', backgroundColor: '#0a0a0a' }}
          >
            {clientId}
          </div>
        </div>
      ))}
    </div>
  );
}
