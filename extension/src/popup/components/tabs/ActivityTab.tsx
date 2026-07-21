// by nichxbt
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import type { ActivityEntry, LogType } from '../../types';
import { formatRelativeTime } from '../../lib/format';
import { useToast } from '../ToastProvider';

const FILTERS = [
  { value: 'all', label: 'All' },
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
  action: '🔧',
  start: '▶️',
  stop: '⏹',
  complete: '✅',
  error: '❌',
};

interface ActivityTabProps {
  activityLog: ActivityEntry[];
  onCleared: () => void;
}

interface AutomationStat {
  id: string;
  total: number;
  done: number;
  errors: number;
  lastTime: number;
}

interface HourBucket {
  hour: number;
  count: number;
}

function computeStats(log: ActivityEntry[]): {
  byAutomation: AutomationStat[];
  byType: Record<LogType, number>;
  byHour: HourBucket[];
  total: number;
  successRate: number;
} {
  const map = new Map<string, AutomationStat>();
  const byType: Record<LogType, number> = {
    action: 0,
    start: 0,
    stop: 0,
    complete: 0,
    error: 0,
  };
  const hourMap = new Map<number, number>();

  for (const e of log) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    const stat = map.get(e.automation) || {
      id: e.automation,
      total: 0,
      done: 0,
      errors: 0,
      lastTime: 0,
    };
    stat.total++;
    if (e.type === 'complete') stat.done++;
    if (e.type === 'error') stat.errors++;
    if (e.time > stat.lastTime) stat.lastTime = e.time;
    map.set(e.automation, stat);

    const h = new Date(e.time).getHours();
    hourMap.set(h, (hourMap.get(h) || 0) + 1);
  }

  const byHour: HourBucket[] = [];
  for (let h = 0; h < 24; h++) {
    byHour.push({ hour: h, count: hourMap.get(h) || 0 });
  }

  const total = log.length;
  const done = byType.complete || 0;
  const errors = byType.error || 0;
  const successRate = done + errors > 0 ? Math.round((done / (done + errors)) * 100) : 0;

  return {
    byAutomation: Array.from(map.values()).sort((a, b) => b.total - a.total),
    byType,
    byHour,
    total,
    successRate,
  };
}

export function ActivityTab({ activityLog, onCleared }: ActivityTabProps) {
  const toast = useToast();
  const [filter, setFilter] = React.useState('all');

  const filtered = filter === 'all' ? activityLog : activityLog.filter((e) => e.automation === filter);
  const stats = React.useMemo(() => computeStats(activityLog), [activityLog]);
  const maxHour = Math.max(1, ...stats.byHour.map((b) => b.count));

  const clearLog = async () => {
    await chrome.storage.local.set({ activityLog: [] });
    onCleared();
    toast.show('Đã xoá log', 'info');
  };

  return (
    <section className="xa-tab-content">
      {/* Stats dashboard */}
      <div className="xa-log-stats">
        <div className="xa-log-stat-row">
          <div className="xa-log-stat">
            <div className="xa-log-stat-value">{stats.total}</div>
            <div className="xa-log-stat-label">Tổng</div>
          </div>
          <div className="xa-log-stat">
            <div className="xa-log-stat-value" style={{ color: 'var(--xa-success, #4ade80)' }}>
              {stats.byType.complete}
            </div>
            <div className="xa-log-stat-label">Done</div>
          </div>
          <div className="xa-log-stat">
            <div className="xa-log-stat-value" style={{ color: 'var(--xa-danger, #f87171)' }}>
              {stats.byType.error}
            </div>
            <div className="xa-log-stat-label">Error</div>
          </div>
          <div className="xa-log-stat">
            <div className="xa-log-stat-value" style={{ color: 'var(--xa-accent, #c9a84c)' }}>
              {stats.successRate}%
            </div>
            <div className="xa-log-stat-label">Success</div>
          </div>
        </div>

        {/* Hourly activity chart (24h CSS bars) */}
        <div className="xa-log-chart">
          <div className="xa-log-chart-label">Hoạt động 24h</div>
          <div className="xa-log-chart-bars">
            {stats.byHour.map((b) => (
              <div
                key={b.hour}
                className="xa-log-chart-bar"
                style={{ height: `${(b.count / maxHour) * 100}%` }}
                title={`${b.hour}:00 — ${b.count} events`}
              />
            ))}
          </div>
          <div className="xa-log-chart-axis">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>

        {/* Per-automation breakdown */}
        {stats.byAutomation.length > 0 && (
          <div className="xa-log-breakdown">
            <div className="xa-log-breakdown-label">Theo automation</div>
            {stats.byAutomation.slice(0, 8).map((s) => (
              <div key={s.id} className="xa-log-breakdown-row">
                <span className="xa-log-breakdown-name">{s.id}</span>
                <div className="xa-log-breakdown-bar">
                  <div
                    className="xa-log-breakdown-fill"
                    style={{ width: `${(s.total / stats.total) * 100}%` }}
                  />
                </div>
                <span className="xa-log-breakdown-count">
                  {s.total}
                  {s.errors > 0 && <span className="xa-log-breakdown-err"> · {s.errors}❌</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log entries */}
      <div className="xa-activity-header">
        <span>Live Activity Log</span>
        <div className="xa-activity-controls">
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
          <button type="button" className="xa-btn-small" onClick={clearLog}>
            Clear
          </button>
        </div>
      </div>
      <div className="xa-activity-log">
        {filtered.length === 0 ? (
          <div className="xa-log-empty">
            {filter === 'all'
              ? 'Chưa có log. Chạy automation hoặc Agent để xem hoạt động.'
              : 'Không có log cho filter này.'}
          </div>
        ) : (
          filtered.slice(0, 100).map((entry, i) => (
            <div className={`xa-log-entry xa-log-type-${entry.type}`} key={`${entry.time}-${i}`}>
              <span className="xa-log-time" title={new Date(entry.time).toLocaleTimeString()}>
                {formatRelativeTime(entry.time)}
              </span>
              <span className="xa-log-icon" aria-hidden="true">
                {ICONS[entry.type] || '📘'}
              </span>
              <span className="xa-log-message">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
