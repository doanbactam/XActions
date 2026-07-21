// by nichxbt
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import type { GlobalSettings } from '../../types';
import { useToast } from '../ToastProvider';

interface SettingsTabProps {
  onGoToPlan: () => void;
}

export function SettingsTab({ onGoToPlan }: SettingsTabProps) {
  const toast = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [globalSettings, setGlobalSettings] = React.useState<GlobalSettings>({
    minDelay: 2000,
    maxDelay: 5000,
    debug: true,
  });

  React.useEffect(() => {
    chrome.storage.local.get('globalSettings').then((data) => {
      if (data.globalSettings) setGlobalSettings((prev) => ({ ...prev, ...data.globalSettings }));
    });
  }, []);

  const saveGlobal = (patch: Partial<GlobalSettings>) => {
    setGlobalSettings((prev) => {
      const next = { ...prev, ...patch };
      chrome.storage.local.set({ globalSettings: next });
      return next;
    });
    toast.show('Settings saved', 'success');
  };

  const exportSettings = async () => {
    const data = await chrome.storage.local.get(null);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xactions-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('Settings exported', 'success');
  };

  const importSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await chrome.storage.local.set(data);
      toast.show('Settings imported — reloading...', 'success');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.show(`Import failed: ${(err as Error).message}`, 'error');
    }
  };

  const resetAll = async () => {
    if (!confirm('This will delete ALL XActions data and settings. Continue?')) return;
    await chrome.storage.local.clear();
    toast.show('All data reset', 'warning');
    setTimeout(() => location.reload(), 500);
  };

  return (
    <section className="xa-tab-content">
      <div className="xa-settings-section">
        <h3>Global Settings</h3>
        <label className="xa-field">
          <span className="xa-field-label">Default min delay (ms)</span>
          <input
            type="number"
            className="xa-input"
            min={500}
            max={30000}
            value={globalSettings.minDelay}
            onChange={(e) => saveGlobal({ minDelay: parseInt(e.target.value, 10) || 0 })}
          />
        </label>
        <label className="xa-field">
          <span className="xa-field-label">Default max delay (ms)</span>
          <input
            type="number"
            className="xa-input"
            min={1000}
            max={60000}
            value={globalSettings.maxDelay}
            onChange={(e) => saveGlobal({ maxDelay: parseInt(e.target.value, 10) || 0 })}
          />
        </label>
        <label className="xa-checkbox-label">
          <Checkbox.Root
            checked={globalSettings.debug}
            onCheckedChange={(v) => saveGlobal({ debug: !!v })}
            className="xa-checkbox"
          >
            <Checkbox.Indicator className="xa-checkbox-indicator">✓</Checkbox.Indicator>
          </Checkbox.Root>
          Debug logging
        </label>
      </div>

      <div className="xa-settings-section">
        <h3>AI Agent</h3>
        <p className="xa-settings-hint">
          Tab <strong>Plan</strong> = Strategist (phân tích → kịch bản). Key/OAuth lưu <code>chrome.storage.local</code> trên máy này.
        </p>
        <button type="button" className="xa-btn-secondary" onClick={onGoToPlan}>
          Mở tab Plan
        </button>
      </div>

      <div className="xa-settings-section">
        <h3>Data</h3>
        <button type="button" className="xa-btn-secondary" onClick={exportSettings}>
          Export settings
        </button>
        <button type="button" className="xa-btn-secondary" onClick={() => fileInputRef.current?.click()}>
          Import settings
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importSettings} />
        <button type="button" className="xa-btn-danger" onClick={resetAll}>
          Reset all data
        </button>
      </div>

      <div className="xa-settings-footer">
        <a href="https://github.com/nirholas/XActions" target="_blank" rel="noreferrer">
          XActions on GitHub
        </a>
        <span>v1.4.0 — by nichxbt</span>
      </div>
    </section>
  );
}
