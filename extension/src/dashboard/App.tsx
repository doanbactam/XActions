// XActions Dashboard — main app with sidebar nav + 4 sections.
// by nichxbt
import * as React from 'react';
import { useAgent } from '../popup/lib/useAgent';
import { useExtensionState } from '../popup/lib/useExtensionState';
import { ConfigSection } from './components/ConfigSection';
import { ActivitySection } from './components/ActivitySection';
import { PlaybookSection } from './components/PlaybookSection';
import { PersonaSection } from './components/PersonaSection';

type Section = 'config' | 'activity' | 'playbook' | 'persona';

const NAV: { id: Section; icon: string; label: string }[] = [
  { id: 'config', icon: '⚙', label: 'Cấu hình' },
  { id: 'activity', icon: '☰', label: 'Hoạt động' },
  { id: 'playbook', icon: '◈', label: 'Kịch bản' },
  { id: 'persona', icon: '✦', label: 'Persona' },
];

const TITLES: Record<Section, { title: string; sub: string }> = {
  config: { title: 'Cấu hình', sub: 'OAuth · Model · Provider · Safety caps' },
  activity: { title: 'Hoạt động', sub: 'Log · biểu đồ · breakdown · export' },
  playbook: { title: 'Kịch bản', sub: 'Xem · sửa · toggle steps · history' },
  persona: { title: 'Persona', sub: 'Templates · test prompt · output preview' },
};

export function DashboardApp() {
  const [section, setSection] = React.useState<Section>('config');
  const agent = useAgent();
  const state = useExtensionState();

  const meta = TITLES[section];

  return (
    <div className="xa-dash">
      <aside className="xa-dash-sidebar">
        <div className="xa-dash-brand">
          <div className="xa-crest" aria-hidden="true">
            X<span className="xa-crest-accent">A</span>
          </div>
          <div>
            <div className="xa-dash-brand-title">XActions</div>
            <div className="xa-dash-brand-sub">Dashboard · v1.4.0</div>
          </div>
        </div>

        <nav className="xa-dash-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`xa-dash-nav-item ${section === n.id ? 'is-active' : ''}`}
              onClick={() => setSection(n.id)}
            >
              <span className="xa-dash-nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="xa-dash-sidebar-footer">
          <div style={{ marginBottom: 4 }}>
            <span className="xa-status-dot" style={{ display: 'inline-block', marginRight: 4 }} />
            {agent.oauth.signedIn ? 'Grok đã kết nối' : 'Chưa đăng nhập'}
          </div>
          <div>by nichxbt</div>
        </div>
      </aside>

      <main className="xa-dash-main">
        <div className="xa-dash-header">
          <div>
            <h1 className="xa-dash-title">{meta.title}</h1>
            <div className="xa-dash-subtitle">{meta.sub}</div>
          </div>
        </div>

        {section === 'config' && <ConfigSection agent={agent} />}
        {section === 'activity' && <ActivitySection activityLog={state.activityLog} onCleared={state.refresh} />}
        {section === 'playbook' && <PlaybookSection agent={agent} />}
        {section === 'persona' && <PersonaSection agent={agent} />}
      </main>
    </div>
  );
}
