// XActions Extension — Side panel host for xAI OAuth verification
// Reads the pending device flow from storage and navigates to the
// verification URL so the popup keeps focus and stays alive.
// by nichxbt

(async () => {
  const statusEl = document.getElementById('xa-sp-status');
  const codeEl = document.getElementById('xa-sp-code');
  const linkEl = document.getElementById('xa-sp-link');
  const hintEl = document.getElementById('xa-sp-hint');

  const PENDING_KEY = 'xaiOauthPending';

  async function readPending() {
    const data = await chrome.storage.local.get(PENDING_KEY);
    const pending = data[PENDING_KEY];
    if (!pending) return null;
    if (Date.now() > pending.expires_at) {
      await chrome.storage.local.remove(PENDING_KEY);
      return null;
    }
    return pending;
  }

  // When tokens land (success), the popup clears the pending key.
  // Watch for that transition to auto-close the panel.
  let started = false;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (PENDING_KEY in changes && changes[PENDING_KEY].newValue === undefined && started) {
      statusEl.textContent = '✅ Đã đăng nhập xAI. Đang đóng panel…';
      setTimeout(() => window.close(), 1200);
    }
  });

  const pending = await readPending();
  if (!pending) {
    statusEl.textContent = 'Không có phiên đăng nhập nào đang chờ. Bấm "Đăng nhập xAI" trong popup để bắt đầu.';
    statusEl.classList.add('xa-sp-error');
    return;
  }

  const url = pending.verification_uri_complete || pending.verification_uri;
  if (pending.user_code) {
    codeEl.textContent = pending.user_code;
    codeEl.hidden = false;
  }

  // Try to navigate the side panel directly to the verification URL.
  // Some Chrome versions block top-level navigation to external URLs
  // from the side panel; fall back to a manual link.
  try {
    started = true;
    window.location.replace(url);
    statusEl.textContent = 'Đang mở trang đăng nhập xAI…';
    hintEl.hidden = false;
  } catch {
    // Navigation blocked — show manual link
    linkEl.href = url;
    linkEl.hidden = false;
    statusEl.textContent = 'Bấm nút bên dưới để mở trang đăng nhập, nhập mã rồi duyệt quyền.';
    hintEl.hidden = false;
  }
})();
