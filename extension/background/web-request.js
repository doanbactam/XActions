// XActions Extension — Detect rate-limiting from X/Twitter network responses.
// by nichxbt

(() => {
  const { logActivity } = globalThis.XActionsBackgroundActivity;

  chrome.webRequest?.onCompleted?.addListener?.(
    async (details) => {
      if (details.statusCode === 429) {
        await globalThis.XActionsBackgroundAutomations?.globalPause?.();
        await logActivity({
          time: Date.now(),
          type: 'error',
          automation: 'system',
          message: 'Rate limit detected (HTTP 429) — automations paused',
        });
        await chrome.storage.local.set({ rateLimited: true });

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
})();
