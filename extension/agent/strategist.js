// XActions Extension — Strategist pipeline (hardened)
// Analyze account → audience → style → playbook → (user confirm) execute
// by nichxbt

(() => {
  const PLAYBOOK_KEY = 'agentPlaybook';
  const ANALYSIS_KEY = 'agentAccountAnalysis';
  const PROGRESS_KEY = 'agentStrategyProgress';
  const RESULT_KEY = 'agentStrategyLastResult';

  /** Tools strategist may put in a playbook (execute allowlist) */
  const PLAYBOOK_ALLOWLIST = new Set([
    'x_stop_all',
    'x_stop_automation',
    'x_list_automations',
    'x_get_running',
    'x_wait',
    'x_go_home',
    'x_go_explore',
    'x_go_profile',
    'x_go_notifications',
    'x_navigate',
    'x_search_tweets',
    'x_get_page_context',
    'x_get_visible_tweets',
    'x_scroll_timeline',
    'x_like_visible_matching',
    'x_retweet_visible_matching',
    'x_bookmark_visible_matching',
    'x_follow_visible',
    'x_start_auto_like',
    'x_start_smart_unfollow',
    'x_start_keyword_follow',
    'x_start_growth_suite',
    'x_start_auto_comment',
    'x_start_follow_engagers',
    'x_start_unfollower_detector',
    'x_start_best_time',
    'x_start_quick_stats',
    'x_start_video_downloader',
    'x_start_thread_reader',
    'x_draft_tweet',
    'x_draft_thread',
    'x_draft_reply',
    'x_summarize_feed',
    'x_niche_ideas',
    'x_suggest_hashtags',
  ]);

  /** Always require explicit force / step enable */
  const ALWAYS_CONFIRM = new Set([
    'x_start_smart_unfollow',
    'x_start_growth_suite',
    'x_start_auto_comment',
    'x_follow_visible',
  ]);

  /** Never allowed in playbook execute */
  const DENYLIST = new Set([
    'x_block_user',
    'x_unblock_user',
    'x_mute_user',
    'x_report_user',
    'x_delete_tweet',
    'x_post_tweet',
    'x_post_thread',
    'x_compose_dm',
    'x_pin_tweet',
  ]);

  function systemStrategist(persona) {
    const p = persona || {};
    const allowed = [...PLAYBOOK_ALLOWLIST].join(', ');
    return [
      'You are the XActions STRATEGIST for X/Twitter growth.',
      `Persona hint: ${p.name || 'operator'} · tone ${p.tone || 'clear'} · niche ${p.niche || 'unknown'}.`,
      '',
      "You receive scraped DOM signals from the user's logged-in x.com tab.",
      'Produce a rigorous account diagnosis and an actionable playbook.',
      '',
      'Rules:',
      '- Be specific to the data; do not invent follower counts not present.',
      '- Prefer safe defaults: dryRun true for unfollow; cap bulk maxActions ≤ 15.',
      `- Map steps ONLY to these tools: ${allowed}.`,
      '- NEVER use: x_block_user, x_delete_tweet, x_post_tweet, x_post_thread, x_compose_dm.',
      '- First executable phase should often start with signal (likes/search), not mass unfollow.',
      '- Output VALID JSON only (no markdown fences).',
    ].join('\n');
  }

  function playbookSchemaHint() {
    return `{
  "accountSummary": "1-2 sentences",
  "niche": "primary niche",
  "voice": { "tone": "", "vocabulary": "", "hooks": "", "avoid": "" },
  "audience": {
    "primary": { "label": "", "who": "", "pains": "", "keywords": [] },
    "secondary": [{ "label": "", "who": "", "keywords": [] }]
  },
  "contentStyle": {
    "formats": [],
    "themes": [],
    "postingCadence": "",
    "bestTopicsNow": []
  },
  "diagnosis": {
    "strengths": [],
    "gaps": [],
    "risks": [],
    "scoreGrowth": 1,
    "scoreVoiceClarity": 1,
    "scoreAudienceFit": 1
  },
  "playbook": {
    "goal": "",
    "horizon": "7 days",
    "riskLevel": "conservative|moderate|aggressive",
    "dailyCaps": { "likes": 30, "follows": 15, "unfollows": 10, "replies": 5 },
    "phases": [
      {
        "name": "Day 1-2 signal niche",
        "steps": [
          {
            "id": "s1",
            "title": "",
            "tool": "x_start_auto_like",
            "args": { "keywords": "ai,startup", "maxActions": 12 },
            "reason": "",
            "requiresConfirm": false,
            "enabled": true
          }
        ]
      }
    ],
    "contentCalendar": [{ "day": 1, "idea": "", "format": "single|thread" }],
    "successMetrics": []
  },
  "executiveBrief": "short plain-language brief for the user"
}`;
  }

  async function gatherSignals(pageTool, onProgress) {
    const signals = {
      gatheredAt: Date.now(),
      steps: [],
      errors: [],
    };

    const run = async (label, tool, args) => {
      onProgress?.({ phase: 'gather', label, tool });
      try {
        const result = await pageTool(tool, args || {});
        signals.steps.push({ label, tool, ok: !result?.error, result });
        if (result?.error) signals.errors.push({ tool, error: result.error });
        return result;
      } catch (err) {
        const error = err.message || String(err);
        signals.steps.push({ label, tool, ok: false, result: { error } });
        signals.errors.push({ tool, error });
        return { error };
      }
    };

    signals.context = await run('page context', 'x_get_page_context', { maxTweets: 12 });
    signals.sidebar = await run('sidebar account', 'x_get_sidebar_account', {});

    let handle = String(signals.sidebar?.handle || signals.context?.account?.handle || '')
      .replace(/^@/, '')
      .trim();

    const reserved = /^(home|explore|search|notifications|messages|i|settings)$/i;
    if (reserved.test(handle)) handle = '';

    if (handle && handle.length > 1) {
      await run('open profile', 'x_go_profile', { username: handle });
      await sleep(1800);
      signals.profileStats = await run('profile stats', 'x_get_profile_stats', {
        username: handle,
      });
      signals.profileTweets = await run('profile tweets', 'x_get_visible_tweets', {
        max: 18,
      });
      signals.engagement = await run('profile engagement', 'x_engagement_snapshot', {
        max: 20,
      });
      // deeper: hashtags / mentions on own content
      signals.hashtags = await run('hashtags', 'x_hashtag_frequency', { max: 30 });
      signals.mentions = await run('mentions', 'x_mention_frequency', { max: 30 });
      signals.topTweets = await run('top tweets', 'x_top_tweets_visible', { max: 8 });
      signals.links = await run('domains', 'x_link_domains', { max: 15 });
      signals.followerRatio = await run('follower ratio', 'x_follower_ratio_visible', {
        username: handle,
      });
    } else {
      signals.profileStats = null;
      signals.profileTweets = await run('visible tweets', 'x_get_visible_tweets', {
        max: 15,
      });
      signals.engagement = await run('engagement', 'x_engagement_snapshot', { max: 20 });
      signals.hashtags = await run('hashtags', 'x_hashtag_frequency', { max: 30 });
      signals.mentions = await run('mentions', 'x_mention_frequency', { max: 30 });
      signals.topTweets = await run('top tweets', 'x_top_tweets_visible', { max: 8 });
      signals.links = await run('domains', 'x_link_domains', { max: 15 });
      signals.followerRatio = null;
      signals.errors.push({
        tool: 'identity',
        error: 'Could not resolve @handle — open your profile once or stay logged in',
      });
    }

    // Home feed sample for audience/style contrast
    await run('go home', 'x_go_home', {});
    await sleep(1500);
    signals.homeFeed = await run('home feed', 'x_get_visible_tweets', { max: 10 });

    signals.compact = compactSignals(signals, handle);
    return signals;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function compactSignals(signals, handleHint) {
    const account = {
      ...(signals.sidebar || signals.context?.account || {}),
    };
    if (handleHint) account.handle = handleHint;

    const tweets = (
      signals.profileTweets?.tweets ||
      signals.context?.tweets ||
      []
    ).map((t) => ({
      author: t.author,
      text: (t.text || '').slice(0, 280),
      stats: t.stats,
      time: t.time,
    }));

    const home = (signals.homeFeed?.tweets || []).map((t) => ({
      author: t.author,
      text: (t.text || '').slice(0, 200),
    }));

    return {
      url: signals.context?.url,
      account,
      resolvedHandle: handleHint || account.handle || '',
      profileStats: signals.profileStats,
      followerRatio: signals.followerRatio,
      engagement: signals.engagement,
      hashtags: signals.hashtags?.hashtags?.slice(0, 15),
      mentions: signals.mentions?.mentions?.slice(0, 15),
      topTweets: (signals.topTweets?.top || []).slice(0, 6),
      linkDomains: signals.links?.domains?.slice(0, 10),
      sampleTweets: tweets.slice(0, 15),
      homeFeedSample: home.slice(0, 8),
      gatherErrors: signals.errors,
    };
  }

  function extractJson(text) {
    const raw = String(text || '').trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fence ? fence[1].trim() : raw;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Strategist returned non-JSON');
    return JSON.parse(body.slice(start, end + 1));
  }

  async function synthesizePlaybook(llmConfig, persona, compact, languageHint) {
    const userLang =
      languageHint ||
      'executiveBrief and human-facing strings in Vietnamese; JSON keys English.';

    const user = [
      'Analyze this X account scrape and build a growth playbook.',
      userLang,
      '',
      'DATA:',
      JSON.stringify(compact, null, 2),
      '',
      'Return JSON matching this schema:',
      playbookSchemaHint(),
    ].join('\n');

    const result = await globalThis.XActionsLLM.chatCompletion(
      llmConfig,
      [
        { role: 'system', content: systemStrategist(persona) },
        { role: 'user', content: user },
      ],
      null,
      { temperature: 0.4, maxTokens: 3500 },
    );

    const parsed = extractJson(result.message?.content || '');
    return {
      parsed,
      model: result.model,
      usage: result.usage,
      raw: result.message?.content,
    };
  }

  function sanitizeToolName(name) {
    return String(name || '')
      .trim()
      .replace(/\.$/, ''); // fix trailing period typos
  }

  function normalizeStep(step, phaseName, index) {
    const tool = sanitizeToolName(step.tool);
    if (!tool || DENYLIST.has(tool)) {
      return null;
    }
    if (!PLAYBOOK_ALLOWLIST.has(tool)) {
      return null;
    }

    const requiresConfirm =
      !!step.requiresConfirm || ALWAYS_CONFIRM.has(tool) || /unfollow|growth_suite/i.test(tool);

    const args = { ...(step.args || {}) };
    if (/unfollow/i.test(tool) && args.dryRun === undefined) {
      args.dryRun = true;
    }
    if (args.maxActions != null) {
      args.maxActions = Math.min(Math.max(1, Number(args.maxActions) || 10), 20);
    }

    return {
      id: step.id || `step_${index + 1}`,
      phase: phaseName || 'Phase',
      title: step.title || tool,
      tool,
      args,
      reason: step.reason || '',
      requiresConfirm,
      enabled: step.enabled !== false,
      status: 'pending',
    };
  }

  function normalizePlaybook(parsed, signals) {
    const now = Date.now();
    const account = signals.compact?.account || {};
    const pb = parsed.playbook || {};
    const phases = Array.isArray(pb.phases) ? pb.phases : [];

    const steps = [];
    const rejected = [];
    for (const phase of phases) {
      for (const step of phase.steps || []) {
        const norm = normalizeStep(step, phase.name, steps.length);
        if (!norm) {
          rejected.push({
            tool: sanitizeToolName(step.tool),
            reason: DENYLIST.has(sanitizeToolName(step.tool))
              ? 'denylist'
              : 'not_in_allowlist',
          });
          continue;
        }
        steps.push(norm);
      }
    }

    // Always prepend stop_all for clean slate when any automation start exists
    const hasStart = steps.some((s) => s.tool.startsWith('x_start_'));
    if (hasStart && !steps.some((s) => s.tool === 'x_stop_all')) {
      steps.unshift({
        id: 'step_stop_all',
        phase: 'Safety',
        title: 'Stop running automations first',
        tool: 'x_stop_all',
        args: {},
        reason: 'Avoid overlapping runners on the same tab',
        requiresConfirm: false,
        enabled: true,
        status: 'pending',
      });
    }

    return {
      version: 2,
      createdAt: now,
      account: {
        handle: signals.compact?.resolvedHandle || account.handle || '',
        name: account.name || '',
        stats: signals.compact?.profileStats || null,
      },
      analysis: {
        accountSummary: parsed.accountSummary || '',
        niche: parsed.niche || '',
        voice: parsed.voice || {},
        audience: parsed.audience || {},
        contentStyle: parsed.contentStyle || {},
        diagnosis: parsed.diagnosis || {},
      },
      playbook: {
        goal: pb.goal || '',
        horizon: pb.horizon || '7 days',
        riskLevel: pb.riskLevel || 'moderate',
        dailyCaps: pb.dailyCaps || {
          likes: 30,
          follows: 15,
          unfollows: 10,
          replies: 5,
        },
        phases,
        contentCalendar: pb.contentCalendar || [],
        successMetrics: pb.successMetrics || [],
        steps,
        rejectedSteps: rejected,
      },
      executiveBrief: parsed.executiveBrief || parsed.accountSummary || '',
      signals: signals.compact,
      model: null,
    };
  }

  function briefMarkdown(doc) {
    const a = doc.analysis || {};
    const d = a.diagnosis || {};
    const lines = [
      `## Brief · @${doc.account?.handle || 'account'}`,
      '',
      doc.executiveBrief || a.accountSummary || '',
      '',
      `**Niche:** ${a.niche || '—'}`,
      `**Goal:** ${doc.playbook?.goal || '—'} (${doc.playbook?.horizon || ''})`,
      `**Risk:** ${doc.playbook?.riskLevel || '—'}`,
      '',
      '### Scores',
      `- Growth: ${d.scoreGrowth ?? '—'} / 10`,
      `- Voice: ${d.scoreVoiceClarity ?? '—'} / 10`,
      `- Audience fit: ${d.scoreAudienceFit ?? '—'} / 10`,
      '',
      '### Audience',
      `- Primary: ${a.audience?.primary?.label || '—'} — ${a.audience?.primary?.who || ''}`,
      '',
      '### Playbook steps',
      ...(doc.playbook?.steps || []).map(
        (s, i) =>
          `${i + 1}. ${s.enabled === false ? '⬜' : '✅'} **${s.title}** (\`${s.tool}\`)${s.requiresConfirm ? ' ⚠️' : ''} — ${s.reason || ''}`,
      ),
      '',
      '### Content ideas',
      ...(doc.playbook?.contentCalendar || [])
        .slice(0, 5)
        .map((c) => `- Day ${c.day}: ${c.idea} (${c.format || 'single'})`),
    ];
    return lines.join('\n');
  }

  function playbookContextForChat(doc) {
    if (!doc?.playbook) return '';
    const steps = (doc.playbook.steps || [])
      .filter((s) => s.enabled !== false)
      .map((s) => `${s.tool}${s.requiresConfirm ? '(confirm)' : ''}`)
      .slice(0, 12)
      .join(', ');
    return [
      '## ACTIVE PLAYBOOK (from Strategist)',
      `@${doc.account?.handle || '?'} · niche: ${doc.analysis?.niche || '—'}`,
      `Goal: ${doc.playbook.goal || '—'} · risk: ${doc.playbook.riskLevel || '—'}`,
      `Brief: ${(doc.executiveBrief || '').slice(0, 400)}`,
      `Enabled steps: ${steps || 'none'}`,
      'Prefer executing / refining this playbook over inventing unrelated bulk actions.',
    ].join('\n');
  }

  async function runStrategyPipeline(params) {
    const {
      llmConfig,
      persona,
      safety,
      pageTool,
      onProgress,
      languageHint,
    } = params;

    if (!pageTool) {
      return { ok: false, error: 'Open x.com tab first (page tools unavailable)' };
    }

    onProgress?.({ phase: 'start', label: 'Bắt đầu phân tích tài khoản…' });

    const signals = await gatherSignals(pageTool, onProgress);

    if (!signals.compact?.sampleTweets?.length && signals.errors.length > 5) {
      const fail = {
        ok: false,
        error:
          'Không thu thập đủ dữ liệu từ tab x.com. Mở x.com (đã login), refresh, mở profile 1 lần, rồi chạy lại.',
        signals: signals.compact,
        gatherErrors: signals.errors,
      };
      await chrome.storage.local.set({ [RESULT_KEY]: { ...fail, at: Date.now() } });
      return fail;
    }

    onProgress?.({ phase: 'synthesize', label: 'Grok đang chẩn đoán & lên kịch bản…' });

    let synth;
    try {
      synth = await synthesizePlaybook(
        llmConfig,
        persona,
        {
          ...signals.compact,
          safetyCaps: safety || {},
          personaHint: persona || {},
        },
        languageHint,
      );
    } catch (err) {
      const fail = {
        ok: false,
        error: err.message || String(err),
        signals: signals.compact,
      };
      await chrome.storage.local.set({ [RESULT_KEY]: { ...fail, at: Date.now() } });
      return fail;
    }

    const doc = normalizePlaybook(synth.parsed, signals);
    doc.model = synth.model;
    doc.briefMarkdown = briefMarkdown(doc);

    // Preserve previous persona fields; only fill gaps + niche/tone from analysis
    const prevPersona = persona || {};
    const nextPersona = {
      ...prevPersona,
      name: prevPersona.name || doc.account.name || 'XActions Executor',
      niche: doc.analysis.niche || prevPersona.niche,
      tone: doc.analysis.voice?.tone || prevPersona.tone,
      _backup: prevPersona._backup || {
        niche: prevPersona.niche,
        tone: prevPersona.tone,
        at: Date.now(),
      },
    };

    await chrome.storage.local.set({
      [PLAYBOOK_KEY]: doc,
      [ANALYSIS_KEY]: {
        at: doc.createdAt,
        handle: doc.account.handle,
        niche: doc.analysis.niche,
      },
      agentPersona: nextPersona,
      [RESULT_KEY]: {
        ok: true,
        at: Date.now(),
        handle: doc.account.handle,
        steps: doc.playbook.steps.length,
        brief: doc.briefMarkdown,
      },
    });

    onProgress?.({ phase: 'done', label: 'Kịch bản sẵn sàng' });

    return {
      ok: true,
      playbook: doc,
      brief: doc.briefMarkdown,
      executiveBrief: doc.executiveBrief,
      model: synth.model,
      usage: synth.usage,
      rejectedSteps: doc.playbook.rejectedSteps || [],
    };
  }

  async function executePlaybook(params) {
    const {
      playbook,
      ctx,
      onProgress,
      onlyStepIds,
      force = false,
      selectedStepIds = null,
    } = params;

    const doc = playbook || (await chrome.storage.local.get(PLAYBOOK_KEY))[PLAYBOOK_KEY];
    if (!doc?.playbook?.steps?.length) {
      return { ok: false, error: 'Chưa có kịch bản — chạy Phân tích trước' };
    }

    const cap = ctx.safety?.maxActionsPerTurn || 20;
    let steps = doc.playbook.steps.filter((s) => {
      if (selectedStepIds?.length) return selectedStepIds.includes(s.id);
      if (onlyStepIds?.length) return onlyStepIds.includes(s.id);
      if (s.enabled === false) return false;
      return true;
    });

    const results = [];
    let startedAuto = false;

    for (const step of steps) {
      const tool = sanitizeToolName(step.tool);

      if (DENYLIST.has(tool) || !PLAYBOOK_ALLOWLIST.has(tool)) {
        results.push({
          id: step.id,
          tool,
          skipped: true,
          reason: 'blocked_by_allowlist',
          status: 'blocked',
        });
        step.status = 'blocked';
        continue;
      }

      if (step.requiresConfirm && !force) {
        results.push({
          id: step.id,
          tool,
          skipped: true,
          reason: 'requiresConfirm — bật force hoặc bỏ tick ⚠️ / duyệt bước',
          status: 'skipped_confirm',
        });
        step.status = 'skipped_confirm';
        continue;
      }

      const args = { ...(step.args || {}) };
      if (/unfollow/i.test(tool) && args.dryRun === undefined) {
        args.dryRun = true;
      }
      if (args.maxActions != null) {
        args.maxActions = Math.min(Math.max(1, Number(args.maxActions) || 10), cap);
      }

      // Before first automation start after non-stop tools, ensure stop was done
      if (tool.startsWith('x_start_') && !startedAuto) {
        startedAuto = true;
      }

      onProgress?.({
        phase: 'execute',
        label: step.title,
        tool,
        id: step.id,
      });

      let result;
      try {
        result = await globalThis.XActionsTools.executeTool(tool, args, ctx);
        const failed = !!(result?.error || result?.success === false);
        step.status = failed ? 'failed' : 'done';
      } catch (err) {
        result = { error: err.message || String(err) };
        step.status = 'failed';
      }

      results.push({
        id: step.id,
        tool,
        args,
        result,
        status: step.status,
      });
      step.lastResult = result;

      await sleep(900);
    }

    doc.playbook.steps = doc.playbook.steps.map((s) => {
      const hit = results.find((r) => r.id === s.id);
      return hit
        ? { ...s, status: hit.status || s.status, lastResult: hit.result }
        : s;
    });
    doc.lastRunAt = Date.now();
    await chrome.storage.local.set({ [PLAYBOOK_KEY]: doc });

    const done = results.filter((r) => r.status === 'done').length;
    return {
      ok: true,
      results,
      playbook: doc,
      summary: `${done}/${results.length} steps executed`,
    };
  }

  async function updateStepFlags(updates) {
    // updates: [{ id, enabled?, requiresConfirm? }]
    const data = await chrome.storage.local.get(PLAYBOOK_KEY);
    const doc = data[PLAYBOOK_KEY];
    if (!doc?.playbook?.steps) return { ok: false, error: 'no playbook' };
    const map = Object.fromEntries((updates || []).map((u) => [u.id, u]));
    doc.playbook.steps = doc.playbook.steps.map((s) => {
      const u = map[s.id];
      if (!u) return s;
      return {
        ...s,
        enabled: u.enabled !== undefined ? !!u.enabled : s.enabled,
        requiresConfirm:
          u.requiresConfirm !== undefined ? !!u.requiresConfirm : s.requiresConfirm,
      };
    });
    await chrome.storage.local.set({ [PLAYBOOK_KEY]: doc });
    return { ok: true, playbook: doc };
  }

  async function loadPlaybook() {
    const data = await chrome.storage.local.get([
      PLAYBOOK_KEY,
      ANALYSIS_KEY,
      RESULT_KEY,
    ]);
    return {
      playbook: data[PLAYBOOK_KEY] || null,
      analysisMeta: data[ANALYSIS_KEY] || null,
      lastResult: data[RESULT_KEY] || null,
    };
  }

  async function clearPlaybook() {
    await chrome.storage.local.remove([PLAYBOOK_KEY, ANALYSIS_KEY, RESULT_KEY]);
    return { success: true };
  }

  globalThis.XActionsStrategist = {
    runStrategyPipeline,
    executePlaybook,
    loadPlaybook,
    clearPlaybook,
    updateStepFlags,
    briefMarkdown,
    playbookContextForChat,
    PLAYBOOK_ALLOWLIST,
    DENYLIST,
    PLAYBOOK_KEY,
    ANALYSIS_KEY,
    PROGRESS_KEY,
    RESULT_KEY,
  };
})();
