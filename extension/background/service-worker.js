// XActions Extension — Background Service Worker
// Manages automation state, badge updates, alarm scheduling, AI agent
// by nichxbt

importScripts(
  '../agent/catalog.js',
  '../agent/xai-oauth.js',
  '../agent/llm.js',
  '../agent/tools.js',
  '../agent/agent-core.js',
  '../agent/strategist.js',
);

// ============================================
// STATE
// ============================================
const state = {
  activeAutomations: {},  // { automationId: { running, actionCount, startedAt, settings } }
  totalActions: 0,
  globalPaused: false,
  agentBusy: false,
};

function getState() {
  return {
    activeAutomations: state.activeAutomations,
    totalActions: state.totalActions,
    globalPaused: state.globalPaused,
    agentBusy: state.agentBusy,
  };
}

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

  // First-run flag
  if (details.reason === 'install') {
    await chrome.storage.local.set({ firstRun: true });
  }

  // Context menus
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
  handleMessage(message, sender).then(sendResponse).catch(err => {
    console.error('Message handler error:', err);
    sendResponse({ error: err.message });
  });
  return true; // Keep the message channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'START_AUTOMATION':
      return startAutomation(message.automationId, message.settings);

    case 'STOP_AUTOMATION':
      return stopAutomation(message.automationId);

    case 'STOP_ALL':
      return stopAll();

    case 'GET_STATE':
      return getState();

    case 'ACTION_PERFORMED':
      return recordAction(message.automationId, message.action);

    case 'ACTIVITY_LOG':
      return logActivity(message.entry);

    case 'GET_ACCOUNT_INFO':
      return { success: true }; // Handled by content script

    case 'GLOBAL_PAUSE':
      return globalPause();

    case 'GLOBAL_RESUME':
      return globalResume();

    case 'AGENT_CHAT':
      return runAgentChat(message);

    case 'AGENT_RUN_STRATEGY':
      return runAgentStrategy(message);

    case 'AGENT_EXECUTE_PLAYBOOK':
      return runAgentExecutePlaybook(message);

    case 'AGENT_GET_PLAYBOOK':
      return getAgentPlaybook();

    case 'AGENT_CLEAR_PLAYBOOK':
      return clearAgentPlaybook();

    case 'AGENT_UPDATE_STEPS':
      return updatePlaybookSteps(message.updates || []);

    case 'AGENT_GET_CONFIG':
      return getAgentConfig();

    case 'AGENT_SAVE_CONFIG':
      return saveAgentConfig(message.config);

    case 'AGENT_CLEAR_HISTORY':
      await chrome.storage.local.set({ agentChatHistory: [] });
      return { success: true };

    case 'AGENT_TEST_LLM':
      return testAgentLlm(message.config);

    case 'XAI_OAUTH_START':
      return startXaiOauth();

    case 'XAI_OAUTH_POLL':
      return pollXaiOauth();

    case 'XAI_OAUTH_STATUS':
      return getXaiOauthStatus();

    case 'XAI_OAUTH_PENDING':
      return getXaiOauthPending();

    case 'XAI_OAUTH_LOGOUT':
      return logoutXaiOauth();

    case 'AGENT_TOOL_RESULT':
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}

// ============================================
// AI AGENT
// ============================================
async function getAgentConfig() {
  const data = await chrome.storage.local.get([
    'agentLlm',
    'agentPersona',
    'agentSafety',
    'agentChatHistory',
    'agentPlaybook',
  ]);
  let llm = data.agentLlm || globalThis.XActionsAgent.defaultLlmConfig();
  if (llm.provider === 'xai' && !llm.apiKey) {
    llm = { ...llm, provider: 'xai-oauth', authMode: 'oauth' };
  }
  const oauth = globalThis.XActionsXaiOauth
    ? await globalThis.XActionsXaiOauth.getSession()
    : { signedIn: false };

  const pb = data.agentPlaybook;
  const toolKinds = {};
  for (const t of globalThis.XActionsCatalog?.TOOLS || []) {
    toolKinds[t.kind] = (toolKinds[t.kind] || 0) + 1;
  }

  return {
    success: true,
    llm,
    persona: data.agentPersona || globalThis.XActionsAgent.defaultPersona(),
    safety: data.agentSafety || globalThis.XActionsAgent.defaultSafety(),
    history: data.agentChatHistory || [],
    busy: state.agentBusy,
    oauth,
    toolCount: globalThis.XActionsCatalog?.count || 0,
    toolKinds,
    playbookMeta: pb
      ? {
          handle: pb.account?.handle || '',
          niche: pb.analysis?.niche || '',
          goal: pb.playbook?.goal || '',
          steps: pb.playbook?.steps?.length || 0,
          createdAt: pb.createdAt || null,
        }
      : null,
  };
}

async function startXaiOauth() {
  try {
    const started = await globalThis.XActionsXaiOauth.startDeviceLogin();
    // Open verification URL in a background tab so the popup keeps focus
    const url =
      started.verification_uri_complete || started.verification_uri;
    if (url) {
      try {
        await chrome.tabs.create({ url, active: false });
      } catch {
        /* popup may still show the URL */
      }
    }
    return { success: true, ...started };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

async function pollXaiOauth() {
  try {
    return await globalThis.XActionsXaiOauth.pollDeviceLogin();
  } catch (err) {
    return { status: 'error', error: err.message || String(err) };
  }
}

async function getXaiOauthStatus() {
  try {
    const session = await globalThis.XActionsXaiOauth.getSession();
    return { success: true, ...session };
  } catch (err) {
    return { success: false, signedIn: false, error: err.message };
  }
}

async function getXaiOauthPending() {
  try {
    const pending = await globalThis.XActionsXaiOauth.getPendingDevice();
    return { success: true, pending };
  } catch (err) {
    return { success: false, pending: null };
  }
}

async function logoutXaiOauth() {
  try {
    await globalThis.XActionsXaiOauth.logout();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

async function saveAgentConfig(config = {}) {
  const patch = {};
  if (config.llm) patch.agentLlm = config.llm;
  if (config.persona) patch.agentPersona = config.persona;
  if (config.safety) patch.agentSafety = config.safety;
  if (config.history) patch.agentChatHistory = config.history;
  await chrome.storage.local.set(patch);
  return { success: true };
}

async function testAgentLlm(configOverride) {
  try {
    let llmConfig = configOverride;
    if (!llmConfig) {
      const cfg = await getAgentConfig();
      llmConfig = { ...cfg.llm };
    } else {
      llmConfig = { ...llmConfig };
    }
    if (!llmConfig.baseUrl) delete llmConfig.baseUrl;
    if (!llmConfig.provider) llmConfig.provider = 'xai-oauth';
    if (!llmConfig.model) llmConfig.model = 'grok-4.5';
    llmConfig.authMode = llmConfig.provider === 'xai-oauth' ? 'oauth' : llmConfig.authMode;

    if (typeof globalThis.XActionsLLM?.testConnection === 'function') {
      return globalThis.XActionsLLM.testConnection(llmConfig);
    }

    const result = await globalThis.XActionsLLM.chatCompletion(
      llmConfig,
      [
        { role: 'system', content: 'Reply with exactly: ok' },
        { role: 'user', content: 'ping' },
      ],
      null,
      { temperature: 0, maxTokens: 8 },
    );
    return {
      ok: true,
      model: result.model,
      provider: result.provider || llmConfig.provider,
      preview: (result.message?.content || '').slice(0, 80),
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function buildAgentCtx(cfg, storage) {
  return {
    automations: storage.automations || state.activeAutomations,
    startAutomation: (id, settings) => startAutomation(id, settings),
    stopAutomation: (id) => stopAutomation(id),
    stopAll: () => stopAll(),
    globalPause: () => globalPause(),
    globalResume: () => globalResume(),
    savePersona: async (persona) => {
      await chrome.storage.local.set({ agentPersona: persona });
    },
    saveSafety: async (safety) => {
      await chrome.storage.local.set({ agentSafety: safety });
    },
    navigateTab: (url) => navigateXTab(url),
    pageTool: (name, args) => runPageTool(name, args),
    toolCatalog: () => globalThis.XActionsCatalog,
    persona: cfg.persona,
    safety: cfg.safety,
    llmConfig: cfg.llm,
  };
}

function normalizeLlmConfig(cfg) {
  const llmConfig = { ...(cfg.llm || {}) };
  if (!llmConfig.provider) llmConfig.provider = 'xai-oauth';
  if (!llmConfig.model) llmConfig.model = 'grok-4.5';
  if (llmConfig.provider === 'xai-oauth') llmConfig.authMode = 'oauth';
  if (!llmConfig.baseUrl) delete llmConfig.baseUrl;
  return llmConfig;
}

async function runAgentChat(message) {
  if (state.agentBusy) {
    return { ok: false, error: 'Agent is already running a turn. Wait a moment.' };
  }

  const userMessage = (message.userMessage || '').trim();
  if (!userMessage) return { ok: false, error: 'Empty message' };

  state.agentBusy = true;
  try {
    const cfg = await getAgentConfig();
    const llmConfig = normalizeLlmConfig(cfg);
    cfg.llm = llmConfig;

    const storage = await chrome.storage.local.get(['automations', 'agentChatHistory']);
    const history = storage.agentChatHistory || [];
    const ctx = buildAgentCtx(cfg, storage);

    const result = await globalThis.XActionsAgent.runAgentTurn({
      history: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
      userMessage,
      llmConfig,
      persona: cfg.persona,
      safety: cfg.safety,
      ctx,
    });

    if (result.ok) {
      const nextHistory = [
        ...history,
        { role: 'user', content: userMessage, time: Date.now() },
        {
          role: 'assistant',
          content: result.content,
          time: Date.now(),
          toolTrace: result.toolTrace || [],
        },
      ].slice(-40);
      await chrome.storage.local.set({ agentChatHistory: nextHistory });
      await logActivity({
        time: Date.now(),
        type: 'action',
        automation: 'aiAgent',
        message: `Agent: ${userMessage.slice(0, 80)}${userMessage.length > 80 ? '…' : ''}`,
      });
    }

    return result;
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    state.agentBusy = false;
  }
}

/** Analyze account → audience/style → playbook (primary flow) */
async function runAgentStrategy(message) {
  if (state.agentBusy) {
    return { ok: false, error: 'Agent đang bận — đợi xong lượt hiện tại.' };
  }
  if (!globalThis.XActionsStrategist?.runStrategyPipeline) {
    return { ok: false, error: 'Strategist module not loaded' };
  }

  state.agentBusy = true;
  try {
    const cfg = await getAgentConfig();
    const llmConfig = normalizeLlmConfig(cfg);
    cfg.llm = llmConfig;
    const storage = await chrome.storage.local.get(['automations']);

    const result = await globalThis.XActionsStrategist.runStrategyPipeline({
      llmConfig,
      persona: cfg.persona,
      safety: cfg.safety,
      pageTool: (name, args) => runPageTool(name, args),
      languageHint:
        message.languageHint ||
        'executiveBrief and user-facing text in Vietnamese. JSON keys English.',
      onProgress: async (ev) => {
        // Persist lightweight progress for popup polling
        await chrome.storage.local.set({
          agentStrategyProgress: { ...ev, at: Date.now() },
        });
      },
    });

    if (result.ok) {
      const history = (await chrome.storage.local.get(['agentChatHistory'])).agentChatHistory || [];
      const brief = result.brief || result.executiveBrief || 'Kịch bản đã tạo.';
      const nextHistory = [
        ...history,
        {
          role: 'user',
          content: '🔬 Phân tích tài khoản & lên kịch bản',
          time: Date.now(),
        },
        {
          role: 'assistant',
          content: brief,
          time: Date.now(),
          kind: 'playbook',
          playbook: {
            goal: result.playbook?.playbook?.goal,
            steps: result.playbook?.playbook?.steps?.length,
            niche: result.playbook?.analysis?.niche,
          },
        },
      ].slice(-40);
      await chrome.storage.local.set({ agentChatHistory: nextHistory });
      await logActivity({
        time: Date.now(),
        type: 'action',
        automation: 'strategist',
        message: `Strategist: playbook @${result.playbook?.account?.handle || '?'} · ${result.playbook?.playbook?.steps?.length || 0} steps`,
      });
      await notifyUser(
        'XActions · Kịch bản sẵn sàng',
        `@${result.playbook?.account?.handle || 'account'} · ${result.playbook?.playbook?.steps?.length || 0} bước — mở popup Agent để chạy`,
      );
    } else {
      await notifyUser('XActions · Phân tích lỗi', (result.error || 'failed').slice(0, 120));
    }

    return result;
  } catch (err) {
    await notifyUser('XActions · Phân tích lỗi', (err.message || String(err)).slice(0, 120));
    return { ok: false, error: err.message || String(err) };
  } finally {
    state.agentBusy = false;
    await chrome.storage.local.set({
      agentStrategyProgress: { phase: 'idle', at: Date.now() },
    });
  }
}

async function notifyUser(title, message) {
  try {
    if (!chrome.notifications?.create) return;
    await chrome.notifications.create(`xactions_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title || 'XActions',
      message: message || '',
      priority: 1,
    });
  } catch {
    /* notifications permission may be blocked */
  }
}

async function runAgentExecutePlaybook(message) {
  if (state.agentBusy) {
    return { ok: false, error: 'Agent đang bận.' };
  }
  if (!globalThis.XActionsStrategist?.executePlaybook) {
    return { ok: false, error: 'Strategist module not loaded' };
  }

  state.agentBusy = true;
  try {
    const cfg = await getAgentConfig();
    cfg.llm = normalizeLlmConfig(cfg);
    const storage = await chrome.storage.local.get(['automations']);
    const ctx = buildAgentCtx(cfg, storage);

    const result = await globalThis.XActionsStrategist.executePlaybook({
      playbook: message.playbook || null,
      ctx,
      onlyStepIds: message.onlyStepIds || null,
      selectedStepIds: message.selectedStepIds || null,
      force: !!message.force,
      onProgress: async (ev) => {
        await chrome.storage.local.set({
          agentStrategyProgress: { ...ev, at: Date.now() },
        });
      },
    });

    if (result.ok) {
      await logActivity({
        time: Date.now(),
        type: 'action',
        automation: 'strategist',
        message: `Execute playbook: ${result.summary}`,
      });
      await notifyUser('XActions · Đã chạy kịch bản', result.summary || 'done');
    }
    return result;
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    state.agentBusy = false;
  }
}

async function getAgentPlaybook() {
  if (!globalThis.XActionsStrategist?.loadPlaybook) {
    return { ok: false, playbook: null };
  }
  const data = await globalThis.XActionsStrategist.loadPlaybook();
  return { ok: true, ...data };
}

async function clearAgentPlaybook() {
  if (globalThis.XActionsStrategist?.clearPlaybook) {
    await globalThis.XActionsStrategist.clearPlaybook();
  }
  return { success: true };
}

async function updatePlaybookSteps(updates) {
  if (!globalThis.XActionsStrategist?.updateStepFlags) {
    return { ok: false, error: 'Strategist not loaded' };
  }
  return globalThis.XActionsStrategist.updateStepFlags(updates);
}

/** Build absolute x.com URL from path or full URL */
function toXUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  let u = String(pathOrUrl).trim();
  if (u.startsWith('/')) return `https://x.com${u}`;
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      if (!/x\.com|twitter\.com/i.test(parsed.hostname)) {
        return null;
      }
      parsed.hostname = 'x.com';
      return parsed.toString();
    } catch {
      return null;
    }
  }
  return `https://x.com/${u.replace(/^@/, '')}`;
}

/** SW-side navigation — survives full page load (page tools would die on location.href) */
async function navigateXTab(pathOrUrl) {
  const url = toXUrl(pathOrUrl);
  if (!url) return { error: 'Invalid x.com url', pathOrUrl };

  let tab = await ensureXTab();
  if (!tab?.id) return { error: 'Cannot open x.com tab' };

  const current = tab.url || '';
  const same =
    current.replace(/\/$/, '') === url.replace(/\/$/, '') ||
    current.split('?')[0].replace(/\/$/, '') === url.split('?')[0].replace(/\/$/, '');

  if (!same) {
    await chrome.tabs.update(tab.id, { url, active: true });
    // Wait for content script after navigation
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        const updated = await chrome.tabs.get(tab.id);
        return {
          success: true,
          navigated: true,
          url: updated.url,
          method: 'tabs.update',
        };
      } catch {
        /* keep waiting */
      }
    }
    const updated = await chrome.tabs.get(tab.id).catch(() => tab);
    return {
      success: true,
      navigated: true,
      url: updated?.url || url,
      warning: 'Tab navigated but content script not ready yet — wait or retry',
    };
  }

  return { success: true, navigated: false, url: current, method: 'already_there' };
}

/** Tools that must navigate in SW (hard nav) so injected script is not killed */
const SW_NAV_TOOLS = {
  x_navigate: (a) => a.url,
  x_go_home: () => '/home',
  x_go_profile: (a) => `/${String(a.username || '').replace(/^@/, '')}`,
  x_go_notifications: () => '/notifications',
  x_go_messages: () => '/messages',
  x_go_explore: (a) =>
    a.query
      ? `/search?q=${encodeURIComponent(a.query)}&src=typed_query`
      : '/explore',
  x_open_following_page: (a) =>
    a.username
      ? `/${String(a.username).replace(/^@/, '')}/following`
      : null,
  x_open_lists: () => '/i/lists',
  x_open_communities: () => '/i/communities',
  x_open_bookmarks: () => '/i/bookmarks',
  x_open_settings: (a) =>
    a.path ? `/settings/${String(a.path).replace(/^\//, '')}` : '/settings',
  x_open_search_people: (a) =>
    `/search?q=${encodeURIComponent(a.query || '')}&f=user`,
  x_open_user: (a) => `/${String(a.username || '').replace(/^@/, '')}`,
  x_open_messages_user: () => '/messages/compose',
  x_refresh_page: null, // special
};

async function runPageTool(tool, args) {
  const a = args || {};

  // ── SW-owned navigation ────────────────────────────────
  if (tool === 'x_refresh_page') {
    const tab = await ensureXTab();
    if (!tab?.id) return { error: 'No x.com tab' };
    await chrome.tabs.reload(tab.id);
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        return { success: true, reloaded: true, url: (await chrome.tabs.get(tab.id)).url };
      } catch {
        /* wait */
      }
    }
    return { success: true, reloaded: true, warning: 'reload done, script still warming' };
  }

  if (Object.prototype.hasOwnProperty.call(SW_NAV_TOOLS, tool)) {
    const builder = SW_NAV_TOOLS[tool];
    if (typeof builder === 'function') {
      const path = builder(a);
      if (!path) {
        return { error: `Missing args for ${tool}` };
      }
      return navigateXTab(path);
    }
  }

  // ── Page DOM tools via content script ──────────────────
  return new Promise(async (resolve) => {
    let tab = null;
    try {
      tab = await ensureXTab();
    } catch {
      resolve({ error: 'Cannot ensure x.com tab' });
      return;
    }

    if (!tab?.id) {
      resolve({ error: 'Open x.com in a tab first' });
      return;
    }

    const requestId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      chrome.runtime.onMessage.removeListener(listener);
      resolve(result);
    };

    const listener = (msg) => {
      if (msg?.type === 'AGENT_TOOL_RESULT' && msg.requestId === requestId) {
        finish(msg.result ?? { error: 'Empty tool result' });
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    const timeoutMs = /search|compose|thread|follow_visible|matching|detail|likes_tab|dm/i.test(
      tool,
    )
      ? 45000
      : 30000;

    async function deliver() {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'AGENT_TOOL',
          requestId,
          tool,
          args: a,
        });
        return true;
      } catch (err) {
        // Re-inject bridge and retry once
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/bridge.js'],
          });
          await new Promise((r) => setTimeout(r, 500));
          await chrome.tabs.sendMessage(tab.id, {
            type: 'AGENT_TOOL',
            requestId,
            tool,
            args: a,
          });
          return true;
        } catch (err2) {
          finish({
            error:
              err2.message ||
              err.message ||
              'Content script not ready — refresh the x.com tab',
          });
          return false;
        }
      }
    }

    const ok = await deliver();
    if (!ok) return;

    setTimeout(
      () => finish({ error: `Page tool timeout (${timeoutMs / 1000}s): ${tool}` }),
      timeoutMs,
    );
  });
}

// ============================================
// AUTOMATION LIFECYCLE
// ============================================
async function ensureXTab() {
  // Prefer active x.com tab in current window
  try {
    const active = await chrome.tabs.query({ active: true, currentWindow: true });
    const t = active[0];
    if (t?.id && t.url && (t.url.includes('x.com') || t.url.includes('twitter.com'))) {
      return t;
    }
  } catch { /* ignore */ }

  const tabs = await getXTabs();
  if (tabs[0]) return tabs[0];

  // Open x.com for the agent to run on
  const tab = await chrome.tabs.create({ url: 'https://x.com/home', active: true });
  // Wait briefly for content script
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      return tab;
    } catch {
      /* not ready */
    }
  }
  return tab;
}

async function startAutomation(automationId, settings) {
  state.activeAutomations[automationId] = {
    running: true,
    actionCount: 0,
    startedAt: Date.now(),
    settings: settings || {},
  };

  await syncState();
  updateBadge();

  // Persist per-automation settings for popup UI sync
  try {
    await chrome.storage.local.set({ [`settings_${automationId}`]: settings || {} });
  } catch { /* ignore */ }

  let delivered = false;
  let lastError = null;
  const tab = await ensureXTab();
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
      // Try re-inject content script then retry once
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

  // Notify content scripts
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

// ============================================
// ACTION TRACKING
// ============================================
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

  // Keep max 500 entries
  if (log.length > 500) log.length = 500;

  await chrome.storage.local.set({ activityLog: log });
  return { success: true };
}

// ============================================
// BADGE & STATE SYNC
// ============================================
function updateBadge() {
  const activeCount = Object.keys(state.activeAutomations).length;

  if (activeCount === 0) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeText({ text: String(activeCount) });
  }

  // Color: green when running, default blue otherwise
  chrome.action.setBadgeBackgroundColor({
    color: activeCount > 0 ? '#00ba7c' : '#1d9bf0',
  });
}

async function syncState() {
  await chrome.storage.local.set({
    automations: state.activeAutomations,
    globalPaused: state.globalPaused,
    totalActions: state.totalActions,
  });
}

// ============================================
// ALARMS (periodic check for pausing/resuming)
// ============================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'xactions-health-check') {
    // Periodically verify content scripts are still active
    const tabs = await getXTabs();
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      } catch (e) {
        // Content script not responding - tab may have navigated away
        console.log(`Tab ${tab.id} not responding`);
      }
    }
  }
});

// Set up periodic health check
chrome.alarms.create('xactions-health-check', { periodInMinutes: 1 });

// ============================================
// CONTEXT MENUS
// ============================================
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  switch (info.menuItemId) {
    case 'xactions-download-video':
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'RUN_AUTOMATION',
          automationId: 'videoDownloader',
          settings: { showButton: true, quality: 'highest' },
        });
      } catch (e) { /* content script not ready */ }
      break;

    case 'xactions-unroll-thread':
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'RUN_AUTOMATION',
          automationId: 'threadReader',
          settings: { showUnrollBtn: true, autoDetect: true },
        });
      } catch (e) { /* content script not ready */ }
      break;

    case 'xactions-analyze-account':
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'RUN_AUTOMATION',
          automationId: 'quickStats',
          settings: { showOverlay: true, sampleSize: 20 },
        });
      } catch (e) { /* content script not ready */ }
      break;
  }
});

// ============================================
// RATE LIMIT DETECTION
// ============================================
chrome.webRequest?.onCompleted?.addListener?.(
  async (details) => {
    if (details.statusCode === 429) {
      // Rate limited — pause all automations
      await globalPause();
      await logActivity({
        time: Date.now(),
        type: 'error',
        automation: 'system',
        message: 'Rate limit detected (HTTP 429) — automations paused',
      });
      await chrome.storage.local.set({ rateLimited: true });

      // Show notification if permission granted
      try {
        chrome.notifications.create('rate-limit', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'XActions — Rate Limited',
          message: 'X/Twitter rate limit detected. Automations paused automatically.',
        });
      } catch { /* notifications may not be available */ }
    }
  },
  { urls: ['https://x.com/*', 'https://twitter.com/*', 'https://api.x.com/*'] }
);

// ============================================
// HELPERS
// ============================================
async function getXTabs() {
  const tabs = await chrome.tabs.query({
    url: ['https://x.com/*', 'https://twitter.com/*'],
  });
  return tabs;
}

// Restore state on service worker restart
chrome.storage.local.get(['automations', 'totalActions', 'globalPaused']).then(data => {
  if (data.automations) state.activeAutomations = data.automations;
  if (data.totalActions) state.totalActions = data.totalActions;
  if (data.globalPaused) state.globalPaused = data.globalPaused;
  updateBadge();
});
