// XActions Extension — HTTP-first tool dispatcher with DOM fallback.
// by nichxbt

/**
 * @typedef {import('../../src/scrapers/twitter/http/client.js').TwitterHttpClient} TwitterHttpClient
 * The shared {@link TwitterHttpClient} exposed by the bundled HTTP client.
 */

/**
 * @typedef {object} ToolArgs
 * @property {string} [tweetId]
 * @property {string} [id]
 * @property {string} [url]
 * @property {string} [tweet]
 * @property {string} [username]
 * @property {string} [user]
 * @property {string} [text]
 * @property {string} [content]
 * @property {string} [query]
 * @property {string} [q]
 * @property {number} [max]
 * @property {number} [count]
 */

/**
 * @typedef {object} ToolResult
 * @property {boolean} success
 * @property {string} [action]
 * @property {string} [tweet]
 * @property {string} [tweetId]
 * @property {string} [text]
 * @property {object} [profile]
 * @property {object} [tweet]
 * @property {Array} [tweets]
 * @property {string} [error]
 */

/**
 * @typedef {Error} NoFallbackError
 * Errors that should not trigger a DOM fallback (auth, not found, rate limit, bad args).
 */

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

  /**
   * Build (or reuse) a browser-mode {@link TwitterHttpClient} seeded with the
   * user's x.com / twitter.com cookies.
   * @param {boolean} [force] - Ignore the cached instance and create a fresh one.
   * @returns {Promise<TwitterHttpClient>}
   */
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

  /**
   * Try an HTTP-backed tool first; fall back to the DOM page tool only when the
   * HTTP path reports a transient / retryable error.
   * @param {string} name - Tool name (e.g. `x_like`).
   * @param {ToolArgs} [args] - Tool arguments.
   * @returns {Promise<ToolResult>}
   */
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
