// XActions Extension — chrome.alarms handlers.
// by nichxbt

(() => {
  const { runScheduledPlaybook } = globalThis.XActionsBackgroundAgent;
  const { closeOwnedBackgroundTabs } = globalThis.XActionsBackgroundTabs;

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'xactions-health-check') {
      const tabs = await globalThis.XActionsBackgroundTabs.getXTabs();
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        } catch (e) {
          console.log(`Tab ${tab.id} not responding`);
        }
      }
    } else if (alarm.name === 'xactions-scheduled-playbook') {
      await runScheduledPlaybook();
    } else if (alarm.name === 'xactions-close-owned-tabs') {
      await closeOwnedBackgroundTabs();
    }
  });

  chrome.alarms.create('xactions-health-check', { periodInMinutes: 1 });
})();
