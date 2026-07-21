// by nichxbt
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import type { ActivityEntry } from '../../types';
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

export function ActivityTab({ activityLog, onCleared }: ActivityTabProps) {
  const toast = useToast();
  const [filter, setFilter] = React.useState('all');

  const filtered = filter === 'all' ? activityLog : activityLog.filter((e) => e.automation === filter);

  const clearLog = async () => {
    await chrome.storage.local.set({ activityLog: [] });
    onCleared();
    toast.show('Activity log cleared', 'info');
  };

  return (
    <section className="xa-tab-content">
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
            {filter === 'all' ? 'No activity yet. Start an automation to see logs here.' : 'No activity for this filter.'}
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
