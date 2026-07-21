// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * OpenAI-compatible chat completions (xAI / OpenRouter / OpenAI / Ollama).
 * @module api/services/agent/llmClient
 */

const PROVIDERS = {
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
    defaultModel: 'grok-4.5',
    envKey: 'XAI_API_KEY',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'x-ai/grok-4.5',
    envKey: 'OPENROUTER_API_KEY',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
  },
  ollama: {
    url: 'http://localhost:11434/v1/chat/completions',
    defaultModel: 'llama3.2',
    envKey: null,
  },
};

const MODEL_ALIASES = {
  'grok-4-5': 'grok-4.5',
  'grok-4-5-medium': 'grok-4.5',
  'grok-4.5-medium': 'grok-4.5',
};

/**
 * Resolve LLM config from env + optional overrides.
 * @param {object} [override]
 */
export function resolveLlmConfig(override = {}) {
  const provider =
    override.provider ||
    process.env.AGENT_LLM_PROVIDER ||
    (process.env.XAI_API_KEY
      ? 'xai'
      : process.env.OPENROUTER_API_KEY
        ? 'openrouter'
        : process.env.OPENAI_API_KEY
          ? 'openai'
          : 'ollama');

  const meta = PROVIDERS[provider] || PROVIDERS.xai;
  let model =
    override.model ||
    process.env.AGENT_LLM_MODEL ||
    meta.defaultModel;
  const lower = String(model).toLowerCase();
  if (MODEL_ALIASES[lower]) model = MODEL_ALIASES[lower];

  const apiKey =
    override.apiKey ||
    (meta.envKey ? process.env[meta.envKey] : '') ||
    '';

  return {
    provider,
    model,
    apiKey,
    baseUrl: override.baseUrl || process.env.AGENT_LLM_BASE_URL || meta.url,
  };
}

/**
 * @param {object} config
 * @param {Array} messages
 * @param {Array|null} tools
 * @param {object} [options]
 */
export async function chatCompletion(config, messages, tools = null, options = {}) {
  const cfg = { ...resolveLlmConfig(), ...config };
  if (!cfg.apiKey && cfg.provider !== 'ollama') {
    throw new Error(
      `Missing LLM API key for provider "${cfg.provider}". Set XAI_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY.`,
    );
  }

  const body = {
    model: cfg.model,
    messages,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.maxTokens ?? 1400,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = options.toolChoice || 'auto';
  }

  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://xactions.app';
    headers['X-Title'] = 'XActions Assistant';
  }

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(cfg.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`LLM HTTP ${res.status}`);
        await sleep(600 * (attempt + 1));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        throw new Error(`LLM error ${res.status}: ${errText.slice(0, 400)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      return {
        message: choice?.message || { role: 'assistant', content: '' },
        finishReason: choice?.finish_reason || 'stop',
        usage: data.usage || {},
        model: cfg.model,
        provider: cfg.provider,
      };
    } catch (err) {
      lastError = err;
      const msg = String(err.message || '');
      if (msg.includes('Missing LLM') || msg.includes('LLM error 4')) throw err;
      if (attempt < 2) await sleep(600 * (attempt + 1));
    }
  }
  throw lastError || new Error('LLM call failed');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { PROVIDERS, MODEL_ALIASES };

export default { chatCompletion, resolveLlmConfig, PROVIDERS };
