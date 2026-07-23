// XActions Extension — Tab lifecycle, navigation, and DOM tool dispatch.
// by nichxbt

(() => {
  const { state } = globalThis.XActionsBackgroundState;

  async function getXTabs() {
    return chrome.tabs.query({
      url: ['https://x.com/*', 'https://twitter.com/*'],
    });
  }

  async function persistOwnedTabs() {
    try {
      await chrome.storage.local.set({ ownedTabIds: Array.from(state.ownedTabIds) });
    } catch { /* ignore */ }
  }

  async function closeOwnedBackgroundTabs(excludeTabId) {
    if (!state.backgroundMode) return;
    const ids = Array.from(state.ownedTabIds).filter((id) => id && id !== excludeTabId);
    state.ownedTabIds.clear();
    await persistOwnedTabs();
    for (const id of ids) {
      try {
        await chrome.tabs.remove(id);
      } catch { /* tab may already be closed */ }
    }
  }

  /** Build absolute x.com URL from path or full URL */
  function toXUrl(pathOrUrl) {
    if (!pathOrUrl) return null;
    let u = String(pathOrUrl).trim();
    if (u.startsWith('/')) return `https://x.com${u}`;
    if (/^https?:\/\//i.test(u)) {
      try {
        const parsed = new URL(u);
        if (!/x\.com|twitter\.com/i.test(parsed.hostname)) return null;
        parsed.hostname = 'x.com';
        return parsed.toString();
      } catch {
        return null;
      }
    }
    return `https://x.com/${u.replace(/^@/, '')}`;
  }

  async function ensureXTab(opts = {}) {
    const background = opts.background ?? state.backgroundMode;

    if (!background) {
      try {
        const active = await chrome.tabs.query({ active: true, currentWindow: true });
        const t = active[0];
        if (t?.id && t.url && (t.url.includes('x.com') || t.url.includes('twitter.com'))) {
          return t;
        }
      } catch { /* ignore */ }
    }

    const tabs = await getXTabs();
    if (tabs[0]) return tabs[0];

    if (background) {
      try {
        const win = await chrome.windows.create({
          url: 'https://x.com/home',
          type: 'normal',
          state: 'minimized',
        });
        const tab = win.tabs?.[0];
        if (tab?.id) {
          state.ownedTabIds.add(tab.id);
          await persistOwnedTabs();
        }
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 500));
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
            return tab;
          } catch { /* not ready */ }
        }
        return tab;
      } catch { /* fall back to inactive tab */ }
    }

    const tab = await chrome.tabs.create({ url: 'https://x.com/home', active: !background });
    if (tab?.id && background) {
      state.ownedTabIds.add(tab.id);
      await persistOwnedTabs();
    }
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        return tab;
      } catch { /* not ready */ }
    }
    return tab;
  }

  /** SW-side navigation — survives full page load. */
  async function navigateXTab(pathOrUrl, opts = {}) {
    const url = toXUrl(pathOrUrl);
    if (!url) return { error: 'Invalid x.com url', pathOrUrl };

    const background = opts.background ?? state.backgroundMode;
    let tab = await ensureXTab({ background });
    if (!tab?.id) return { error: 'Cannot open x.com tab' };

    const current = tab.url || '';
    const same =
      current.replace(/\/$/, '') === url.replace(/\/$/, '') ||
      current.split('?')[0].replace(/\/$/, '') === url.split('?')[0].replace(/\/$/, '');

    if (!same) {
      await chrome.tabs.update(tab.id, { url, active: !background });
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
            background,
          };
        } catch { /* keep waiting */ }
      }
      const updated = await chrome.tabs.get(tab.id).catch(() => tab);
      return {
        success: true,
        navigated: true,
        url: updated?.url || url,
        background,
        warning: 'Tab navigated but content script not ready yet — wait or retry',
      };
    }

    return { success: true, navigated: false, url: current, method: 'already_there', background };
  }

  /** Tools that must navigate in SW so injected script is not killed. */
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
      a.username ? `/${String(a.username).replace(/^@/, '')}/following` : null,
    x_open_lists: () => '/i/lists',
    x_open_communities: () => '/i/communities',
    x_open_bookmarks: () => '/i/bookmarks',
    x_open_settings: (a) =>
      a.path ? `/settings/${String(a.path).replace(/^\//, '')}` : '/settings',
    x_open_search_people: (a) =>
      `/search?q=${encodeURIComponent(a.query || '')}&f=user`,
    x_open_user: (a) => `/${String(a.username || '').replace(/^@/, '')}`,
    x_open_messages_user: () => '/messages/compose',
    x_refresh_page: null,
  };

  async function runPageTool(tool, args) {
    const a = args || {};

    if (tool === 'x_refresh_page') {
      const tab = await ensureXTab({ background: state.backgroundMode });
      if (!tab?.id) return { error: 'No x.com tab' };
      await chrome.tabs.reload(tab.id);
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 400));
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
          return { success: true, reloaded: true, url: (await chrome.tabs.get(tab.id)).url };
        } catch { /* wait */ }
      }
      return { success: true, reloaded: true, warning: 'reload done, script still warming' };
    }

    if (Object.prototype.hasOwnProperty.call(SW_NAV_TOOLS, tool)) {
      const builder = SW_NAV_TOOLS[tool];
      if (typeof builder === 'function') {
        const path = builder(a);
        if (!path) return { error: `Missing args for ${tool}` };
        return navigateXTab(path, { background: state.backgroundMode });
      }
    }

    let tab;
    try {
      tab = await ensureXTab({ background: state.backgroundMode });
    } catch {
      return { error: 'Cannot ensure x.com tab' };
    }
    if (!tab?.id) return { error: 'Open x.com in a tab first' };

    const requestId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
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

      const timeoutMs = /search|compose|thread|follow_visible|matching|detail|likes_tab|dm/i.test(tool)
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
              error: err2.message || err.message || 'Content script not ready — refresh the x.com tab',
            });
            return false;
          }
        }
      }

      deliver().then((ok) => {
        if (!ok) return;
        setTimeout(() => finish({ error: `Page tool timeout (${timeoutMs / 1000}s): ${tool}` }), timeoutMs);
      });
    });
  }

  globalThis.XActionsBackgroundTabs = {
    getXTabs,
    ensureXTab,
    navigateXTab,
    runPageTool,
    closeOwnedBackgroundTabs,
    persistOwnedTabs,
    toXUrl,
  };
})();
