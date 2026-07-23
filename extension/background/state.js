// XActions Extension — Background runtime state & persistence.
// IIFE loaded before other background modules.
// by nichxbt

(() => {
  const state = {
    activeAutomations: {},
    totalActions: 0,
    globalPaused: false,
    agentBusy: false,
    backgroundMode: false,
    ownedTabIds: new Set(),
    agentSchedule: null,
  };

  function getState() {
    return {
      activeAutomations: state.activeAutomations,
      totalActions: state.totalActions,
      globalPaused: state.globalPaused,
      agentBusy: state.agentBusy,
      backgroundMode: state.backgroundMode,
      agentSchedule: state.agentSchedule,
    };
  }

  async function syncState() {
    await chrome.storage.local.set({
      automations: state.activeAutomations,
      globalPaused: state.globalPaused,
      totalActions: state.totalActions,
    });
  }

  function updateBadge() {
    const activeCount = Object.keys(state.activeAutomations).length;
    if (activeCount === 0) {
      chrome.action.setBadgeText({ text: '' });
    } else {
      chrome.action.setBadgeText({ text: String(activeCount) });
    }
    chrome.action.setBadgeBackgroundColor({
      color: activeCount > 0 ? '#00ba7c' : '#1d9bf0',
    });
  }

  async function loadPersistentState() {
    const data = await chrome.storage.local.get([
      'automations',
      'totalActions',
      'globalPaused',
      'agentBackgroundMode',
      'agentSchedule',
      'ownedTabIds',
    ]);
    if (data.automations) state.activeAutomations = data.automations;
    if (data.totalActions) state.totalActions = data.totalActions;
    if (data.globalPaused) state.globalPaused = data.globalPaused;
    if (typeof data.agentBackgroundMode === 'boolean') state.backgroundMode = data.agentBackgroundMode;
    if (data.agentSchedule) state.agentSchedule = data.agentSchedule;
    if (Array.isArray(data.ownedTabIds)) {
      state.ownedTabIds = new Set(data.ownedTabIds);
    }
    updateBadge();
  }

  globalThis.XActionsBackgroundState = {
    state,
    getState,
    syncState,
    updateBadge,
    loadPersistentState,
  };
})();
