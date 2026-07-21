// by nichxbt
import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { Header } from './components/Header';
import { AccountCard } from './components/AccountCard';
import { DisconnectedBanner, RateLimitBanner } from './components/Banners';
import { OnboardingDialog } from './components/OnboardingDialog';
import { PlanTab } from './components/tabs/PlanTab';
import { ActivityTab } from './components/tabs/ActivityTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { useExtensionState } from './lib/useExtensionState';
import { sendMessage } from './lib/rpc';
import { useToast } from './components/ToastProvider';
import type { AccountInfo } from './types';

const TABS = [
  { id: 'agent', icon: '◈', label: 'Plan' },
  { id: 'activity', icon: '☰', label: 'Log' },
  { id: 'settings', icon: '⚙', label: 'Cài đặt' },
] as const;

export function App() {
  const toast = useToast();
  const state = useExtensionState();
  const [tab, setTab] = React.useState<string>('agent');
  const [connected, setConnected] = React.useState(false);
  const [account, setAccount] = React.useState<AccountInfo | null>(null);
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  const [rateLimited, setRateLimited] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        const isXTab = !!activeTab?.url && (activeTab.url.includes('x.com') || activeTab.url.includes('twitter.com'));
        setConnected(isXTab);
        if (isXTab && activeTab.id) {
          try {
            await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_ACCOUNT_INFO' });
          } catch {
            /* content script not ready */
          }
        }
      } catch {
        /* noop */
      }
    })();

    const listener = (message: { type?: string; data?: AccountInfo }) => {
      if (message.type === 'ACCOUNT_INFO_RESPONSE' && message.data) {
        setAccount(message.data);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    chrome.storage.local.get(['firstRun', 'rateLimited']).then((data) => {
      if (data.firstRun) setOnboardingOpen(true);
      if (data.rateLimited) setRateLimited(true);
    });

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleEmergencyStop();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        handleTogglePause();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.globalPaused]);

  const handleEmergencyStop = async () => {
    const res = await sendMessage<{ success: boolean }>({ type: 'STOP_ALL' });
    if (res?.success) {
      Object.keys(state.automations).forEach((id) => state.patchAutomation(id, { running: false }));
      state.pushLocalLog({ time: Date.now(), type: 'stop', automation: 'all', message: 'Emergency stop — all automations halted' });
      toast.show('All automations stopped', 'warning');
    }
  };

  const handleTogglePause = async () => {
    if (state.globalPaused) {
      const res = await sendMessage<{ success: boolean }>({ type: 'GLOBAL_RESUME' });
      if (res?.success) {
        state.setGlobalPaused(false);
        toast.show('Automations resumed', 'success');
      }
    } else {
      const res = await sendMessage<{ success: boolean }>({ type: 'GLOBAL_PAUSE' });
      if (res?.success) {
        state.setGlobalPaused(true);
        toast.show('Automations paused', 'warning');
      }
    }
  };

  const handleOnboardingStart = async (enablePopular: boolean) => {
    setOnboardingOpen(false);
    await chrome.storage.local.set({ firstRun: false });
    if (enablePopular) {
      await chrome.storage.local.set({
        settings_videoDownloader: { quality: 'highest', showButton: true, autoDownload: false },
        settings_threadReader: { showUnrollBtn: true, autoDetect: true, maxTweets: 50 },
      });
      toast.show('Popular features enabled!', 'success');
    }
  };

  return (
    <div className="xa-app">
      <Header
        connected={connected}
        headerSub="Plan · tab x.com đã login"
        paused={state.globalPaused}
        onTogglePause={handleTogglePause}
        onEmergencyStop={handleEmergencyStop}
      />

      <DisconnectedBanner visible={!connected} />
      <AccountCard connected={connected} account={account} />

      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as string)} className="xa-tabs-root">
        <Tabs.List className="xa-tabs-nav">
          {TABS.map((t) => (
            <Tabs.Tab key={t.id} value={t.id} className="xa-tab">
              <span className="xa-tab-icon">{t.icon}</span>
              <span className="xa-tab-text">{t.label}</span>
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="agent" className="xa-tabs-panel">
          <PlanTab />
        </Tabs.Panel>
        <Tabs.Panel value="activity" className="xa-tabs-panel">
          <ActivityTab activityLog={state.activityLog} onCleared={state.refresh} />
        </Tabs.Panel>
        <Tabs.Panel value="settings" className="xa-tabs-panel">
          <SettingsTab onGoToPlan={() => setTab('agent')} />
        </Tabs.Panel>
      </Tabs.Root>

      <RateLimitBanner
        visible={rateLimited}
        onDismiss={() => {
          setRateLimited(false);
          chrome.storage.local.set({ rateLimited: false });
        }}
      />

      <OnboardingDialog open={onboardingOpen} onStart={handleOnboardingStart} />
    </div>
  );
}
