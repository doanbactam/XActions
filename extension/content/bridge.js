// XActions Extension — Content Script Bridge
// Injected into x.com/twitter.com pages
// Bridges popup ↔ page context via chrome.runtime messaging
// by nichxbt

(() => {
  // Prevent double-injection on same load; allow re-entry after extension reload
  // only when prior bridge died (context invalidated).
  if (window.__xactions_bridge_alive && isExtensionAlive()) return;
  window.__xactions_bridge_loaded = true;
  window.__xactions_bridge_alive = true;

  /** True while this content-script still has a live extension ID. */
  function isExtensionAlive() {
    try {
      return !!(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function isContextError(err) {
    const msg = String(err?.message || err || '');
    return (
      /Extension context invalidated/i.test(msg) ||
      /context invalidated/i.test(msg) ||
      /message port closed/i.test(msg) ||
      /Receiving end does not exist/i.test(msg)
    );
  }

  let dead = false;
  function markDead(reason) {
    if (dead) return;
    dead = true;
    window.__xactions_bridge_alive = false;
    try {
      window.postMessage(
        {
          source: 'xactions-extension',
          type: 'EXTENSION_RELOADED',
          reason: reason || 'context_invalidated',
        },
        '*',
      );
    } catch { /* page may be tearing down */ }
    // Soft console — not Uncaught Error
    console.info(
      '🔌 XActions: extension reloaded — refresh this x.com tab to reconnect.',
    );
  }

  /** Fire-and-forget SW message; never throws to page console. */
  function safeSend(message) {
    if (dead || !isExtensionAlive()) {
      markDead('no_runtime_id');
      return Promise.resolve(null);
    }
    try {
      const p = chrome.runtime.sendMessage(message);
      if (p && typeof p.then === 'function') {
        return p.catch((err) => {
          if (isContextError(err) || chrome.runtime?.lastError) {
            markDead(err?.message || chrome.runtime?.lastError?.message);
            return null;
          }
          // lastError is checked async for callback-style; ignore benign
          return null;
        });
      }
      // Callback API legacy — clear lastError
      if (chrome.runtime.lastError) {
        if (isContextError(chrome.runtime.lastError)) {
          markDead(chrome.runtime.lastError.message);
        }
      }
      return Promise.resolve(null);
    } catch (err) {
      if (isContextError(err)) markDead(err.message);
      return Promise.resolve(null);
    }
  }

  // ============================================
  // INJECT AUTOMATION CODE INTO PAGE CONTEXT
  // ============================================
  function injectScript() {
    if (dead || !isExtensionAlive()) {
      markDead('inject_no_runtime');
      return;
    }
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/injected.js');
      script.onload = () => script.remove();
      script.onerror = () => {
        markDead('inject_failed');
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      if (isContextError(err)) markDead(err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript, { once: true });
  } else {
    injectScript();
  }

  // ============================================
  // PAGE ↔ EXTENSION MESSAGING
  // ============================================

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'xactions-page') return;
    if (dead) return;

    const msg = event.data;

    switch (msg.type) {
      case 'ACTION_PERFORMED':
        void safeSend({
          type: 'ACTION_PERFORMED',
          automationId: msg.automationId,
          action: msg.action,
        });
        void safeSend({
          type: 'ACTIVITY_LOG',
          entry: {
            time: Date.now(),
            type: 'action',
            automation: msg.automationId,
            message: msg.action,
          },
        });
        break;

      case 'AUTOMATION_COMPLETE':
        void safeSend({
          type: 'ACTIVITY_LOG',
          entry: {
            time: Date.now(),
            type: 'complete',
            automation: msg.automationId,
            message: `${msg.automationId} completed — ${msg.summary || 'done'}`,
          },
        });
        break;

      case 'AUTOMATION_ERROR':
        void safeSend({
          type: 'ACTIVITY_LOG',
          entry: {
            time: Date.now(),
            type: 'error',
            automation: msg.automationId,
            message: msg.error,
          },
        });
        break;

      case 'ACCOUNT_INFO':
        void safeSend({
          type: 'ACCOUNT_INFO_RESPONSE',
          data: msg.data,
        });
        break;

      case 'AGENT_TOOL_RESULT':
        void safeSend({
          type: 'AGENT_TOOL_RESULT',
          requestId: msg.requestId,
          result: msg.result,
        });
        break;
    }
  });

  // Listen for messages from popup/background
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (dead || !isExtensionAlive()) {
        try {
          sendResponse({ error: 'extension_context_invalidated', reloadTab: true });
        } catch { /* ignore */ }
        markDead('onMessage_dead');
        return false;
      }

      try {
        switch (message.type) {
          case 'RUN_AUTOMATION':
            window.postMessage(
              {
                source: 'xactions-extension',
                type: 'RUN_AUTOMATION',
                automationId: message.automationId,
                settings: message.settings,
              },
              '*',
            );
            sendResponse({ success: true });
            break;

          case 'STOP_AUTOMATION':
            window.postMessage(
              {
                source: 'xactions-extension',
                type: 'STOP_AUTOMATION',
                automationId: message.automationId,
              },
              '*',
            );
            sendResponse({ success: true });
            break;

          case 'STOP_ALL':
            window.postMessage({ source: 'xactions-extension', type: 'STOP_ALL' }, '*');
            sendResponse({ success: true });
            break;

          case 'PAUSE_ALL':
            window.postMessage({ source: 'xactions-extension', type: 'PAUSE_ALL' }, '*');
            sendResponse({ success: true });
            break;

          case 'RESUME_ALL':
            window.postMessage({ source: 'xactions-extension', type: 'RESUME_ALL' }, '*');
            sendResponse({ success: true });
            break;

          case 'GET_ACCOUNT_INFO':
            window.postMessage(
              { source: 'xactions-extension', type: 'GET_ACCOUNT_INFO' },
              '*',
            );
            sendResponse({ success: true });
            break;

          case 'PING':
            sendResponse({ pong: true });
            break;

          case 'AGENT_TOOL':
            window.postMessage(
              {
                source: 'xactions-extension',
                type: 'AGENT_TOOL',
                requestId: message.requestId,
                tool: message.tool,
                args: message.args || {},
              },
              '*',
            );
            sendResponse({ success: true, forwarded: true });
            break;

          default:
            sendResponse({ error: 'Unknown message type' });
        }
      } catch (err) {
        if (isContextError(err)) markDead(err.message);
        try {
          sendResponse({ error: err.message || String(err) });
        } catch { /* ignore */ }
      }
      return true;
    });
  } catch (err) {
    if (isContextError(err)) markDead(err.message);
  }

  console.log('🔌 XActions bridge loaded');
})();
