export function StatusBar({ connected, elementCount, selectedId, selectedCount, showPanelHint }) {
  return (
    <div className="p-3 border border-border-brutal flex flex-col gap-1 pointer-events-none select-none" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(8px)', minWidth: '220px' }}>
      
      {/* Telemetry Row 1 */}
      <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
        <span>MOUSE: <span id="mouse-coords" className="text-neon-cyan">X: 0 Y: 0</span></span>
        <span className="text-[#BF00FF]">⊞ 20px</span>
      </div>

      {/* Telemetry Row 2 */}
      <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
        <span>SYSTEM:</span>
        <span className="text-neon-green">AI: READY (GROQ)</span>
      </div>

      {/* Telemetry Row 3 */}
      <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
        <span>SYNC:</span>
        <span className={connected ? 'text-neon-cyan animate-pulse-neon' : 'text-[#FF00FF]'}>
          {connected ? 'LIVE (REDIS)' : 'OFFLINE'}
        </span>
      </div>

      <div className="h-px bg-border-brutal w-full my-1 opacity-50" />

      {/* Telemetry Row 4 */}
      <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
        <span>OBJECTS:</span>
        <span className="text-neon-magenta">{elementCount}</span>
      </div>

      {/* Selection info */}
      {(selectedCount > 1 || selectedId) && (
        <div className="flex items-center justify-between text-[10px] font-mono mt-1">
          <span className="opacity-80">SELECTION:</span>
          <span className="text-neon-green font-bold">
            {selectedCount > 1 ? `[${selectedCount}] ACTIVE` : `[1] ACTIVE`}
          </span>
        </div>
      )}
      
      {/* Panel hint */}
      {showPanelHint && (
        <div className="text-[10px] font-mono text-center mt-1 opacity-50">
          [H] SHOW PANEL
        </div>
      )}
    </div>
  );
}
