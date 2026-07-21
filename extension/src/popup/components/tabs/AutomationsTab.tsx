// by nichxbt
import * as React from 'react';
import { AUTOMATIONS } from '../../data/automations';
import { AutomationCard } from '../automation/AutomationCard';
import { sendMessage } from '../../lib/rpc';
import { useToast } from '../ToastProvider';
import type { ActivityEntry, AutomationsState, AutomationCategory } from '../../types';

const CATEGORIES: { id: 'all' | AutomationCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'growth', label: 'Growth' },
  { id: 'tools', label: 'Tools' },
  { id: 'analytics', label: 'Analytics' },
];

interface AutomationsTabProps {
  automations: AutomationsState;
  activityLog: ActivityEntry[];
  patchAutomation: (id: string, patch: Partial<AutomationsState[string]>) => void;
  pushLocalLog: (entry: ActivityEntry) => void;
}

function defaultSettingsFor(id: string): Record<string, unknown> {
  const def = AUTOMATIONS.find((a) => a.id === id);
  const settings: Record<string, unknown> = {};
  def?.fields.forEach((f) => {
    settings[f.key] = f.default;
  });
  return settings;
}

export function AutomationsTab({ automations, activityLog, patchAutomation, pushLocalLog }: AutomationsTabProps) {
  const toast = useToast();
  const [category, setCategory] = React.useState<'all' | AutomationCategory>('all');
  const [search, setSearch] = React.useState('');
  const [settingsByAutomation, setSettingsByAutomation] = React.useState<Record<string, Record<string, unknown>>>({});
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    (async () => {
      const keys = AUTOMATIONS.map((a) => `settings_${a.id}`);
      const data = await chrome.storage.local.get(keys);
      const next: Record<string, Record<string, unknown>> = {};
      AUTOMATIONS.forEach((a) => {
        next[a.id] = { ...defaultSettingsFor(a.id), ...(data[`settings_${a.id}`] || {}) };
      });
      setSettingsByAutomation(next);
    })();
  }, []);

  const handleSettingChange = React.useCallback((id: string, key: string, value: unknown) => {
    setSettingsByAutomation((prev) => {
      const next = { ...prev, [id]: { ...prev[id], [key]: value } };
      chrome.storage.local.set({ [`settings_${id}`]: next[id] });
      return next;
    });
  }, []);

  const handleToggle = React.useCallback(
    async (id: string, settingsIn: Record<string, unknown>) => {
      const running = automations[id]?.running;
      if (running) {
        const res = await sendMessage<{ success: boolean }>({ type: 'STOP_AUTOMATION', automationId: id });
        if (res?.success) {
          const count = automations[id]?.actionCount || 0;
          patchAutomation(id, { running: false });
          pushLocalLog({ time: Date.now(), type: 'stop', automation: id, message: `Stopped ${id} (${count} actions)` });
          toast.show(`${id} stopped — ${count} actions`, 'info');
        }
      } else {
        const settings = { ...settingsIn };
        if ('minDelay' in settings) settings.maxDelay = Math.round(Number(settings.minDelay) * 2.5);
        await chrome.storage.local.set({ [`settings_${id}`]: settings });
        const res = await sendMessage<{ success: boolean }>({ type: 'START_AUTOMATION', automationId: id, settings });
        if (res?.success) {
          patchAutomation(id, { running: true, actionCount: 0, startedAt: Date.now() });
          pushLocalLog({ time: Date.now(), type: 'start', automation: id, message: `Started ${id}` });
          toast.show(`${id} started`, 'success');
        }
      }
    },
    [automations, patchAutomation, pushLocalLog, toast],
  );

  const runningCount = Object.values(automations).filter((s) => s.running).length;
  const totalActions = Object.values(automations).reduce((sum, s) => sum + (s.actionCount || 0), 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayActions = activityLog.filter((e) => e.type === 'action' && e.time >= todayStart.getTime()).length;
  const runningStates = Object.values(automations).filter((s) => s.running && s.startedAt);
  const uptime = runningStates.length
    ? formatUptime(Date.now() - Math.min(...runningStates.map((s) => s.startedAt as number)))
    : '—';

  const term = search.toLowerCase().trim();
  const visible = AUTOMATIONS.filter((a) => {
    const catMatch = category === 'all' || a.category === category;
    const searchMatch = !term || a.searchable.toLowerCase().includes(term) || a.title.toLowerCase().includes(term);
    return catMatch && searchMatch;
  });

  return (
    <section className="xa-tab-content">
      <div className="xa-dashboard-summary">
        <div className="xa-dash-stat">
          <div className="xa-dash-value" style={{ color: runningCount > 0 ? 'var(--xa-success)' : 'var(--xa-accent)' }}>
            {runningCount}
          </div>
          <div className="xa-dash-label">Running</div>
        </div>
        <div className="xa-dash-stat">
          <div className="xa-dash-value">{todayActions}</div>
          <div className="xa-dash-label">Today</div>
        </div>
        <div className="xa-dash-stat">
          <div className="xa-dash-value">{totalActions > 999 ? `${(totalActions / 1000).toFixed(1)}k` : totalActions}</div>
          <div className="xa-dash-label">Total</div>
        </div>
        <div className="xa-dash-stat">
          <div className="xa-dash-value">{uptime}</div>
          <div className="xa-dash-label">Uptime</div>
        </div>
      </div>

      <div className="xa-category-filters">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`xa-cat-filter ${category === c.id ? 'is-active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="xa-search-bar">
        <input
          type="text"
          className="xa-input xa-search-input"
          placeholder="Search automations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {visible.map((def) => (
        <AutomationCard
          key={def.id}
          def={def}
          hidden={false}
          runtime={automations[def.id]}
          settings={settingsByAutomation[def.id] || defaultSettingsFor(def.id)}
          onSettingChange={handleSettingChange}
          onToggle={handleToggle}
          tick={tick}
        />
      ))}

      {visible.length === 0 && (
        <div className="xa-no-results">
          <span aria-hidden="true">🔍</span> No automations match your filter
        </div>
      )}
    </section>
  );
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
