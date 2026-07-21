// XActions Extension — Agent orchestrator
// by nichxbt

(() => {
  const MAX_TOOL_ROUNDS = 10;

  async function runAgentTurn(params) {
    const {
      history = [],
      userMessage,
      llmConfig,
      persona,
      safety,
      ctx,
      onEvent,
    } = params;

    const provider = llmConfig?.provider || 'xai-oauth';
    if (provider !== 'ollama' && provider !== 'xai-oauth' && !llmConfig?.apiKey) {
      // API-key providers only — OAuth is checked at call time
      if (provider !== 'xai') {
        return {
          ok: false,
          error:
            'Missing API key. Or switch provider to Grok (xAI OAuth) and Login with xAI.',
          messages: [],
        };
      }
    }

    let playbook = ctx?.playbook || null;
    if (!playbook && globalThis.XActionsStrategist?.PLAYBOOK_KEY) {
      try {
        const key = globalThis.XActionsStrategist.PLAYBOOK_KEY;
        const data = await chrome.storage.local.get([key]);
        playbook = data[key] || null;
      } catch {
        playbook = null;
      }
    }

    const system = globalThis.XActionsTools.systemPrompt(persona, safety, playbook);
    const messages = [
      { role: 'system', content: system },
      ...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
      { role: 'user', content: userMessage },
    ];

    const toolTrace = [];
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      onEvent?.({ type: 'thinking', round: rounds });

      const result = await globalThis.XActionsLLM.chatCompletion(
        llmConfig,
        messages,
        globalThis.XActionsTools.TOOL_DEFINITIONS,
        { temperature: 0.6, maxTokens: 1400 },
      );

      const msg = result.message;
      messages.push(normalizeAssistantMessage(msg));

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        onEvent?.({ type: 'done', content: msg.content || '' });
        return {
          ok: true,
          content: (msg.content || '').trim(),
          toolTrace,
          usage: result.usage,
          model: result.model,
        };
      }

      for (const call of toolCalls) {
        const name = call.function?.name || call.name;
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments || call.arguments || '{}');
        } catch {
          args = {};
        }

        onEvent?.({ type: 'tool_start', name, args });
        let toolResult;
        try {
          toolResult = await globalThis.XActionsTools.executeTool(name, args, {
            ...ctx,
            persona,
            safety,
            llmConfig,
          });
        } catch (err) {
          toolResult = { error: err.message || String(err) };
        }

        toolTrace.push({ name, args, result: toolResult });
        onEvent?.({ type: 'tool_end', name, result: toolResult });

        messages.push({
          role: 'tool',
          tool_call_id: call.id || `call_${name}_${rounds}`,
          content: JSON.stringify(toolResult).slice(0, 12000),
        });
      }
    }

    return {
      ok: true,
      content: 'Reached tool-round limit. Check tool results above.',
      toolTrace,
    };
  }

  function normalizeAssistantMessage(msg) {
    const out = { role: 'assistant', content: msg.content || null };
    if (msg.tool_calls?.length) out.tool_calls = msg.tool_calls;
    return out;
  }

  function defaultPersona() {
    return {
      name: 'XActions Executor',
      tone: 'decisive, concise, action-first — runs tools, does not only advise',
      niche: 'tech / growth on X',
      expertise: ['X/Twitter growth', 'automation execution', 'safe rate limits'],
      opinions: [
        'Execute automations for the user via tools',
        'Quality engagement beats spam volume',
      ],
      avoid: [
        'telling user to manually click Automations cards',
        'engagement bait',
        'crypto pump language',
        'harassment',
      ],
    };
  }

  function defaultSafety() {
    return { maxActionsPerTurn: 20, requireConfirmHighRisk: true };
  }

  function defaultLlmConfig() {
    return {
      provider: 'xai-oauth',
      authMode: 'oauth',
      apiKey: '',
      model: 'grok-4.5',
      baseUrl: '',
    };
  }

  globalThis.XActionsAgent = {
    runAgentTurn,
    defaultPersona,
    defaultSafety,
    defaultLlmConfig,
  };
})();
