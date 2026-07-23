// XActions Extension — Context menu click handlers.
// by nichxbt

(() => {
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
})();
