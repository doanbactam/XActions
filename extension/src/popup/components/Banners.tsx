// by nichxbt

export function DisconnectedBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="xa-banner xa-banner-disconnected">
      <span className="xa-banner-icon" aria-hidden="true">
        🔗
      </span>
      <div className="xa-banner-text">
        <div className="xa-banner-title">Cần tab x.com đã login</div>
        <div className="xa-banner-desc">
          Session X = cookie browser (không dán token). Mở{' '}
          <a href="https://x.com" target="_blank" rel="noreferrer">
            x.com
          </a>{' '}
          rồi bấm lại XA.
        </div>
      </div>
    </div>
  );
}

export function RateLimitBanner({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  if (!visible) return null;
  return (
    <div className="xa-banner xa-banner-rate-limit">
      <span aria-hidden="true">⚠️</span>
      <span className="xa-banner-text">Rate limit detected — automations paused</span>
      <button type="button" className="xa-btn-small" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
