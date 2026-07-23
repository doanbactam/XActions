// XActions Extension — Background Service Worker
// Thin router: imports canonical background modules and dispatches messages.
// by nichxbt

importScripts(
  '../agent/catalog.js',
  '../agent/xai-oauth.js',
  '../agent/llm.js',
  '../agent/http-client.bundle.js',
  '../agent/tools.js',
  '../agent/agent-core.js',
  '../agent/strategist.js',
  'state.js',
  'notifications.js',
  'activity.js',
  'tabs.js',
  'automations.js',
  'http-tools.js',
  'agent.js',
  'alarms.js',
  'menus.js',
  'web-request.js',
);

// ============================================
// INITIALIZATION
// ============================================
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('✅ XActions extension installed');
  await chrome.storage.local.set({
    automations: {},
    activityLog: [],
    globalPaused: false,
    totalActions: 0,
  });
  chrome.action.setBadgeBackgroundColor({ color: '#1d9bf0' });
  chrome.action.setBadgeText({ text: '' });

  if (details.reason === 'install') {
    await chrome.storage.local.set({ firstRun: true });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'xactions-download-video',
      title: 'Download video (XActions)',
      contexts: ['link', 'video', 'page'],
      documentUrlPatterns: ['https://x.com/*', 'https://twitter.com/*'],
    });
    chrome.contextMenus.create({
      id: 'xactions-unroll-thread',
      title: 'Unroll thread (XActions)',
      contexts: ['link', 'page'],
      documentUrlPatterns: ['https://x.com/*', 'https://twitter.com/*'],
    });
    chrome.contextMenus.create({
      id: 'xactions-analyze-account',
      title: 'Analyze account (XActions)',
      contexts: ['link', 'page'],
      documentUrlPatterns: ['https://x.com/*', 'https://twitter.com/*'],
    });
  });
});

// ============================================
// MESSAGE HANDLER
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    console.error('Message handler error:', err);
    sendResponse({ error: err.message || String(err) });
  });
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  const agent = globalThis.XActionsBackgroundAgent;
  const automations = globalThis.XActionsBackgroundAutomations;
  const stateApi = globalThis.XActionsBackgroundState;

  switch (message.type) {
    case 'START_AUTOMATION':
      return automations.startAutomation(message.automationId, message.settings);
    case 'STOP_AUTOMATION':
      return automations.stopAutomation(message.automationId);
    case 'STOP_ALL':
      return automations.stopAll();
    case 'GET_STATE':
      return stateApi.getState();
    case 'ACTION_PERFORMED':
      return globalThis.XActionsBackgroundActivity.recordAction(
        message.automationId,
        message.action,
      );
    case 'ACTIVITY_LOG':
      return globalThis.XActionsBackgroundActivity.logActivity(message.entry);
    case 'GET_ACCOUNT_INFO':
      return { success: true };
    case 'GLOBAL_PAUSE':
      return automations.globalPause();
    case 'GLOBAL_RESUME':
      return automations.globalResume();
    case 'AGENT_CHAT':
      return agent.runAgentChat(message);
    case 'AGENT_RUN_STRATEGY':
      return agent.runAgentStrategy(message);
    case 'AGENT_EXECUTE_PLAYBOOK':
      return agent.runAgentExecutePlaybook(message);
    case 'AGENT_EXECUTE_PLAYBOOK_BACKGROUND':
      return agent.runAgentExecutePlaybook({ ...message, background: true });
    case 'AGENT_GET_PLAYBOOK':
      return agent.getAgentPlaybook();
    case 'AGENT_CLEAR_PLAYBOOK':
      return agent.clearAgentPlaybook();
    case 'AGENT_UPDATE_STEPS':
      return agent.updatePlaybookSteps(message.updates || []);
    case 'AGENT_GET_CONFIG':
      return agent.getAgentConfig();
    case 'AGENT_SAVE_CONFIG':
      return agent.saveAgentConfig(message.config);
    case 'AGENT_CLEAR_HISTORY':
      await chrome.storage.local.set({ agentChatHistory: [] });
      return { success: true };
    case 'AGENT_GET_BACKGROUND':
      return agent.getAgentBackground();
    case 'AGENT_SET_BACKGROUND':
      return agent.setAgentBackground(!!message.enabled);
    case 'AGENT_SCHEDULE_PLAYBOOK':
      return agent.setAgentSchedule(message.schedule || {});
    case 'AGENT_TEST_LLM':
      return agent.testAgentLlm(message.config);
    case 'XAI_OAUTH_START':
      return agent.startXaiOauth();
    case 'XAI_OAUTH_POLL':
      return agent.pollXaiOauth();
    case 'XAI_OAUTH_STATUS':
      return agent.getXaiOauthStatus();
    case 'XAI_OAUTH_PENDING':
      return agent.getXaiOauthPending();
    case 'XAI_OAUTH_OPEN_PANEL':
      return agent.openXaiOauthPanel();
    case 'XAI_OAUTH_LOGOUT':
      return agent.logoutXaiOauth();
    case 'AGENT_TOOL_RESULT':
      return { success: true };
    default:
      return { error: 'Unknown message type' };
  }
}

// ============================================
// BOOT
// ============================================
globalThis.XActionsBackgroundState.loadPersistentState().then(() => {
  globalThis.XActionsBackgroundAgent?.restoreScheduleAlarm?.();
});
