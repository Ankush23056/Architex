export function StatusBar({ connected, elementCount, selectedId, showPanelHint }) {
  return (
    <div className="absolute bottom-4 left-4 panel-brutal flex items-center gap-6">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-neon-green animate-pulse-neon' : 'bg-[#FF00FF]'}`} />
        <span className="font-mono text-sm">{connected ? 'Live' : 'Disconnected'}</span>
      </div>
      
      <div className="text-sm font-mono border-l-2 border-border-brutal pl-6">
        Elements: <span className="text-neon-cyan">{elementCount}</span>
      </div>
      
      {selectedId && (
        <div className="text-sm font-mono border-l-2 border-border-brutal pl-6 text-neon-magenta truncate max-w-[150px]">
          Sel: {selectedId}
        </div>
      )}

      {showPanelHint && (
        <div className="text-xs font-mono border-l-2 border-border-brutal pl-6 opacity-50">
          Press <kbd className="border border-border-brutal px-1">H</kbd> to show panel
        </div>
      )}
    </div>
  );
}

