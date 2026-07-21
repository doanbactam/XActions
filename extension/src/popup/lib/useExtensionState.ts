// Polls chrome.storage.local for automation/activity state — mirrors the
// 1s polling loop from the original popup.js so background automations
// (which run independently of the popup) stay reflected in the UI.
// by nichxbt

import * as React from 'react';
import type { ActivityEntry, AutomationsState } from '../types';

export function useExtensionState() {
  const [automations, setAutomations] = React.useState<AutomationsState>({});
  const [activityLog, setActivityLog] = React.useState<ActivityEntry[]>([]);
  const [globalPaused, setGlobalPaused] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const data = await chrome.storage.local.get(['automations', 'activityLog', 'globalPaused']);
      setAutomations(data.automations || {});
      setActivityLog(data.activityLog || []);
      setGlobalPaused(!!data.globalPaused);
    } catch {
      /* noop */
    }
  }, []);

  React.useEffect(() => {
    refresh();
    // Real-time update via storage.onChanged (no 1s polling lag)
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local') return;
      if (changes.automations) {
        setAutomations(changes.automations.newValue || {});
      }
      if (changes.activityLog) {
        setActivityLog(changes.activityLog.newValue || []);
      }
      if (changes.globalPaused) {
        setGlobalPaused(!!changes.globalPaused.newValue);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    // Fallback poll (1s) in case onChanged misses edge cases
    const id = setInterval(refresh, 1000);
    return () => {
      chrome.storage.onChanged.removeListener(onChanged);
      clearInterval(id);
    };
  }, [refresh]);

  const patchAutomation = React.useCallback((id: string, patch: Partial<AutomationsState[string]>) => {
    setAutomations((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const pushLocalLog = React.useCallback((entry: ActivityEntry) => {
    setActivityLog((prev) => [entry, ...prev]);
  }, []);

  return {
    automations,
    activityLog,
    globalPaused,
    setGlobalPaused,
    patchAutomation,
    pushLocalLog,
    refresh,
  };
}
