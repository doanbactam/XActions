// by nichxbt

interface HeaderProps {
  connected: boolean;
  headerSub: string;
  paused: boolean;
  onTogglePause: () => void;
  onEmergencyStop: () => void;
}

export function Header({ connected, headerSub, paused, onTogglePause, onEmergencyStop }: HeaderProps) {
  return (
    <header className="xa-header">
      <div className="xa-header-left">
        <div className="xa-crest" aria-hidden="true">
          X<span className="xa-crest-accent">A</span>
        </div>
        <div className="xa-header-brand">
          <div className="xa-header-title">XActions</div>
          <div className="xa-header-sub">{headerSub}</div>
        </div>
      </div>
      <div className="xa-header-right">
        <div className={`xa-status-pill ${connected ? 'is-connected' : 'is-disconnected'}`} title={connected ? 'Connected to X' : 'Not on X — open x.com'}>
          <span className="xa-status-dot" />
          <span>{connected ? 'Live' : 'Offline'}</span>
        </div>
        <button
          type="button"
          className="xa-icon-btn"
          title="Mở dashboard (tab mới)"
          aria-label="Dashboard"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') })}
        >
          ⛶
        </button>
        <button
          type="button"
          className={`xa-icon-btn ${paused ? 'is-paused' : ''}`}
          title="Pause All (Ctrl+Shift+P)"
          aria-label={paused ? 'Resume' : 'Pause'}
          onClick={onTogglePause}
        >
          {paused ? '▶' : '⏸'}
        </button>
        <button
          type="button"
          className="xa-icon-btn xa-icon-btn-danger"
          title="Emergency Stop (Ctrl+Shift+S)"
          aria-label="Stop all"
          onClick={onEmergencyStop}
        >
          ⏹
        </button>
      </div>
    </header>
  );
}
