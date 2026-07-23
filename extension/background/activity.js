// XActions Extension — Activity log and action counter.
// by nichxbt

(() => {
  const { state, syncState, updateBadge } = globalThis.XActionsBackgroundState;

  async function recordAction(automationId, action) {
    if (state.activeAutomations[automationId]) {
      state.activeAutomations[automationId].actionCount++;
    }
    state.totalActions++;
    await syncState();
    updateBadge();
    return { success: true, totalActions: state.totalActions };
  }

  async function logActivity(entry) {
    const data = await chrome.storage.local.get('activityLog');
    const log = data.activityLog || [];
    log.unshift(entry);
    if (log.length > 500) log.length = 500;
    await chrome.storage.local.set({ activityLog: log });
    return { success: true };
  }

  globalThis.XActionsBackgroundActivity = { recordAction, logActivity };
})();
