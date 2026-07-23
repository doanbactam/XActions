// XActions Extension — User notifications from the service worker.
// by nichxbt

(() => {
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

  globalThis.XActionsBackgroundNotifications = { notifyUser };
})();
