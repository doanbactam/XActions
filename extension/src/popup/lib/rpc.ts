// Typed wrapper around chrome.runtime.sendMessage.
// Survives extension reloads without uncaught "Extension context invalidated".
// by nichxbt

function isContextError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '');
  return (
    /Extension context invalidated/i.test(msg) ||
    /context invalidated/i.test(msg) ||
    /message port closed/i.test(msg) ||
    /Receiving end does not exist/i.test(msg) ||
    /The message port closed/i.test(msg)
  );
}

export function isExtensionContextAlive(): boolean {
  try {
    return !!(typeof chrome !== 'undefined' && chrome.runtime?.id);
  } catch {
    return false;
  }
}

/**
 * Send a message to the service worker.
 * Returns a structured error object instead of throwing on dead context
 * so UI can show "reload extension / tab" without crashing.
 */
export async function sendMessage<TResponse = unknown>(
  message: Record<string, unknown>,
): Promise<TResponse> {
  if (!isExtensionContextAlive()) {
    return {
      ok: false,
      success: false,
      error: 'Extension đã reload — đóng popup và mở lại (hoặc reload extension).',
      reloadRequired: true,
    } as TResponse;
  }

  try {
    const res = (await chrome.runtime.sendMessage(message)) as TResponse;
    // MV3 sometimes sets lastError without rejecting
    const last = chrome.runtime.lastError?.message;
    if (last) {
      if (isContextError(last)) {
        return {
          ok: false,
          success: false,
          error: 'Extension context invalidated — mở lại popup / refresh x.com.',
          reloadRequired: true,
        } as TResponse;
      }
      return {
        ok: false,
        success: false,
        error: last,
      } as TResponse;
    }
    return res;
  } catch (err) {
    if (isContextError(err)) {
      return {
        ok: false,
        success: false,
        error: 'Extension context invalidated — mở lại popup / refresh tab x.com.',
        reloadRequired: true,
      } as TResponse;
    }
    return {
      ok: false,
      success: false,
      error: (err as Error)?.message || String(err),
    } as TResponse;
  }
}
