// by nichxbt
import type { AccountInfo } from '../types';

interface HeaderProps {
  connected: boolean;
  account: AccountInfo | null;
  paused: boolean;
  onTogglePause: () => void;
  onEmergencyStop: () => void;
}

export function Header({ connected, account, paused, onTogglePause, onEmergencyStop }: HeaderProps) {
  const handle = account?.handle ? `@${account.handle}` : null;
  const statusLabel = !connected ? 'Offline · mở x.com' : handle || 'Live';

  return (
    <header className="xa-header">
      <div className="xa-header-left">
        <div className="xa-crest" aria-hidden="true">
          X<span className="xa-crest-accent">A</span>
        </div>
        <div className="xa-header-brand">
          <div className="xa-header-title">XActions</div>
          <div className={`xa-header-sub ${connected ? 'is-live' : 'is-off'}`}>
            <span className="xa-status-dot" aria-hidden="true" />
            {statusLabel}
          </div>
        </div>
      </div>
      <div className="xa-header-right">
        <button
          type="button"
          className="xa-icon-btn"
          title="Dashboard"
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
