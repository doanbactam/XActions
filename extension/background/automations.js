// XActions Extension — Classic automation lifecycle (content-script automations).
// by nichxbt

(() => {
  const { state, syncState, updateBadge } = globalThis.XActionsBackgroundState;
  const { logActivity } = globalThis.XActionsBackgroundActivity;
  const { getXTabs, ensureXTab } = globalThis.XActionsBackgroundTabs;

  async function startAutomation(automationId, settings, opts = {}) {
    const background = opts.background ?? state.backgroundMode;
    state.activeAutomations[automationId] = {
      running: true,
      actionCount: 0,
      startedAt: Date.now(),
      settings: settings || {},
    };

    await syncState();
    updateBadge();

    try {
      await chrome.storage.local.set({ [`settings_${automationId}`]: settings || {} });
    } catch { /* ignore */ }

    let delivered = false;
    let lastError = null;
    const tab = await ensureXTab({ background });
    const targets = tab ? [tab] : await getXTabs();

    for (const t of targets) {
      if (!t?.id) continue;
      try {
        await chrome.tabs.sendMessage(t.id, {
          type: 'RUN_AUTOMATION',
          automationId,
          settings: settings || {},
        });
        delivered = true;
      } catch (e) {
        lastError = e?.message || String(e);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: t.id },
            files: ['content/bridge.js'],
          });
          await new Promise((r) => setTimeout(r, 400));
          await chrome.tabs.sendMessage(t.id, {
            type: 'RUN_AUTOMATION',
            automationId,
            settings: settings || {},
          });
          delivered = true;
          lastError = null;
        } catch (e2) {
          lastError = e2?.message || String(e2);
        }
      }
    }

    await logActivity({
      time: Date.now(),
      type: 'start',
      automation: automationId,
      message: delivered
        ? `Agent started ${automationId}`
        : `Agent failed to start ${automationId}: ${lastError || 'no x.com tab'}`,
    });

    if (!delivered) {
      delete state.activeAutomations[automationId];
      await syncState();
      updateBadge();
      return {
        success: false,
        automationId,
        error: lastError || 'Could not reach x.com content script — open x.com and reload the page',
      };
    }

    return { success: true, automationId, settings: settings || {} };
  }

  async function stopAutomation(automationId) {
    if (state.activeAutomations[automationId]) {
      state.activeAutomations[automationId].running = false;
    }
    delete state.activeAutomations[automationId];

    await syncState();
    updateBadge();

    const tabs = await getXTabs();
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'STOP_AUTOMATION',
          automationId,
        });
      } catch (e) { /* noop */ }
    }

    await logActivity({
      time: Date.now(),
      type: 'stop',
      automation: automationId,
      message: `Stopped ${automationId}`,
    });

    return { success: true };
  }

  async function stopAll() {
    const ids = Object.keys(state.activeAutomations);
    state.activeAutomations = {};
    state.globalPaused = false;

    await syncState();
    updateBadge();

    const tabs = await getXTabs();
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_ALL' });
      } catch (e) { /* noop */ }
    }

    await logActivity({
      time: Date.now(),
      type: 'stop',
      automation: 'all',
      message: `Emergency stop — all automations halted (${ids.length} stopped)`,
    });

    return { success: true, stopped: ids };
  }

  async function globalPause() {
    state.globalPaused = true;
    await syncState();

    const tabs = await getXTabs();
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PAUSE_ALL' });
      } catch (e) { /* noop */ }
    }

    return { success: true };
  }

  async function globalResume() {
    state.globalPaused = false;
    await syncState();

    const tabs = await getXTabs();
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'RESUME_ALL' });
      } catch (e) { /* noop */ }
    }

    return { success: true };
  }

  globalThis.XActionsBackgroundAutomations = {
    startAutomation,
    stopAutomation,
    stopAll,
    globalPause,
    globalResume,
  };
})();
