// by nichxbt
import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import type { AutomationDef, AutomationRuntimeState } from '../../types';
import { SettingField } from './SettingField';
import { formatDuration } from '../../lib/format';

interface AutomationCardProps {
  def: AutomationDef;
  hidden: boolean;
  runtime: AutomationRuntimeState | undefined;
  settings: Record<string, unknown>;
  onSettingChange: (id: string, key: string, value: unknown) => void;
  onToggle: (id: string, settings: Record<string, unknown>) => void;
  tick: number;
}

export function AutomationCard({ def, hidden, runtime, settings, onSettingChange, onToggle, tick }: AutomationCardProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const running = !!runtime?.running;
  const actionCount = runtime?.actionCount ?? 0;
  const maxActions = (settings.maxActions as number) || 100;
  const pct = running ? Math.min((actionCount / maxActions) * 100, 100) : 0;
  const elapsed = running && runtime?.startedAt ? formatDuration(Date.now() - runtime.startedAt) : '';
  void tick; // force re-render for the elapsed timer

  return (
    <div className={`xa-automation-card ${running ? 'is-running' : ''} ${hidden ? 'is-hidden' : ''}`} data-category={def.category}>
      <div className="xa-card-header">
        <div className="xa-card-icon" aria-hidden="true">
          {def.icon}
        </div>
        <div className="xa-card-info">
          <div className="xa-card-title">{def.title}</div>
          <div className="xa-card-desc">{def.desc}</div>
        </div>
        <span className={`xa-status-badge ${running ? 'is-running' : 'is-stopped'}`}>
          {running ? 'Running' : def.idleBadge}
        </span>
      </div>

      {running && def.fields.some((f) => f.key === 'maxActions') && (
        <div className="xa-card-progress">
          <div className="xa-progress-bar" style={{ width: `${pct}%` }} />
          <span className="xa-progress-text">
            {actionCount}/{maxActions}
          </span>
        </div>
      )}

      <div className="xa-card-actions">
        <span className="xa-action-count">
          {actionCount} {def.actionUnit}
          {actionCount !== 1 ? 's' : ''}
        </span>
        {running && elapsed && <span className="xa-session-timer">{elapsed}</span>}
        <button type="button" className="xa-btn-settings" title="Settings" onClick={() => setSettingsOpen((v) => !v)}>
          ⚙️
        </button>
        <button
          type="button"
          className="xa-btn-toggle"
          title={running ? def.toggleRunningLabel : def.toggleIdleLabel}
          onClick={() => onToggle(def.id, settings)}
        >
          {running ? '⏹' : '▶️'}
        </button>
      </div>

      <Collapsible.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Collapsible.Panel className="xa-card-settings">
          {def.fields.map((field) => (
            <SettingField
              key={field.key}
              field={field}
              value={settings[field.key] ?? field.default}
              onChange={(key, value) => onSettingChange(def.id, key, value)}
            />
          ))}
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
