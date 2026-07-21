// XActions Extension — LLM client
// Primary: xAI OAuth bearer (Grok login) · Optional: API key fallback
// by nichxbt

(() => {
  const PROVIDERS = {
    'xai-oauth': {
      url: 'https://api.x.ai/v1/chat/completions',
      defaultModel: 'grok-4.5',
      label: 'Grok (xAI OAuth)',
      auth: 'oauth',
    },
    xai: {
      url: 'https://api.x.ai/v1/chat/completions',
      defaultModel: 'grok-4.5',
      label: 'Grok (API key)',
      auth: 'api_key',
    },
    openrouter: {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModel: 'x-ai/grok-4.5',
      label: 'OpenRouter',
      auth: 'api_key',
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4o-mini',
      label: 'OpenAI',
      auth: 'api_key',
    },
    ollama: {
      url: 'http://localhost:11434/v1/chat/completions',
      defaultModel: 'llama3.2',
      label: 'Ollama (local)',
      auth: 'none',
    },
  };

  const MODEL_ALIASES = {
    'grok-4-5': 'grok-4.5',
    'grok-4-5-medium': 'grok-4.5',
    'grok-4.5-medium': 'grok-4.5',
    'grok 4.5': 'grok-4.5',
    'grok 4-5 medium': 'grok-4.5',
  };

  function resolveModel(config, provider) {
    const raw = (config.model || provider.defaultModel || '').trim();
    const lower = raw.toLowerCase();
    if (MODEL_ALIASES[lower]) return MODEL_ALIASES[lower];
    if (config.provider === 'openrouter' && raw === 'grok-4.5') {
      return 'x-ai/grok-4.5';
    }
    return raw || provider.defaultModel;
  }

  async function resolveBearer(config) {
    const providerKey = config.provider || 'xai-oauth';

    if (providerKey === 'xai-oauth' || config.authMode === 'oauth') {
      if (!globalThis.XActionsXaiOauth?.getValidAccessToken) {
        throw new Error('xAI OAuth module not loaded');
      }
      return globalThis.XActionsXaiOauth.getValidAccessToken();
    }

    if (providerKey === 'ollama') return null;

    if (config.apiKey) return config.apiKey;

    // Fallback: if API key empty but OAuth session exists, use OAuth
    if (globalThis.XActionsXaiOauth?.getValidAccessToken) {
      try {
        return await globalThis.XActionsXaiOauth.getValidAccessToken();
      } catch {
        /* no oauth */
      }
    }

    throw new Error(
      providerKey === 'xai' || providerKey === 'xai-oauth'
        ? 'Not signed in. Agent → Login with xAI (no API key).'
        : `Missing API key for provider "${providerKey}".`,
    );
  }

  async function chatCompletion(config, messages, tools, options = {}) {
    const providerKey = config.provider || 'xai-oauth';
    const provider = PROVIDERS[providerKey] || PROVIDERS['xai-oauth'];
    const url = (config.baseUrl || provider.url).replace(/\/$/, '');
    const model = resolveModel(config, provider);

    const body = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1200,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = options.toolChoice || 'auto';
    }

    const headers = { 'Content-Type': 'application/json' };
    const bearer = await resolveBearer({ ...config, provider: providerKey });
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    if (providerKey === 'openrouter') {
      headers['HTTP-Referer'] = 'https://xactions.app';
      headers['X-Title'] = 'XActions Extension Agent';
    }

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (res.status === 401) {
          // Try one OAuth refresh then retry
          if (
            (providerKey === 'xai-oauth' || config.authMode === 'oauth') &&
            attempt === 0 &&
            globalThis.XActionsXaiOauth
          ) {
            try {
              const tokens = await globalThis.XActionsXaiOauth.loadTokens();
              if (tokens?.refresh_token) {
                await globalThis.XActionsXaiOauth.refreshAccessToken(tokens);
                continue;
              }
            } catch {
              /* fall through */
            }
          }
          const errText = await res.text().catch(() => '');
          throw new Error(
            `Auth failed (401). Sign in again with xAI OAuth. ${errText.slice(0, 180)}`,
          );
        }

        if (res.status === 403) {
          const errText = await res.text().catch(() => '');
          throw new Error(
            `Grok OAuth forbidden (403). SuperGrok / X Premium+ may be required, or OAuth tier restricted. ${errText.slice(0, 180)}`,
          );
        }

        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`LLM HTTP ${res.status}`);
          await sleep(800 * (attempt + 1));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => 'unknown');
          throw new Error(`LLM error ${res.status}: ${errText.slice(0, 400)}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];
        const message = choice?.message || { role: 'assistant', content: '' };
        return {
          message,
          finishReason: choice?.finish_reason || 'stop',
          usage: data.usage || {},
          model,
          provider: providerKey,
        };
      } catch (err) {
        lastError = err;
        const msg = String(err.message || '');
        if (
          msg.includes('Auth failed') ||
          msg.includes('forbidden') ||
          msg.includes('Not signed') ||
          msg.includes('Missing')
        ) {
          throw err;
        }
        if (attempt < 2) await sleep(600 * (attempt + 1));
      }
    }
    throw lastError || new Error('LLM call failed');
  }

  async function testConnection(config) {
    try {
      const result = await chatCompletion(
        config,
        [
          { role: 'system', content: 'Reply with exactly: ok' },
          { role: 'user', content: 'ping' },
        ],
        null,
        { temperature: 0, maxTokens: 8 },
      );
      return {
        ok: true,
        model: result.model,
        provider: result.provider,
        preview: (result.message.content || '').slice(0, 80),
      };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  globalThis.XActionsLLM = {
    chatCompletion,
    testConnection,
    PROVIDERS,
    MODEL_ALIASES,
    resolveModel,
  };
})();
