// XActions Extension — AI Agent orchestration (chat, strategist, playbook executor).
// by nichxbt

(() => {
  const { state } = globalThis.XActionsBackgroundState;
  const { logActivity } = globalThis.XActionsBackgroundActivity;
  const { notifyUser } = globalThis.XActionsBackgroundNotifications;
  const { runHybridPageTool } = globalThis.XActionsBackgroundHttp;

  function normalizeLlmConfig(cfg) {
    const llmConfig = { ...(cfg.llm || {}) };
    if (!llmConfig.provider) llmConfig.provider = 'xai-oauth';
    if (!llmConfig.model) llmConfig.model = 'grok-4.5';
    if (llmConfig.provider === 'xai-oauth') llmConfig.authMode = 'oauth';
    if (!llmConfig.baseUrl) delete llmConfig.baseUrl;
    return llmConfig;
  }

  function buildAgentCtx(cfg, storage) {
    const background = cfg.background ?? state.backgroundMode;
    return {
      automations: storage.automations || state.activeAutomations,
      startAutomation: (id, settings) =>
        globalThis.XActionsBackgroundAutomations?.startAutomation?.(id, settings, { background }) ??
        { success: false, error: 'Automations module not loaded' },
      stopAutomation: (id) => globalThis.XActionsBackgroundAutomations?.stopAutomation?.(id),
      stopAll: () => globalThis.XActionsBackgroundAutomations?.stopAll?.(),
      globalPause: () => globalThis.XActionsBackgroundAutomations?.globalPause?.(),
      globalResume: () => globalThis.XActionsBackgroundAutomations?.globalResume?.(),
      savePersona: async (persona) => {
        await chrome.storage.local.set({ agentPersona: persona });
      },
      saveSafety: async (safety) => {
        await chrome.storage.local.set({ agentSafety: safety });
      },
      navigateTab: (url) => globalThis.XActionsBackgroundTabs?.navigateXTab?.(url, { background }),
      pageTool: (name, args) => runHybridPageTool(name, args),
      toolCatalog: () => globalThis.XActionsCatalog,
      persona: cfg.persona,
      safety: cfg.safety,
      llmConfig: cfg.llm,
      background,
    };
  }

  async function getAgentConfig() {
    const data = await chrome.storage.local.get([
      'agentLlm',
      'agentPersona',
      'agentSafety',
      'agentChatHistory',
      'agentPlaybook',
    ]);
    let llm = data.agentLlm || globalThis.XActionsAgent.defaultLlmConfig();
    if (llm.provider === 'xai' && !llm.apiKey) {
      llm = { ...llm, provider: 'xai-oauth', authMode: 'oauth' };
    }
    const oauth = globalThis.XActionsXaiOauth
      ? await globalThis.XActionsXaiOauth.getSession()
      : { signedIn: false };

    const pb = data.agentPlaybook;
    const toolKinds = {};
    for (const t of globalThis.XActionsCatalog?.TOOLS || []) {
      toolKinds[t.kind] = (toolKinds[t.kind] || 0) + 1;
    }

    return {
      success: true,
      llm,
      persona: data.agentPersona || globalThis.XActionsAgent.defaultPersona(),
      safety: data.agentSafety || globalThis.XActionsAgent.defaultSafety(),
      history: data.agentChatHistory || [],
      busy: state.agentBusy,
      oauth,
      toolCount: globalThis.XActionsCatalog?.count || 0,
      toolKinds,
      playbookMeta: pb
        ? {
            handle: pb.account?.handle || '',
            niche: pb.analysis?.niche || '',
            goal: pb.playbook?.goal || '',
            steps: pb.playbook?.steps?.length || 0,
            createdAt: pb.createdAt || null,
          }
        : null,
    };
  }

  async function saveAgentConfig(config = {}) {
    const patch = {};
    if (config.llm) patch.agentLlm = config.llm;
    if (config.persona) patch.agentPersona = config.persona;
    if (config.safety) patch.agentSafety = config.safety;
    if (config.history) patch.agentChatHistory = config.history;
    await chrome.storage.local.set(patch);
    return { success: true };
  }

  async function getAgentBackground() {
    return {
      success: true,
      backgroundMode: state.backgroundMode,
      schedule: state.agentSchedule,
    };
  }

  async function setAgentBackground(enabled) {
    state.backgroundMode = enabled;
    await chrome.storage.local.set({ agentBackgroundMode: enabled });
    return { success: true, backgroundMode: enabled };
  }

  async function setAgentSchedule(schedule) {
    const next = {
      enabled: !!schedule.enabled,
      intervalMinutes: Math.max(15, Math.min(1440, Number(schedule.intervalMinutes) || 60)),
      nextRunAt: null,
    };
    state.agentSchedule = next;
    await chrome.storage.local.set({ agentSchedule: next });

    await chrome.alarms.clear('xactions-scheduled-playbook');
    if (next.enabled) {
      await chrome.alarms.create('xactions-scheduled-playbook', {
        periodInMinutes: next.intervalMinutes,
      });
      next.nextRunAt = Date.now() + next.intervalMinutes * 60 * 1000;
      await chrome.storage.local.set({ agentSchedule: next });
    }

    return { success: true, schedule: next };
  }

  async function restoreScheduleAlarm() {
    if (!state.agentSchedule?.enabled) return;
    const minutes = state.agentSchedule.intervalMinutes || 60;
    await chrome.alarms.clear('xactions-scheduled-playbook');
    await chrome.alarms.create('xactions-scheduled-playbook', {
      periodInMinutes: minutes,
    });
  }

  async function runScheduledPlaybook() {
    if (state.agentBusy) {
      console.log('⏸ Scheduled playbook skipped — agent already busy');
      return;
    }

    const data = await chrome.storage.local.get(['agentPlaybook', 'agentBackgroundMode']);
    if (!data.agentPlaybook?.playbook?.steps?.length) {
      console.log('⏸ Scheduled playbook skipped — no playbook');
      return;
    }
    if (data.agentBackgroundMode === false) {
      console.log('⏸ Scheduled playbook skipped — background mode disabled');
      return;
    }

    await logActivity({
      time: Date.now(),
      type: 'start',
      automation: 'aiAgent',
      message: '⏰ Scheduled playbook run started',
    });

    const result = await runAgentExecutePlaybook({
      playbook: data.agentPlaybook,
      force: false,
      background: true,
    });

    await logActivity({
      time: Date.now(),
      type: result?.ok ? 'complete' : 'error',
      automation: 'aiAgent',
      message: result?.ok
        ? `⏰ Scheduled playbook finished: ${result.summary || 'done'}`
        : `⏰ Scheduled playbook failed: ${result?.error || 'unknown'}`,
    });

    if (result?.ok) {
      await notifyUser('XActions · Kịch bản định kỳ đã chạy', result.summary || 'done');
    } else {
      await notifyUser('XActions · Kịch bản định kỳ lỗi', result?.error || 'failed');
    }
  }

  async function testAgentLlm(configOverride) {
    try {
      let llmConfig = configOverride;
      if (!llmConfig) {
        const cfg = await getAgentConfig();
        llmConfig = { ...cfg.llm };
      } else {
        llmConfig = { ...llmConfig };
      }
      if (!llmConfig.baseUrl) delete llmConfig.baseUrl;
      if (!llmConfig.provider) llmConfig.provider = 'xai-oauth';
      if (!llmConfig.model) llmConfig.model = 'grok-4.5';
      llmConfig.authMode = llmConfig.provider === 'xai-oauth' ? 'oauth' : llmConfig.authMode;

      if (typeof globalThis.XActionsLLM?.testConnection === 'function') {
        return globalThis.XActionsLLM.testConnection(llmConfig);
      }

      const result = await globalThis.XActionsLLM.chatCompletion(
        llmConfig,
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
        provider: result.provider || llmConfig.provider,
        preview: (result.message?.content || '').slice(0, 80),
      };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  async function runAgentChat(message) {
    if (state.agentBusy) {
      return { ok: false, error: 'Agent is already running a turn. Wait a moment.' };
    }

    const userMessage = (message.userMessage || '').trim();
    if (!userMessage) return { ok: false, error: 'Empty message' };

    state.agentBusy = true;
    try {
      const cfg = await getAgentConfig();
      const llmConfig = normalizeLlmConfig(cfg);
      cfg.llm = llmConfig;

      const storage = await chrome.storage.local.get(['automations', 'agentChatHistory']);
      const history = storage.agentChatHistory || [];
      const ctx = buildAgentCtx(cfg, storage);

      const result = await globalThis.XActionsAgent.runAgentTurn({
        history: history.filter((m) => m.role === 'user' || m.role === 'assistant'),
        userMessage,
        llmConfig,
        persona: cfg.persona,
        safety: cfg.safety,
        ctx,
      });

      if (result.ok) {
        const nextHistory = [
          ...history,
          { role: 'user', content: userMessage, time: Date.now() },
          {
            role: 'assistant',
            content: result.content,
            time: Date.now(),
            toolTrace: result.toolTrace || [],
          },
        ].slice(-40);
        await chrome.storage.local.set({ agentChatHistory: nextHistory });
        for (const t of result.toolTrace || []) {
          await logActivity({
            time: Date.now(),
            type: t.error ? 'error' : 'complete',
            automation: 'aiAgent',
            message: `🛠 ${t.tool || 'tool'}${t.error ? ` — ${t.error}` : ''}`,
          });
        }
        await logActivity({
          time: Date.now(),
          type: 'action',
          automation: 'aiAgent',
          message: `Agent: ${userMessage.slice(0, 80)}${userMessage.length > 80 ? '…' : ''}`,
        });
      }

      return result;
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    } finally {
      state.agentBusy = false;
    }
  }

  /** Analyze account → audience/style → playbook (primary flow) */
  async function runAgentStrategy(message) {
    if (state.agentBusy) {
      return { ok: false, error: 'Agent đang bận — đợi xong lượt hiện tại.' };
    }
    if (!globalThis.XActionsStrategist?.runStrategyPipeline) {
      return { ok: false, error: 'Strategist module not loaded' };
    }

    state.agentBusy = true;
    try {
      const cfg = await getAgentConfig();
      const llmConfig = normalizeLlmConfig(cfg);
      cfg.llm = llmConfig;

      const result = await globalThis.XActionsStrategist.runStrategyPipeline({
        llmConfig,
        persona: cfg.persona,
        safety: cfg.safety,
        pageTool: (name, args) => runHybridPageTool(name, args),
        languageHint:
          message.languageHint ||
          'executiveBrief and user-facing text in Vietnamese. JSON keys English.',
        onProgress: async (ev) => {
          await chrome.storage.local.set({
            agentStrategyProgress: { ...ev, at: Date.now() },
          });
          const phaseLabel = {
            start: 'Bắt đầu phân tích',
            gather: 'Thu thập tín hiệu',
            synthesize: 'Grok chẩn đoán & lên kịch bản',
            done: 'Kịch bản sẵn sàng',
          }[ev.phase] || ev.phase;
          await logActivity({
            time: Date.now(),
            type: ev.phase === 'done' ? 'complete' : 'action',
            automation: 'aiAgent',
            message: ev.label || phaseLabel,
          });
        },
      });

      if (result.ok) {
        const history = (await chrome.storage.local.get(['agentChatHistory'])).agentChatHistory || [];
        const brief = result.brief || result.executiveBrief || 'Kịch bản đã tạo.';
        const nextHistory = [
          ...history,
          {
            role: 'user',
            content: '🔬 Phân tích tài khoản & lên kịch bản',
            time: Date.now(),
          },
          {
            role: 'assistant',
            content: brief,
            time: Date.now(),
            kind: 'playbook',
            playbook: {
              goal: result.playbook?.playbook?.goal,
              steps: result.playbook?.playbook?.steps?.length,
              niche: result.playbook?.analysis?.niche,
            },
          },
        ].slice(-40);
        await chrome.storage.local.set({ agentChatHistory: nextHistory });
        await logActivity({
          time: Date.now(),
          type: 'complete',
          automation: 'aiAgent',
          message: `Strategist: playbook @${result.playbook?.account?.handle || '?'} · ${result.playbook?.playbook?.steps?.length || 0} steps`,
        });
        await notifyUser(
          'XActions · Kịch bản sẵn sàng',
          `@${result.playbook?.account?.handle || 'account'} · ${result.playbook?.playbook?.steps?.length || 0} bước — mở popup Agent để chạy`,
        );
      } else {
        await logActivity({
          time: Date.now(),
          type: 'error',
          automation: 'aiAgent',
          message: `Phân tích lỗi: ${(result.error || 'failed').slice(0, 120)}`,
        });
        await notifyUser('XActions · Phân tích lỗi', (result.error || 'failed').slice(0, 120));
      }

      return result;
    } catch (err) {
      await logActivity({
        time: Date.now(),
        type: 'error',
        automation: 'aiAgent',
        message: `Phân tích lỗi: ${(err.message || String(err)).slice(0, 120)}`,
      });
      await notifyUser('XActions · Phân tích lỗi', (err.message || String(err)).slice(0, 120));
      return { ok: false, error: err.message || String(err) };
    } finally {
      state.agentBusy = false;
      await chrome.storage.local.set({
        agentStrategyProgress: { phase: 'idle', at: Date.now() },
      });
    }
  }

  async function runAgentExecutePlaybook(message) {
    if (state.agentBusy) {
      return { ok: false, error: 'Agent đang bận.' };
    }
    if (!globalThis.XActionsStrategist?.executePlaybook) {
      return { ok: false, error: 'Strategist module not loaded' };
    }

    state.agentBusy = true;
    const background = message.background ?? state.backgroundMode;
    try {
      const cfg = await getAgentConfig();
      cfg.llm = normalizeLlmConfig(cfg);
      const storage = await chrome.storage.local.get(['automations']);
      const ctx = buildAgentCtx(cfg, storage);
      ctx.background = background;

      const result = await globalThis.XActionsStrategist.executePlaybook({
        playbook: message.playbook || null,
        ctx,
        onlyStepIds: message.onlyStepIds || null,
        selectedStepIds: message.selectedStepIds || null,
        force: !!message.force,
        onProgress: async (ev) => {
          await chrome.storage.local.set({
            agentStrategyProgress: { ...ev, at: Date.now() },
          });
          if (ev.phase === 'execute' && ev.id) {
            await logActivity({
              time: Date.now(),
              type: 'action',
              automation: 'aiAgent',
              message: `▶ ${ev.label || ev.id} · ${ev.tool || ''}`.trim(),
            });
          }
        },
      });

      if (result.ok) {
        for (const r of result.results || []) {
          if (r.status === 'done') {
            await logActivity({
              time: Date.now(),
              type: 'complete',
              automation: 'aiAgent',
              message: `✅ ${r.id} · ${r.tool}`,
            });
          } else if (r.status === 'failed') {
            await logActivity({
              time: Date.now(),
              type: 'error',
              automation: 'aiAgent',
              message: `❌ ${r.id} · ${r.tool} — ${r.result?.error || 'failed'}`,
            });
          } else if (r.skipped) {
            await logActivity({
              time: Date.now(),
              type: 'action',
              automation: 'aiAgent',
              message: `⏭ ${r.id} · ${r.tool} — ${r.reason || r.status}`,
            });
          }
        }
        await logActivity({
          time: Date.now(),
          type: 'action',
          automation: 'aiAgent',
          message: `Execute playbook: ${result.summary}`,
        });
        await notifyUser('XActions · Đã chạy kịch bản', result.summary || 'done');
      }
      return result;
    } catch (err) {
      await logActivity({
        time: Date.now(),
        type: 'error',
        automation: 'aiAgent',
        message: `Chạy kịch bản lỗi: ${(err.message || String(err)).slice(0, 120)}`,
      });
      return { ok: false, error: err.message || String(err) };
    } finally {
      state.agentBusy = false;
      if (background) {
        try {
          await chrome.alarms.create('xactions-close-owned-tabs', { when: Date.now() + 60000 });
        } catch { /* ignore */ }
      }
    }
  }

  async function getAgentPlaybook() {
    if (!globalThis.XActionsStrategist?.loadPlaybook) {
      return { ok: false, playbook: null };
    }
    const data = await globalThis.XActionsStrategist.loadPlaybook();
    return { ok: true, ...data };
  }

  async function clearAgentPlaybook() {
    if (globalThis.XActionsStrategist?.clearPlaybook) {
      await globalThis.XActionsStrategist.clearPlaybook();
    }
    return { success: true };
  }

  async function updatePlaybookSteps(updates) {
    if (!globalThis.XActionsStrategist?.updateStepFlags) {
      return { ok: false, error: 'Strategist not loaded' };
    }
    return globalThis.XActionsStrategist.updateStepFlags(updates);
  }

  // xAI OAuth helpers
  async function startXaiOauth() {
    try {
      const started = await globalThis.XActionsXaiOauth.startDeviceLogin();
      const url = started.verification_uri_complete || started.verification_uri;
      if (url) {
        try {
          await chrome.sidePanel.setOptions({
            path: 'sidepanel/sidepanel.html',
            enabled: true,
          });
          const win = await chrome.windows.getLastFocused();
          await chrome.sidePanel.open({ windowId: win.id });
        } catch {
          try {
            await chrome.tabs.create({ url, active: false });
          } catch { /* popup may still show the URL */ }
        }
      }
      return { success: true, ...started };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  async function pollXaiOauth() {
    try {
      return await globalThis.XActionsXaiOauth.pollDeviceLogin();
    } catch (err) {
      return { status: 'error', error: err.message || String(err) };
    }
  }

  async function getXaiOauthStatus() {
    try {
      const session = await globalThis.XActionsXaiOauth.getSession();
      return { success: true, ...session };
    } catch (err) {
      return { success: false, signedIn: false, error: err.message };
    }
  }

  async function getXaiOauthPending() {
    try {
      const pending = await globalThis.XActionsXaiOauth.getPendingDevice();
      return { success: true, pending };
    } catch (err) {
      return { success: false, pending: null };
    }
  }

  async function openXaiOauthPanel() {
    try {
      await chrome.sidePanel.setOptions({
        path: 'sidepanel/sidepanel.html',
        enabled: true,
      });
      const win = await chrome.windows.getLastFocused();
      await chrome.sidePanel.open({ windowId: win.id });
      return { success: true };
    } catch (err) {
      try {
        const pending = await globalThis.XActionsXaiOauth.getPendingDevice();
        const url = pending?.verification_uri_complete || pending?.verification_uri;
        if (url) await chrome.tabs.create({ url, active: false });
      } catch { /* ignore */ }
      return { success: false, error: err?.message || String(err) };
    }
  }

  async function logoutXaiOauth() {
    try {
      await globalThis.XActionsXaiOauth.logout();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  globalThis.XActionsBackgroundAgent = {
    getAgentConfig,
    saveAgentConfig,
    testAgentLlm,
    runAgentChat,
    runAgentStrategy,
    runAgentExecutePlaybook,
    getAgentPlaybook,
    clearAgentPlaybook,
    updatePlaybookSteps,
    getAgentBackground,
    setAgentBackground,
    setAgentSchedule,
    restoreScheduleAlarm,
    runScheduledPlaybook,
    startXaiOauth,
    pollXaiOauth,
    getXaiOauthStatus,
    getXaiOauthPending,
    openXaiOauthPanel,
    logoutXaiOauth,
    buildAgentCtx,
    normalizeLlmConfig,
  };
})();
