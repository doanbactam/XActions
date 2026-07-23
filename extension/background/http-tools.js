// XActions Extension — HTTP-first tool dispatcher with DOM fallback.
// by nichxbt

(() => {
  const { runPageTool } = globalThis.XActionsBackgroundTabs;

  let cachedClient = null;
  let cachedAt = 0;
  const CLIENT_CACHE_TTL_MS = 30_000;

  function shouldFallback(err) {
    const { errors } = globalThis.XActionsHttpClient || {};
    if (!errors) return true;
    if (err instanceof errors.NetworkError) return true;
    if (err instanceof errors.TwitterApiError) return false;
    if (/invalid (tweet id|username|args|query)/i.test(err.message || '')) return false;
    return true;
  }

  async function getHttpClient(force = false) {
    if (!force && cachedClient && Date.now() - cachedAt < CLIENT_CACHE_TTL_MS) {
      return cachedClient;
    }
    const Http = globalThis.XActionsHttpClient;
    if (!Http?.TwitterHttpClient) throw new Error('HTTP client module not loaded');

    const client = new Http.TwitterHttpClient({
      browserMode: true,
      debug: false,
      maxRetries: 1,
    });

    try {
      const cookies = await chrome.cookies.getAll({ url: 'https://x.com' });
      if (cookies?.length) {
        client.setCookies(cookies);
      } else {
        const twCookies = await chrome.cookies.getAll({ url: 'https://twitter.com' });
        if (twCookies?.length) client.setCookies(twCookies);
      }
    } catch (err) {
      console.warn('[XActions SW] Could not read x.com cookies:', err.message || err);
    }

    cachedClient = client;
    cachedAt = Date.now();
    return client;
  }

  async function runHybridPageTool(name, args) {
    const httpToolNames = globalThis.XActionsTools?.HTTP_TOOL_NAMES;
    if (!httpToolNames?.has?.(name) || !globalThis.XActionsTools?.runHttpTool) {
      return runPageTool(name, args);
    }

    try {
      const client = await getHttpClient();
      if (!client?.isAuthenticated?.()) {
        throw new globalThis.XActionsHttpClient.errors.AuthError('HTTP client not authenticated');
      }
      const r = await globalThis.XActionsTools.runHttpTool(client, name, args || {});
      if (r) return r;
    } catch (err) {
      if (!shouldFallback(err)) {
        console.warn(`[XActions SW] HTTP path for ${name} failed (no fallback):`, err.message || err);
        throw err;
      }
      console.warn(`[XActions SW] HTTP path for ${name} failed, falling back to page:`, err.message || err);
    }

    return runPageTool(name, args);
  }

  function invalidateHttpClient() {
    cachedClient = null;
    cachedAt = 0;
  }

  globalThis.XActionsBackgroundHttp = {
    getHttpClient,
    runHybridPageTool,
    invalidateHttpClient,
  };
})();
