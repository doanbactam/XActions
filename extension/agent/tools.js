// XActions Extension — Agent tools executor (~100 tools from catalog)
// Agent EXECUTES for the user on the x.com tab.
// by nichxbt

(() => {
  const AUTO_MAP = {
    x_start_auto_like: 'autoLiker',
    x_start_smart_unfollow: 'smartUnfollow',
    x_start_keyword_follow: 'keywordFollow',
    x_start_growth_suite: 'growthSuite',
    x_start_auto_comment: 'autoCommenter',
    x_start_follow_engagers: 'followEngagers',
    x_start_unfollower_detector: 'unfollowerDetector',
    x_start_best_time: 'bestTimeToPost',
    x_start_quick_stats: 'quickStats',
    x_start_video_downloader: 'videoDownloader',
    x_start_thread_reader: 'threadReader',
  };

  const AUTOMATION_IDS = [
    'autoLiker',
    'smartUnfollow',
    'keywordFollow',
    'growthSuite',
    'autoCommenter',
    'followEngagers',
    'videoDownloader',
    'threadReader',
    'unfollowerDetector',
    'bestTimeToPost',
    'quickStats',
  ];

  const ALIASES = {
    get_page_context: 'x_get_page_context',
    scroll_timeline: 'x_scroll_timeline',
    list_automations: 'x_list_automations',
    stop_automation: 'x_stop_automation',
    stop_all: 'x_stop_all',
    draft_tweet: 'x_draft_tweet',
    draft_reply: 'x_draft_reply',
    get_agent_config: 'x_get_agent_config',
    update_persona: 'x_update_persona',
  };

  function getDefs() {
    return globalThis.XActionsCatalog?.TOOL_DEFINITIONS || [];
  }

  function getMeta(name) {
    return globalThis.XActionsCatalog?.TOOL_META?.[name] || null;
  }

  function systemPrompt(persona, safety, playbook) {
    const p = persona || {};
    const max = safety?.maxActionsPerTurn || 20;
    const n = globalThis.XActionsCatalog?.count || 100;
    const pbCtx =
      (playbook && globalThis.XActionsStrategist?.playbookContextForChat?.(playbook)) ||
      '';
    return [
      'You are the XActions EXECUTOR agent inside a Chrome extension on x.com.',
      'Primary product flow is Strategist (analyze → playbook → run), not open-ended chat.',
      `Persona: ${p.name || 'XActions Executor'}. Tone: ${p.tone || 'decisive, action-first'}.`,
      p.niche ? `Niche: ${p.niche}.` : '',
      '',
      '## ROLE',
      `- You have ~${n} tools. YOU perform actions for the user on their logged-in x.com tab.`,
      '- If user asks for strategy/growth plan, remind them to use Phân tích & kịch bản (or help refine the existing playbook).',
      '- NEVER tell the user to open Automations cards or click Start. Call tools yourself.',
      '- Prefer start tools (x_start_*) for bulk work; use one-shot page tools (x_like, x_follow) for single actions.',
      `- Cap bulk maxActions at ${max}. dryRun=true for unfollow unless user insists real run.`,
      '- Draft/AI tools never post unless a post tool succeeds. Be transparent.',
      '- If a tool fails, say why and retry with x_navigate / x_go_* / x_ping_tab.',
      '- Unsure which tool? Call x_list_tools or x_describe_tool.',
      '- Do NOT call x_block_user / x_delete_tweet / x_post_tweet unless user explicitly demands.',
      '',
      pbCtx,
      '',
      '## QUICK MAP',
      '- like many posts → x_start_auto_like or x_like_visible_matching',
      '- unfollow non-followers → x_start_smart_unfollow (dryRun default true)',
      '- follow by keyword → x_start_keyword_follow',
      '- who unfollowed → x_start_unfollower_detector (need /followers page)',
      '- draft only → x_draft_tweet / x_draft_reply (never auto-post)',
      '- read feed → x_get_page_context / x_get_visible_tweets',
      '- navigate → x_go_home / x_go_profile / x_navigate (SW-safe)',
      '- stop → x_stop_all / x_stop_automation',
      '',
      'Reply briefly in the user language after executing tools.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  function splitList(val) {
    if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof val === 'string') {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }

  function clean(s) {
    return String(s || '')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  function buildAutoSettings(name, args, safety) {
    const a = args || {};
    const cap = safety?.maxActionsPerTurn || 20;
    const settings = { ...(a.settings || {}) };

    if (a.keywords !== undefined) settings.keywords = splitList(a.keywords);
    if (a.whitelist !== undefined) settings.whitelist = splitList(a.whitelist);
    if (a.comments !== undefined) settings.comments = splitList(a.comments);
    if (a.maxActions !== undefined) settings.maxActions = Number(a.maxActions);
    if (a.dryRun !== undefined) settings.dryRun = !!a.dryRun;
    if (a.daysToWait !== undefined) settings.daysToWait = Number(a.daysToWait);
    if (a.minFollowers !== undefined) settings.minFollowers = Number(a.minFollowers);
    if (a.maxPerKeyword !== undefined) settings.maxPerKeyword = Number(a.maxPerKeyword);
    if (a.mode !== undefined) settings.mode = a.mode;
    if (a.minDelay !== undefined) settings.minDelay = Number(a.minDelay);
    if (a.maxDelay !== undefined) settings.maxDelay = Number(a.maxDelay);
    if (a.maxLikes !== undefined) settings.maxLikes = Number(a.maxLikes);
    if (a.maxFollows !== undefined) settings.maxFollows = Number(a.maxFollows);
    if (a.maxUnfollows !== undefined) settings.maxUnfollows = Number(a.maxUnfollows);
    if (a.sessionMinutes !== undefined) settings.sessionMinutes = Number(a.sessionMinutes);
    if (a.tweetCount !== undefined) settings.tweetCount = Number(a.tweetCount);
    if (a.sampleSize !== undefined) settings.sampleSize = Number(a.sampleSize);
    if (a.quality !== undefined) settings.quality = a.quality;

    if (settings.maxActions != null) {
      settings.maxActions = Math.min(Math.max(1, settings.maxActions || 10), cap);
    } else {
      settings.maxActions = Math.min(12, cap);
    }

    const id = AUTO_MAP[name];
    if ((id === 'smartUnfollow' || id === 'unfollowEveryone') && settings.dryRun === undefined) {
      settings.dryRun = true;
    }
    if (!settings.minDelay) settings.minDelay = 2000;
    if (!settings.maxDelay) settings.maxDelay = 5000;
    return settings;
  }

  async function runLlmTool(name, a, ctx) {
    const persona = ctx.persona || {};
    const chat = (system, user, opts) =>
      globalThis.XActionsLLM.chatCompletion(
        ctx.llmConfig,
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        null,
        opts || { temperature: 0.7, maxTokens: 600 },
      );

    let feed = '';
    if (
      (name === 'x_summarize_feed' ||
        name === 'x_analyze_sentiment_visible' ||
        name === 'x_competitor_summary') &&
      ctx.pageTool
    ) {
      try {
        const ctxPage = await ctx.pageTool('x_get_page_context', {
          maxTweets: a.maxTweets || 12,
        });
        feed = (ctxPage.tweets || [])
          .map((t) => `@${t.author}: ${t.text}`)
          .join('\n');
      } catch {
        feed = '';
      }
    }

    switch (name) {
      case 'x_draft_tweet': {
        const r = await chat(
          `You are ${persona.name || 'creator'}. Tone: ${persona.tone || 'sharp'}. ONE tweet ≤280. No hashtag spam. ONLY the tweet.`,
          `Topic: ${a.topic}${a.style ? `\nStyle: ${a.style}` : ''}`,
          { temperature: 0.9, maxTokens: 200 },
        );
        return { draft: clean(r.message.content), posted: false };
      }
      case 'x_draft_reply': {
        const r = await chat(
          `You are ${persona.name || 'creator'}. 1-2 sentence reply. No generic openers. ONLY reply.`,
          `Reply to @${a.author}: "${a.tweetText}"`,
          { temperature: 0.85, maxTokens: 150 },
        );
        return { draft: clean(r.message.content), posted: false };
      }
      case 'x_draft_thread': {
        const parts = Math.min(Math.max(Number(a.parts) || 4, 3), 6);
        const r = await chat(
          `Write a ${parts}-tweet thread. Separate tweets with ---. Persona: ${persona.tone || 'clear'}.`,
          `Topic: ${a.topic}`,
          { temperature: 0.85, maxTokens: 900 },
        );
        const tweets = clean(r.message.content)
          .split(/\n*---\n*/)
          .map((s) => s.trim())
          .filter(Boolean);
        return { tweets, posted: false };
      }
      case 'x_rewrite_text': {
        const r = await chat(
          `Rewrite in persona tone (${persona.tone || 'natural'}). Return ONLY rewritten text.`,
          a.text + (a.style ? `\nStyle: ${a.style}` : ''),
        );
        return { text: clean(r.message.content) };
      }
      case 'x_summarize_feed': {
        const r = await chat(
          'Summarize this X feed in 5 bullets. Note themes and notable accounts.',
          feed || 'No tweets visible.',
        );
        return { summary: clean(r.message.content), source: feed ? 'visible_dom' : 'empty' };
      }
      case 'x_analyze_sentiment_visible': {
        const r = await chat(
          'Sentiment analysis of these tweets: overall mood, % positive/neutral/negative estimate, key themes.',
          feed || 'No tweets.',
        );
        return { analysis: clean(r.message.content) };
      }
      case 'x_suggest_hashtags': {
        const r = await chat(
          'Suggest 5-8 relevant hashtags. Return comma-separated only.',
          a.text,
          { temperature: 0.5, maxTokens: 100 },
        );
        return { hashtags: clean(r.message.content) };
      }
      case 'x_generate_variations': {
        const n = Math.min(Number(a.count) || 3, 5);
        const r = await chat(
          `Write ${n} alternative tweets. Separate with ---.`,
          a.text,
        );
        return {
          variations: clean(r.message.content)
            .split(/\n*---\n*/)
            .map((s) => s.trim())
            .filter(Boolean),
        };
      }
      case 'x_optimize_tweet': {
        const r = await chat(
          'Optimize this tweet for clarity and engagement without clickbait. Return ONLY optimized tweet.',
          a.text,
        );
        return { optimized: clean(r.message.content), original: a.text };
      }
      case 'x_voice_match_check': {
        const r = await chat(
          `Does this match persona tone "${persona.tone}"? Score 1-10 and brief notes.`,
          a.text,
        );
        return { review: clean(r.message.content) };
      }
      case 'x_competitor_summary': {
        const r = await chat(
          'Summarize content style of this account from sample tweets.',
          `Username: ${a.username || 'unknown'}\n${feed || 'No sample tweets — open their profile first.'}`,
        );
        return { summary: clean(r.message.content) };
      }
      case 'x_niche_ideas': {
        const n = Math.min(Number(a.count) || 5, 10);
        const r = await chat(
          `Give ${n} tweet ideas for niche. Numbered list.`,
          a.niche || persona.niche || 'tech',
        );
        return { ideas: clean(r.message.content) };
      }
      default:
        return { error: `LLM tool not implemented: ${name}` };
    }
  }

  async function executeTool(name, args, ctx) {
    let n = name;
    let a = args || {};

    if (n === 'start_automation') {
      const id = a.automationId;
      const reverse = Object.entries(AUTO_MAP).find(([, v]) => v === id);
      n = reverse?.[0] || 'x_start_auto_like';
      a = { ...a, ...(a.settings || {}) };
    } else if (ALIASES[n]) {
      n = ALIASES[n];
    }

    // ── Auto / control ──
    if (n === 'x_list_automations') {
      const running = ctx.automations || {};
      return {
        automations: AUTOMATION_IDS.map((id) => ({
          id,
          running: !!running[id]?.running,
          actionCount: running[id]?.actionCount || 0,
        })),
      };
    }

    if (n === 'x_automation_status' || n === 'x_get_running') {
      const running = ctx.automations || {};
      if (n === 'x_automation_status') {
        const id = a.automationId;
        return {
          automationId: id,
          running: !!running[id]?.running,
          actionCount: running[id]?.actionCount || 0,
          settings: running[id]?.settings,
        };
      }
      return {
        running: Object.entries(running)
          .filter(([, v]) => v?.running)
          .map(([id, v]) => ({
            id,
            actionCount: v.actionCount || 0,
            startedAt: v.startedAt,
          })),
      };
    }

    if (n === 'x_stop_automation') {
      if (!a.automationId) return { error: 'automationId required' };
      const res = await ctx.stopAutomation(a.automationId);
      return { success: !!res?.success, automationId: a.automationId, status: 'stopped' };
    }

    if (n === 'x_stop_all' || n === 'x_pause_all') {
      if (n === 'x_pause_all' && ctx.globalPause) {
        return { ...(await ctx.globalPause()), status: 'paused' };
      }
      return { ...(await ctx.stopAll()), status: 'all_stopped' };
    }

    if (n === 'x_resume_all' && ctx.globalResume) {
      return { ...(await ctx.globalResume()), status: 'resumed' };
    }

    if (AUTO_MAP[n]) {
      const automationId = AUTO_MAP[n];
      const settings = buildAutoSettings(n, a, ctx.safety);
      const res = await ctx.startAutomation(automationId, settings);
      if (!res?.success) {
        return {
          success: false,
          automationId,
          error: res?.error || 'Failed — open x.com tab',
          settings,
        };
      }
      return {
        success: true,
        automationId,
        settings,
        status: 'running',
        message: `Started ${automationId} for the user (no manual click needed).`,
      };
    }

    // ── Config ──
    if (n === 'x_get_agent_config' || n === 'x_get_safety') {
      return {
        persona: ctx.persona,
        safety: ctx.safety,
        provider: ctx.llmConfig?.provider,
        model: ctx.llmConfig?.model,
        toolCount: globalThis.XActionsCatalog?.count,
        role: 'executor',
      };
    }

    if (n === 'x_set_safety') {
      const safety = {
        ...(ctx.safety || {}),
        maxActionsPerTurn: Math.min(Math.max(Number(a.maxActionsPerTurn) || 20, 1), 50),
      };
      if (ctx.saveSafety) await ctx.saveSafety(safety);
      else await chrome.storage.local.set({ agentSafety: safety });
      return { success: true, safety };
    }

    if (n === 'x_clear_agent_log') {
      await chrome.storage.local.set({ agentChatHistory: [] });
      return { success: true };
    }

    if (n === 'x_export_activity_hint') {
      const data = await chrome.storage.local.get(['activityLog', 'automations']);
      return {
        running: data.automations || {},
        recent: (data.activityLog || []).slice(0, 20),
      };
    }

    if (n === 'x_wait') {
      const ms = Math.min(Math.max(Number(a.ms) || 1000, 100), 10000);
      await new Promise((r) => setTimeout(r, ms));
      return { waited: ms };
    }

    if (n === 'x_list_tools') {
      const cat = ctx.toolCatalog?.() || globalThis.XActionsCatalog;
      const all = cat?.TOOLS || [];
      const kind = a.kind ? String(a.kind).toLowerCase() : '';
      const q = a.query ? String(a.query).toLowerCase() : '';
      const limit = Math.min(Math.max(Number(a.limit) || 40, 1), 120);
      let list = all;
      if (kind) list = list.filter((t) => t.kind === kind);
      if (q) {
        list = list.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q),
        );
      }
      return {
        total: all.length,
        matched: list.length,
        tools: list.slice(0, limit).map((t) => ({
          name: t.name,
          kind: t.kind,
          description: t.description,
        })),
      };
    }

    if (n === 'x_describe_tool') {
      const name = a.name;
      const meta = getMeta(name) || globalThis.XActionsCatalog?.TOOL_META?.[name];
      if (!meta) {
        return {
          error: `Unknown tool: ${name}`,
          hint: 'Use x_list_tools with query filter',
        };
      }
      return {
        name: meta.name,
        kind: meta.kind,
        description: meta.description,
        parameters: meta.parameters,
        map: meta.map || null,
      };
    }

    if (n === 'x_ping_tab') {
      if (!ctx.pageTool) return { ok: false, error: 'No pageTool' };
      try {
        // Prefer SW nav ping via lightweight context
        const r = await ctx.pageTool('x_get_page_context', { maxTweets: 1 });
        return {
          ok: !r?.error,
          url: r?.url,
          path: r?.path,
          account: r?.account?.name || r?.account?.handle,
          error: r?.error,
        };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    }

    if (n === 'x_update_persona') {
      const next = { ...(ctx.persona || {}) };
      if (a.name) next.name = a.name;
      if (a.tone) next.tone = a.tone;
      if (a.niche) next.niche = a.niche;
      if (a.expertise) next.expertise = splitList(a.expertise);
      if (a.avoid) next.avoid = splitList(a.avoid);
      await ctx.savePersona(next);
      return { success: true, persona: next };
    }

    // ── LLM ──
    const meta = getMeta(n);
    if (
      meta?.kind === 'llm' ||
      /x_draft_|x_rewrite|x_summarize|x_analyze|x_suggest|x_generate|x_optimize|x_voice|x_competitor|x_niche/.test(
        n,
      )
    ) {
      return runLlmTool(n, a, ctx);
    }

    // ── Page (all remaining x_* tools) ──
    if (!ctx.pageTool) return { error: 'Open x.com tab for page tools' };
    return ctx.pageTool(n, a);
  }

  globalThis.XActionsTools = {
    get TOOL_DEFINITIONS() {
      const defs = getDefs();
      const legacy = [
        {
          type: 'function',
          function: {
            name: 'start_automation',
            description:
              'Legacy alias. Prefer x_start_* tools. Start automation by id: autoLiker, smartUnfollow, keywordFollow, growthSuite, autoCommenter, followEngagers, unfollowerDetector, bestTimeToPost, quickStats, videoDownloader, threadReader.',
            parameters: {
              type: 'object',
              properties: {
                automationId: { type: 'string' },
                keywords: { type: 'string' },
                maxActions: { type: 'number' },
                dryRun: { type: 'boolean' },
                settings: { type: 'object' },
              },
              required: ['automationId'],
            },
          },
        },
      ];
      return defs.length ? [...defs, ...legacy] : legacy;
    },
    systemPrompt,
    executeTool,
    AUTOMATION_IDS,
    AUTO_MAP,
  };
})();
