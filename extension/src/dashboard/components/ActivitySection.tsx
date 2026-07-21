// Activity section — full log table + charts + breakdown + CSV export.
// by nichxbt
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import type { ActivityEntry, LogType } from '../../popup/types';
import { formatRelativeTime } from '../../popup/lib/format';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'aiAgent', label: '🤖 Agent' },
  { value: 'autoLiker', label: '❤️ Liker' },
  { value: 'smartUnfollow', label: '👋 Unfollow' },
  { value: 'keywordFollow', label: '🔍 Follow' },
  { value: 'growthSuite', label: '🚀 Growth' },
  { value: 'autoCommenter', label: '💬 Commenter' },
  { value: 'followEngagers', label: '👥 Engagers' },
  { value: 'videoDownloader', label: '🎬 Video' },
  { value: 'unfollowerDetector', label: '🔔 Unfollower' },
  { value: 'bestTimeToPost', label: '📊 Best Time' },
  { value: 'threadReader', label: '🧵 Thread' },
  { value: 'quickStats', label: '⚡ Stats' },
];

const ICONS: Record<string, string> = {
  action: '🔧', start: '▶️', stop: '⏹', complete: '✅', error: '❌',
};

interface Props {
  activityLog: ActivityEntry[];
  onCleared: () => void;
}

interface AutomationStat { id: string; total: number; done: number; errors: number; lastTime: number; }
interface HourBucket { hour: number; count: number; }

function computeStats(log: ActivityEntry[]) {
  const map = new Map<string, AutomationStat>();
  const byType: Record<LogType, number> = { action: 0, start: 0, stop: 0, complete: 0, error: 0 };
  const hourMap = new Map<number, number>();

  for (const e of log) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    const stat = map.get(e.automation) || { id: e.automation, total: 0, done: 0, errors: 0, lastTime: 0 };
    stat.total++;
    if (e.type === 'complete') stat.done++;
    if (e.type === 'error') stat.errors++;
    if (e.time > stat.lastTime) stat.lastTime = e.time;
    map.set(e.automation, stat);
    const h = new Date(e.time).getHours();
    hourMap.set(h, (hourMap.get(h) || 0) + 1);
  }

  const byHour: HourBucket[] = [];
  for (let h = 0; h < 24; h++) byHour.push({ hour: h, count: hourMap.get(h) || 0 });

  const done = byType.complete || 0;
  const errors = byType.error || 0;
  const successRate = done + errors > 0 ? Math.round((done / (done + errors)) * 100) : 0;

  return {
    byAutomation: Array.from(map.values()).sort((a, b) => b.total - a.total),
    byType,
    byHour,
    total: log.length,
    successRate,
  };
}

function exportCSV(log: ActivityEntry[]) {
  const header = 'time,type,automation,message\n';
  const rows = log.map((e) =>
    `${new Date(e.time).toISOString()},"${e.type}","${e.automation}","${e.message.replace(/"/g, '""')}"`,
  );
  const csv = header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `xactions-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ActivitySection({ activityLog, onCleared }: Props) {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    let r = filter === 'all' ? activityLog : activityLog.filter((e) => e.automation === filter);
    if (search) r = r.filter((e) => e.message.toLowerCase().includes(search.toLowerCase()));
    return r;
  }, [activityLog, filter, search]);

  const stats = React.useMemo(() => computeStats(activityLog), [activityLog]);
  const maxHour = Math.max(1, ...stats.byHour.map((b) => b.count));

  const clearLog = async () => {
    if (!confirm('Xoá toàn bộ activity log?')) return;
    await chrome.storage.local.set({ activityLog: [] });
    onCleared();
  };

  return (
    <div>
      {/* Stat cards */}
      <div className="xa-dash-stat-grid">
        <div className="xa-dash-stat-card">
          <div className="xa-dash-stat-value">{stats.total}</div>
          <div className="xa-dash-stat-label">Tổng events</div>
        </div>
        <div className="xa-dash-stat-card">
          <div className="xa-dash-stat-value" style={{ color: 'var(--xa-success)' }}>{stats.byType.complete}</div>
          <div className="xa-dash-stat-label">Done</div>
        </div>
        <div className="xa-dash-stat-card">
          <div className="xa-dash-stat-value" style={{ color: 'var(--xa-danger)' }}>{stats.byType.error}</div>
          <div className="xa-dash-stat-label">Error</div>
        </div>
        <div className="xa-dash-stat-card">
          <div className="xa-dash-stat-value" style={{ color: 'var(--xa-accent-2)' }}>{stats.successRate}%</div>
          <div className="xa-dash-stat-label">Success rate</div>
        </div>
      </div>

      {/* 24h chart */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Hoạt động 24h</div>
        <div className="xa-dash-chart-bars">
          {stats.byHour.map((b) => (
            <div
              key={b.hour}
              className="xa-dash-chart-bar"
              style={{ height: `${(b.count / maxHour) * 100}%` }}
              title={`${b.hour}:00 — ${b.count} events`}
            />
          ))}
        </div>
        <div className="xa-dash-chart-axis">
          <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
        </div>
      </div>

      {/* Per-automation breakdown */}
      {stats.byAutomation.length > 0 && (
        <div className="xa-dash-card">
          <div className="xa-dash-card-title">Theo automation</div>
          {stats.byAutomation.map((s) => (
            <div key={s.id} className="xa-log-breakdown-row" style={{ marginBottom: 6 }}>
              <span className="xa-log-breakdown-name">{s.id}</span>
              <div className="xa-log-breakdown-bar">
                <div className="xa-log-breakdown-fill" style={{ width: `${(s.total / stats.total) * 100}%` }} />
              </div>
              <span className="xa-log-breakdown-count">
                {s.total}
                {s.errors > 0 && <span className="xa-log-breakdown-err"> · {s.errors}❌</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Log table */}
      <div className="xa-dash-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div className="xa-dash-card-title" style={{ margin: 0 }}>Log ({filtered.length})</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="xa-dash-input"
              placeholder="Tìm kiếm…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 160, padding: '6px 10px', fontSize: 12 }}
            />
            <Select.Root value={filter} onValueChange={(v) => v && setFilter(v)}>
              <Select.Trigger className="xa-select-trigger xa-select-trigger-sm">
                <Select.Value />
                <Select.Icon className="xa-select-icon">▾</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="xa-select-positioner">
                  <Select.Popup className="xa-select-popup">
                    {FILTERS.map((f) => (
                      <Select.Item key={f.value} value={f.value} className="xa-select-item">
                        <Select.ItemText>{f.label}</Select.ItemText>
                        <Select.ItemIndicator className="xa-select-item-indicator">✓</Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button type="button" className="xa-dash-btn xa-dash-btn-secondary" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
              Export CSV
            </button>
            <button type="button" className="xa-dash-btn xa-dash-btn-danger" onClick={clearLog} disabled={activityLog.length === 0}>
              Clear
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="xa-dash-empty">
            {activityLog.length === 0 ? 'Chưa có log. Chạy automation hoặc Agent để xem hoạt động.' : 'Không có log cho filter này.'}
          </div>
        ) : (
          <table className="xa-dash-log-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Type</th>
                <th>Automation</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((entry, i) => (
                <tr key={`${entry.time}-${i}`} className={`xa-dash-log-type-${entry.type}`}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--xa-ink-3)' }} title={new Date(entry.time).toLocaleString()}>
                    {formatRelativeTime(entry.time)}
                  </td>
                  <td>{ICONS[entry.type] || '📘'} {entry.type}</td>
                  <td style={{ fontSize: 11 }}>{entry.automation}</td>
                  <td>{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
