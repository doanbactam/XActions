// XActions Extension — xAI OAuth (device code / Grok CLI login)
// Same public client as Grok Build CLI — no XAI_API_KEY required
// by nichxbt

(() => {
  const CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
  const ISSUER = 'https://auth.x.ai';
  const DEVICE_URL = `${ISSUER}/oauth2/device/code`;
  const TOKEN_URL = `${ISSUER}/oauth2/token`;
  const REVOKE_URL = `${ISSUER}/oauth2/revoke`;
  const SCOPES = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'grok-cli:access',
    'api:access',
    'conversations:read',
    'conversations:write',
    'workspaces:read',
    'workspaces:write',
  ].join(' ');

  const STORAGE_KEY = 'xaiOauth';

  /** @type {null | { device_code: string, interval: number, expires_at: number }} */
  let pendingDevice = null;

  function formBody(obj) {
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
  }

  async function loadTokens() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || null;
  }

  async function saveTokens(tokens) {
    await chrome.storage.local.set({ [STORAGE_KEY]: tokens });
  }

  async function clearTokens() {
    pendingDevice = null;
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  /**
   * Start device-code login. User opens verification_uri and enters user_code.
   */
  async function startDeviceLogin() {
    const res = await fetch(DEVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        client_id: CLIENT_ID,
        scope: SCOPES,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Device auth failed (${res.status}): ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(
        data.error_description || data.error || `Device auth HTTP ${res.status}`,
      );
    }

    const interval = Math.max(Number(data.interval) || 5, 2);
    const expiresIn = Number(data.expires_in) || 900;
    pendingDevice = {
      device_code: data.device_code,
      interval,
      expires_at: Date.now() + expiresIn * 1000,
    };

    const verificationUri =
      data.verification_uri_complete ||
      data.verification_uri ||
      'https://accounts.x.ai/connect';

    return {
      user_code: data.user_code,
      verification_uri: data.verification_uri || verificationUri,
      verification_uri_complete: data.verification_uri_complete || null,
      interval,
      expires_in: expiresIn,
      message: data.message || 'Open the URL and approve access',
    };
  }

  /**
   * Poll until user approves (or timeout / deny).
   */
  async function pollDeviceLogin() {
    if (!pendingDevice?.device_code) {
      return { status: 'idle', error: 'No login in progress — click Login with xAI first' };
    }
    if (Date.now() > pendingDevice.expires_at) {
      pendingDevice = null;
      return { status: 'expired', error: 'Login code expired — start again' };
    }

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: pendingDevice.device_code,
        client_id: CLIENT_ID,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { status: 'error', error: `Token parse error: ${text.slice(0, 160)}` };
    }

    if (res.ok && data.access_token) {
      const tokens = normalizeTokenResponse(data);
      await saveTokens(tokens);
      pendingDevice = null;
      return { status: 'success', tokens: publicSession(tokens) };
    }

    const err = data.error || '';
    if (err === 'authorization_pending') {
      return { status: 'pending', interval: pendingDevice.interval };
    }
    if (err === 'slow_down') {
      pendingDevice.interval = (pendingDevice.interval || 5) + 5;
      return { status: 'pending', interval: pendingDevice.interval };
    }
    if (err === 'expired_token' || err === 'access_denied') {
      pendingDevice = null;
      return {
        status: err === 'access_denied' ? 'denied' : 'expired',
        error: data.error_description || err,
      };
    }

    return {
      status: 'error',
      error: data.error_description || data.error || `HTTP ${res.status}`,
    };
  }

  function normalizeTokenResponse(data, prev = {}) {
    const expiresIn = Number(data.expires_in) || 7200;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || prev.refresh_token || '',
      token_type: data.token_type || 'Bearer',
      expires_at: Date.now() + expiresIn * 1000,
      scope: data.scope || prev.scope || SCOPES,
      id_token: data.id_token || prev.id_token || '',
      auth_mode: 'oidc',
      oidc_issuer: ISSUER,
      oidc_client_id: CLIENT_ID,
      updated_at: new Date().toISOString(),
    };
  }

  function publicSession(tokens) {
    if (!tokens?.access_token) return null;
    return {
      signedIn: true,
      auth_mode: 'oidc',
      expires_at: tokens.expires_at,
      scope: tokens.scope,
      has_refresh: !!tokens.refresh_token,
      email: tokens.email || null,
      updated_at: tokens.updated_at,
    };
  }

  async function refreshAccessToken(tokens) {
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token — sign in with xAI again');
    }

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: CLIENT_ID,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Refresh failed: ${text.slice(0, 200)}`);
    }

    if (!res.ok || !data.access_token) {
      // Terminal refresh failure — clear session
      if (res.status === 400 || res.status === 401) {
        await clearTokens();
      }
      throw new Error(
        data.error_description ||
          data.error ||
          `Token refresh HTTP ${res.status} — re-login required`,
      );
    }

    const next = normalizeTokenResponse(data, tokens);
    await saveTokens(next);
    return next;
  }

  /**
   * Return a valid access_token, refreshing if needed.
   */
  async function getValidAccessToken() {
    let tokens = await loadTokens();
    if (!tokens?.access_token) {
      throw new Error(
        'Not signed in with xAI. Open Agent → Login with xAI (OAuth).',
      );
    }

    // Refresh 60s before expiry
    if (tokens.expires_at && Date.now() > tokens.expires_at - 60_000) {
      tokens = await refreshAccessToken(tokens);
    }
    return tokens.access_token;
  }

  async function getSession() {
    const tokens = await loadTokens();
    if (!tokens?.access_token) {
      return { signedIn: false };
    }
    // Soft refresh if expired
    if (tokens.expires_at && Date.now() > tokens.expires_at - 60_000) {
      try {
        const next = await refreshAccessToken(tokens);
        return publicSession(next);
      } catch {
        return { signedIn: false, expired: true };
      }
    }
    return publicSession(tokens);
  }

  async function logout() {
    const tokens = await loadTokens();
    if (tokens?.access_token) {
      try {
        await fetch(REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody({
            token: tokens.refresh_token || tokens.access_token,
            client_id: CLIENT_ID,
          }),
        });
      } catch {
        /* ignore revoke errors */
      }
    }
    await clearTokens();
    return { success: true };
  }

  globalThis.XActionsXaiOauth = {
    CLIENT_ID,
    ISSUER,
    startDeviceLogin,
    pollDeviceLogin,
    getValidAccessToken,
    getSession,
    logout,
    loadTokens,
    refreshAccessToken,
  };
})();
