// by nichxbt
import type { AccountInfo } from '../types';

interface AccountCardProps {
  connected: boolean;
  account: AccountInfo | null;
}

export function AccountCard({ connected, account }: AccountCardProps) {
  const name = account?.name || (connected ? 'Unknown' : 'Connect to X');
  const handle = account?.handle
    ? `@${account.handle}`
    : account?.url || (connected ? '' : 'Open x.com to get started');

  return (
    <section className="xa-section xa-account">
      <div className="xa-account-card">
        <div className="xa-account-avatar">
          {account?.avatar ? <img src={account.avatar} alt="" /> : <span>{connected ? '◈' : '?'}</span>}
        </div>
        <div className="xa-account-details">
          <div className="xa-account-name">{name}</div>
          <div className="xa-account-handle">{handle}</div>
        </div>
        <div className={`xa-account-badge ${connected ? 'is-on' : ''}`}>{connected ? 'Ready' : '—'}</div>
      </div>
    </section>
  );
}
