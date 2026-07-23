// XActions Extension — Strategist pipeline (hardened)
// Analyze account → audience → style → playbook → (user confirm) execute
// by nichxbt

(() => {
  const PLAYBOOK_KEY = 'agentPlaybook';
  const ANALYSIS_KEY = 'agentAccountAnalysis';
  const PROGRESS_KEY = 'agentStrategyProgress';
  const RESULT_KEY = 'agentStrategyLastResult';

  /**
   * Tools strategist may put in a playbook (execute allowlist).
   * ~catalog minus denylist + meta/config noise (list_tools, clear log, update persona…).
   * Prefer bulk x_start_* / *_visible_matching over one-shot spam.
   */
  const PLAYBOOK_ALLOWLIST = new Set([
    // ── Control / safety ─────────────────────────────────────
    'x_stop_all',
    'x_stop_automation',
    'x_pause_all',
    'x_resume_all',
    'x_list_automations',
    'x_automation_status',
    'x_get_running',
    'x_get_safety',
    'x_set_safety',
    'x_wait',

    // ── Navigation ───────────────────────────────────────────
    'x_go_home',
    'x_go_explore',
    'x_go_profile',
    'x_go_notifications',
    'x_go_messages',
    'x_navigate',
    'x_refresh_page',
    'x_open_user',
    'x_open_following_page',
    'x_open_lists',
    'x_open_communities',
    'x_open_bookmarks',
    'x_open_search_people',

    // ── Read / scrape (visible DOM) ──────────────────────────
    'x_get_page_context',
    'x_get_sidebar_account',
    'x_get_visible_tweets',
    'x_get_visible_users',
    'x_scroll_timeline',
    'x_search_tweets',
    'x_get_trends',
    'x_get_notifications',
    'x_get_profile_stats',
    'x_get_tweet_detail',
    'x_get_replies_visible',
    'x_get_media_visible',
    'x_get_likes_tab',
    'x_get_followers_visible',
    'x_get_following_visible',
    'x_get_bookmarks_visible',
    'x_get_lists_visible',
    'x_get_user_card',
    'x_extract_links',
    'x_copy_tweet_text',
    'x_get_dm_preview',

    // ── Analytics (visible) ──────────────────────────────────
    'x_engagement_snapshot',
    'x_follower_ratio_visible',
    'x_top_tweets_visible',
    'x_hashtag_frequency',
    'x_mention_frequency',
    'x_best_time_hint',
    'x_bot_score_visible',
    'x_link_domains',

    // ── One-shot engagement (confirm on write) ───────────────
    'x_like',
    'x_unlike',
    'x_retweet',
    'x_unretweet',
    'x_bookmark',
    'x_unbookmark',
    'x_follow',
    'x_unfollow',
    'x_reply',
    'x_quote_tweet',
    'x_like_visible_matching',
    'x_retweet_visible_matching',
    'x_bookmark_visible_matching',
    'x_follow_visible',

    // ── Automations ──────────────────────────────────────────
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

    // ── LLM content (draft only — never posts) ───────────────
    'x_draft_tweet',
    'x_draft_thread',
    'x_draft_reply',
    'x_rewrite_text',
    'x_summarize_feed',
    'x_analyze_sentiment_visible',
    'x_suggest_hashtags',
    'x_generate_variations',
    'x_optimize_tweet',
    'x_voice_match_check',
    'x_competitor_summary',
    'x_niche_ideas',
  ]);

  /** Always require explicit force / user enable before execute */
  const ALWAYS_CONFIRM = new Set([
    'x_start_smart_unfollow',
    'x_start_growth_suite',
    'x_start_auto_comment',
    'x_start_follow_engagers',
    'x_start_keyword_follow',
    'x_follow_visible',
    'x_like_visible_matching',
    'x_retweet_visible_matching',
    'x_follow',
    'x_unfollow',
    'x_reply',
    'x_quote_tweet',
    'x_retweet',
    'x_set_safety',
  ]);

  /** Never allowed in playbook execute (hard deny even if model invents them) */
  const DENYLIST = new Set([
    'x_block_user',
    'x_unblock_user',
    'x_mute_user',
    'x_unmute_user',
    'x_report_user',
    'x_delete_tweet',
    'x_post_tweet',
    'x_post_thread',
    'x_compose_dm',
    'x_open_messages_user',
    'x_pin_tweet',
    'x_update_persona',
    'x_clear_agent_log',
  ]);

  /** Intrinsic risk tier per tool (used by deterministic safety analyzer) */
  const TOOL_RISK = {
    // critical
    x_start_growth_suite: 'critical',
    x_start_smart_unfollow: 'critical',
    x_unfollow: 'critical',
    // high
    x_start_auto_comment: 'high',
    x_start_follow_engagers: 'high',
    x_start_keyword_follow: 'high',
    x_follow_visible: 'high',
    x_follow: 'high',
    x_reply: 'high',
    x_quote_tweet: 'high',
    x_retweet: 'high',
    x_retweet_visible_matching: 'high',
    x_set_safety: 'high',
    // medium
    x_start_auto_like: 'medium',
    x_like: 'medium',
    x_like_visible_matching: 'medium',
    x_bookmark_visible_matching: 'medium',
    x_unlike: 'medium',
    x_unretweet: 'medium',
    x_unbookmark: 'medium',
    x_bookmark: 'low',
    // low default for read/nav/draft/analytics
  };

  const RISK_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

  function toolRisk(tool) {
    if (TOOL_RISK[tool]) return TOOL_RISK[tool];
    if (/^x_start_/.test(tool) && !/best_time|quick_stats|video|thread|unfollower/.test(tool)) {
      return 'medium';
    }
    if (/unfollow|growth_suite/i.test(tool)) return 'critical';
    if (/follow|reply|quote|retweet|comment/i.test(tool)) return 'high';
    if (/like|bookmark/i.test(tool)) return 'medium';
    return 'low';
  }

  function systemStrategist(persona) {
    const p = persona || {};
    const allowed = [...PLAYBOOK_ALLOWLIST].join(', ');
    return [
      'You are the XActions STRATEGIST for X/Twitter growth.',
      `Persona hint: ${p.name || 'operator'} · tone ${p.tone || 'clear'} · niche ${p.niche || 'unknown'}.`,
      '',
      "You receive scraped DOM signals from the user's logged-in x.com tab.",
      'Produce a rigorous account diagnosis, a SAFETY ANALYSIS, and an actionable playbook.',
      '',
      'Rules:',
      '- Be specific to the data; do not invent follower counts not present.',
      '- Prefer safe defaults: dryRun true for unfollow; cap bulk maxActions ≤ 15.',
      `- Map steps ONLY to these tools (${PLAYBOOK_ALLOWLIST.size} allowed): ${allowed}.`,
      '- Prefer bulk runners (x_start_*, *_visible_matching) and analytics/LLM drafts over one-shot spam.',
      '- Use read/analytics tools early (trends, engagement_snapshot, competitor_summary) before growth actions.',
      '- Draft tools NEVER post; do not schedule x_post_tweet / x_post_thread / x_compose_dm.',
      '- NEVER use denylist: block/mute/report/delete/post/pin/DM compose/update_persona.',
      '- First executable phase should often start with signal (likes/search/analytics), not mass unfollow.',
      '',
      'SAFETY ANALYSIS (required):',
      '- Inspect account factors: follower/following ratio, sample volume, engagement quality, niche sensitivity.',
      '- Score overallRisk low|medium|high and recommend riskLevel + daily caps.',
      '- Flag high-risk steps (unfollow, growth suite, mass follow, reply/quote) with why.',
      '- List concrete guardrails the executor must follow.',
      '- If account looks new/small/imbalanced, prefer conservative and disable aggressive steps.',
      '- summaryVi must be plain Vietnamese for the user.',
      '',
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
  "safetyAnalysis": {
    "overallRisk": "low|medium|high",
    "score": 1,
    "accountFactors": ["e.g. following>>followers", "low sample size"],
    "actionRisks": [{ "tool": "x_start_smart_unfollow", "risk": "critical", "why": "ban risk if not dryRun" }],
    "recommendedRiskLevel": "conservative|moderate|aggressive",
    "recommendedCaps": {
      "likes": 20,
      "follows": 10,
      "unfollows": 5,
      "replies": 3,
      "maxActionsPerTurn": 12
    },
    "guardrails": ["dryRun unfollow first", "no reply spam Day 1"],
    "shouldDisable": ["x_start_growth_suite"],
    "summaryVi": "Tóm tắt rủi ro bằng tiếng Việt cho user"
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

  function parseNumLoose(v) {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).replace(/[,\s]/g, '').replace(/K$/i, '000').replace(/M$/i, '000000');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function extractAccountStats(compact) {
    const stats = compact?.profileStats || compact?.followerRatio || {};
    const followers =
      parseNumLoose(stats.followers ?? stats.followersCount ?? stats.follower_count) ??
      parseNumLoose(compact?.account?.followers) ??
      null;
    const following =
      parseNumLoose(stats.following ?? stats.followingCount ?? stats.friends_count) ??
      parseNumLoose(compact?.account?.following) ??
      null;
    return { followers, following };
  }

  /**
   * Deterministic safety pass: merge LLM safetyAnalysis + account signals + tool risk tiers.
   * Mutates steps (confirm / dryRun / caps / enable) and attaches doc.safetyAnalysis.
   */
  function analyzeSafety(doc, signals, userSafety, llmSafety) {
    const compact = signals?.compact || doc.signals || {};
    const { followers, following } = extractAccountStats(compact);
    const sampleN = (compact.sampleTweets || []).length;
    const gatherErrN = (compact.gatherErrors || []).length;

    const accountFactors = [];
    if (followers != null && followers < 100) accountFactors.push('Tài khoản nhỏ (<100 followers) — dễ dính rate-limit/spam signal');
    if (followers != null && following != null && following > Math.max(followers * 2, 50)) {
      accountFactors.push('Following >> followers — hạn chế mass follow/unfollow');
    }
    if (sampleN < 5) accountFactors.push('Ít mẫu tweet — phân tích mỏng, giữ cap thấp');
    if (gatherErrN >= 3) accountFactors.push('Nhiều lỗi scrape — giảm hành động ghi');

    const ai = llmSafety && typeof llmSafety === 'object' ? llmSafety : {};
    for (const f of ai.accountFactors || []) {
      if (f && !accountFactors.includes(f)) accountFactors.push(String(f));
    }

    // Account pressure → lean conservative
    let pressure = 0;
    if (followers != null && followers < 100) pressure += 2;
    else if (followers != null && followers < 500) pressure += 1;
    if (followers != null && following != null && following > followers * 2) pressure += 2;
    if (sampleN < 5) pressure += 1;
    if (gatherErrN >= 3) pressure += 1;

    const aiRisk = String(ai.overallRisk || ai.recommendedRiskLevel || '').toLowerCase();
    if (aiRisk === 'high' || aiRisk === 'critical' || aiRisk === 'conservative') pressure += 1;

    let riskLevel = String(
      ai.recommendedRiskLevel || doc.playbook?.riskLevel || 'moderate',
    ).toLowerCase();
    if (!['conservative', 'moderate', 'aggressive'].includes(riskLevel)) riskLevel = 'moderate';
    if (pressure >= 4) riskLevel = 'conservative';
    else if (pressure >= 2 && riskLevel === 'aggressive') riskLevel = 'moderate';

    const baseCaps = {
      conservative: { likes: 15, follows: 8, unfollows: 5, replies: 2, maxActionsPerTurn: 10 },
      moderate: { likes: 30, follows: 15, unfollows: 10, replies: 5, maxActionsPerTurn: 15 },
      aggressive: { likes: 50, follows: 25, unfollows: 15, replies: 8, maxActionsPerTurn: 20 },
    };
    const caps = { ...baseCaps[riskLevel] };
    const rec = ai.recommendedCaps || {};
    for (const k of Object.keys(caps)) {
      if (rec[k] != null) {
        const n = Number(rec[k]);
        if (Number.isFinite(n) && n > 0) caps[k] = Math.min(caps[k], Math.round(n));
      }
    }
    if (userSafety?.maxActionsPerTurn != null) {
      caps.maxActionsPerTurn = Math.min(
        caps.maxActionsPerTurn,
        Math.max(1, Number(userSafety.maxActionsPerTurn) || 20),
      );
    }

    const disableSet = new Set(
      (ai.shouldDisable || []).map((t) => sanitizeToolName(t)).filter(Boolean),
    );
    if (riskLevel === 'conservative') {
      disableSet.add('x_start_growth_suite');
      disableSet.add('x_start_auto_comment');
    }
    if (pressure >= 3) {
      disableSet.add('x_start_growth_suite');
    }

    const actionRisks = [];
    const steps = doc.playbook?.steps || [];
    for (const step of steps) {
      const risk = toolRisk(step.tool);
      step.risk = risk;

      const notes = [];
      if (risk === 'critical' || risk === 'high') {
        step.requiresConfirm = true;
        notes.push(risk === 'critical' ? 'Rủi ro cao (ban/rate-limit)' : 'Cần xác nhận trước khi chạy');
      }
      if (/unfollow/i.test(step.tool)) {
        step.args = { ...(step.args || {}), dryRun: true };
        notes.push('Ép dryRun=true (safety)');
      }
      if (step.args?.maxActions != null) {
        const capForTool = /unfollow/i.test(step.tool)
          ? caps.unfollows
          : /follow/i.test(step.tool)
            ? caps.follows
            : /reply|comment|quote/i.test(step.tool)
              ? caps.replies
              : /like/i.test(step.tool)
                ? caps.likes
                : caps.maxActionsPerTurn;
        step.args.maxActions = Math.min(
          Math.max(1, Number(step.args.maxActions) || 10),
          capForTool,
          caps.maxActionsPerTurn,
        );
      }
      if (disableSet.has(step.tool) && RISK_RANK[risk] >= RISK_RANK.high) {
        step.enabled = false;
        notes.push('AI/safety tắt bước này (bật tay nếu chắc chắn)');
      }
      if (userSafety?.requireConfirmHighRisk !== false && RISK_RANK[risk] >= RISK_RANK.high) {
        step.requiresConfirm = true;
      }

      step.safetyNotes = notes;
      if (RISK_RANK[risk] >= RISK_RANK.high) {
        actionRisks.push({
          tool: step.tool,
          risk,
          why: notes.join('; ') || step.reason || risk,
        });
      }
    }

    // Merge AI action risks not already listed
    for (const ar of ai.actionRisks || []) {
      const tool = sanitizeToolName(ar.tool);
      if (!tool) continue;
      if (!actionRisks.some((x) => x.tool === tool)) {
        actionRisks.push({
          tool,
          risk: ar.risk || toolRisk(tool),
          why: ar.why || '',
        });
      }
    }

    const guardrails = [
      ...(ai.guardrails || []).map(String),
      'Unfollow luôn dryRun trước khi force thật',
      `Cap mỗi lượt ≤ ${caps.maxActionsPerTurn} (maxActionsPerTurn)`,
      riskLevel === 'conservative'
        ? 'Chế độ conservative: không growth suite / auto comment mặc định'
        : 'Ưu tiên signal (like/search) trước follow/unfollow',
    ];
    // unique guardrails
    const seenG = new Set();
    const guardrailsUnique = guardrails.filter((g) => {
      const k = g.trim().toLowerCase();
      if (!k || seenG.has(k)) return false;
      seenG.add(k);
      return true;
    });

    const overallRisk =
      riskLevel === 'conservative' || pressure >= 3
        ? 'high'
        : riskLevel === 'aggressive'
          ? 'medium'
          : actionRisks.some((a) => a.risk === 'critical')
            ? 'high'
            : actionRisks.some((a) => a.risk === 'high')
              ? 'medium'
              : 'low';

    const score = Math.min(
      10,
      Math.max(
        1,
        Math.round(
          (RISK_RANK[overallRisk] || 2) * 2 +
            pressure +
            Math.min(3, actionRisks.filter((a) => a.risk === 'critical').length * 2),
        ),
      ),
    );

    const summaryVi =
      ai.summaryVi ||
      `Rủi ro ${overallRisk} (điểm ${score}/10). Mức kịch bản: ${riskLevel}. Caps: like ${caps.likes}/follow ${caps.follows}/unfollow ${caps.unfollows}/reply ${caps.replies}. ${accountFactors[0] || 'Không thấy tín hiệu đỏ từ profile.'}`;

    const safetyAnalysis = {
      overallRisk,
      score,
      riskLevel,
      accountFactors,
      actionRisks: actionRisks.slice(0, 20),
      recommendedCaps: caps,
      guardrails: guardrailsUnique.slice(0, 12),
      disabledTools: [...disableSet],
      summaryVi,
      analyzedAt: Date.now(),
      source: 'ai+rules',
      accountStats: { followers, following, sampleTweets: sampleN, gatherErrors: gatherErrN },
      pressure,
    };

    doc.playbook.riskLevel = riskLevel;
    doc.playbook.dailyCaps = {
      likes: caps.likes,
      follows: caps.follows,
      unfollows: caps.unfollows,
      replies: caps.replies,
    };
    doc.safetyAnalysis = safetyAnalysis;

    // Prepend set_safety when caps differ from default high
    if (caps.maxActionsPerTurn < 20 && !steps.some((s) => s.tool === 'x_set_safety')) {
      steps.unshift({
        id: 'step_set_safety',
        phase: 'Safety',
        title: `Áp cap an toàn (${caps.maxActionsPerTurn}/lượt)`,
        tool: 'x_set_safety',
        args: { maxActionsPerTurn: caps.maxActionsPerTurn },
        reason: safetyAnalysis.summaryVi,
        requiresConfirm: true,
        enabled: true,
        status: 'pending',
        risk: 'high',
        safetyNotes: ['AI safety đề xuất giới hạn hành động'],
      });
    }

    return safetyAnalysis;
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
      !!step.requiresConfirm ||
      ALWAYS_CONFIRM.has(tool) ||
      /unfollow|growth_suite|follow_engagers|keyword_follow|auto_comment/i.test(tool);

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

  function normalizePlaybook(parsed, signals, userSafety) {
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
        risk: 'low',
      });
    }

    const doc = {
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
      safetyAnalysis: null,
    };

    // AI + rules safety pass (mutates steps, riskLevel, dailyCaps)
    analyzeSafety(doc, signals, userSafety, parsed.safetyAnalysis);

    return doc;
  }

  function briefMarkdown(doc) {
    const a = doc.analysis || {};
    const d = a.diagnosis || {};
    const sa = doc.safetyAnalysis || {};
    const caps = sa.recommendedCaps || doc.playbook?.dailyCaps || {};
    const lines = [
      `## Brief · @${doc.account?.handle || 'account'}`,
      '',
      doc.executiveBrief || a.accountSummary || '',
      '',
      `**Niche:** ${a.niche || '—'}`,
      `**Goal:** ${doc.playbook?.goal || '—'} (${doc.playbook?.horizon || ''})`,
      `**Risk:** ${doc.playbook?.riskLevel || '—'} · safety ${sa.overallRisk || '—'} (${sa.score ?? '—'}/10)`,
      '',
      '### Safety (AI tự phân tích)',
      sa.summaryVi || '—',
      ...(sa.accountFactors || []).slice(0, 5).map((f) => `- ⚠ ${f}`),
      `Caps: like ${caps.likes ?? '—'} · follow ${caps.follows ?? '—'} · unfollow ${caps.unfollows ?? '—'} · reply ${caps.replies ?? '—'} · /lượt ${caps.maxActionsPerTurn ?? '—'}`,
      ...(sa.guardrails || []).slice(0, 4).map((g) => `- 🛡 ${g}`),
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
          `${i + 1}. ${s.enabled === false ? '⬜' : '✅'} **${s.title}** (\`${s.tool}\`) [${s.risk || '?'}]${s.requiresConfirm ? ' ⚠️' : ''} — ${s.reason || ''}`,
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
    const sa = doc.safetyAnalysis || {};
    const steps = (doc.playbook.steps || [])
      .filter((s) => s.enabled !== false)
      .map((s) => `${s.tool}[${s.risk || '?'}]${s.requiresConfirm ? '(confirm)' : ''}`)
      .slice(0, 12)
      .join(', ');
    return [
      '## ACTIVE PLAYBOOK (from Strategist)',
      `@${doc.account?.handle || '?'} · niche: ${doc.analysis?.niche || '—'}`,
      `Goal: ${doc.playbook.goal || '—'} · risk: ${doc.playbook.riskLevel || '—'} · safety: ${sa.overallRisk || '—'} (${sa.score ?? '—'}/10)`,
      `Safety: ${(sa.summaryVi || '').slice(0, 300)}`,
      `Caps: ${JSON.stringify(sa.recommendedCaps || doc.playbook.dailyCaps || {})}`,
      `Brief: ${(doc.executiveBrief || '').slice(0, 400)}`,
      `Enabled steps: ${steps || 'none'}`,
      'Respect safetyAnalysis guardrails. Prefer executing / refining this playbook over inventing unrelated bulk actions.',
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

    const doc = normalizePlaybook(synth.parsed, signals, safety);
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
        safety: doc.safetyAnalysis
          ? {
              overallRisk: doc.safetyAnalysis.overallRisk,
              score: doc.safetyAnalysis.score,
              riskLevel: doc.safetyAnalysis.riskLevel,
              summaryVi: doc.safetyAnalysis.summaryVi,
            }
          : null,
      },
    });

    onProgress?.({
      phase: 'done',
      label: doc.safetyAnalysis?.summaryVi
        ? `Kịch bản sẵn sàng · ${doc.safetyAnalysis.overallRisk} risk`
        : 'Kịch bản sẵn sàng',
    });

    return {
      ok: true,
      playbook: doc,
      brief: doc.briefMarkdown,
      executiveBrief: doc.executiveBrief,
      safetyAnalysis: doc.safetyAnalysis,
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

    const recCap = doc.safetyAnalysis?.recommendedCaps?.maxActionsPerTurn;
    const cap = Math.min(
      Number(ctx.safety?.maxActionsPerTurn) || 20,
      Number(recCap) || 20,
    );
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

      step.status = 'running';
      onProgress?.({
        phase: 'execute',
        label: step.title,
        tool,
        id: step.id,
      });
      // Persist mid-run so popup can show live step status
      try {
        await chrome.storage.local.set({ [PLAYBOOK_KEY]: doc });
      } catch { /* ignore */ }

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

      try {
        await chrome.storage.local.set({ [PLAYBOOK_KEY]: doc });
      } catch { /* ignore */ }

      // Slightly snappier pacing between steps (still polite to X)
      await sleep(650);
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
    analyzeSafety,
    toolRisk,
    PLAYBOOK_ALLOWLIST,
    DENYLIST,
    PLAYBOOK_KEY,
    ANALYSIS_KEY,
    PROGRESS_KEY,
    RESULT_KEY,
  };
})();
