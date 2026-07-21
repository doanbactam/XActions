// XActions Extension — Full AI tool catalog (~100 tools)
// by nichxbt

(() => {
  /** @type {Array<{name:string,description:string,parameters:object,kind:string,map?:object}>} */
  const TOOLS = [];

  function t(name, description, properties = {}, required = [], kind = 'page', map = null) {
    TOOLS.push({
      name,
      description,
      kind,
      map,
      parameters: {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
      },
    });
  }

  const str = (d) => ({ type: 'string', description: d });
  const num = (d) => ({ type: 'number', description: d });
  const bool = (d) => ({ type: 'boolean', description: d });

  // ── Navigation / context (8) ───────────────────────────────
  t('x_get_page_context', 'Read URL, account, visible tweets on current x.com tab.', { maxTweets: num('1-20 default 8') }, [], 'page');
  t('x_scroll_timeline', 'Scroll feed to load more posts.', { pixels: num('default 1200') }, [], 'page');
  t('x_navigate', 'Navigate the tab to a path or full URL on x.com.', { url: str('e.g. /home, /explore, full https://x.com/...') }, ['url'], 'page');
  t('x_go_home', 'Go to home timeline.', {}, [], 'page');
  t('x_go_profile', 'Open a user profile.', { username: str('without @') }, ['username'], 'page');
  t('x_go_notifications', 'Open notifications.', {}, [], 'page');
  t('x_go_messages', 'Open DMs.', {}, [], 'page');
  t('x_go_explore', 'Open explore/search.', { query: str('optional search query') }, [], 'page');

  // ── Tweet actions (12) ─────────────────────────────────────
  t('x_like', 'Like a tweet by URL or first visible matching keyword.', { url: str('tweet URL'), keyword: str('or match visible text') }, [], 'page');
  t('x_unlike', 'Unlike a tweet by URL or visible match.', { url: str(), keyword: str() }, [], 'page');
  t('x_retweet', 'Retweet by URL or visible match.', { url: str(), keyword: str() }, [], 'page');
  t('x_unretweet', 'Undo retweet.', { url: str(), keyword: str() }, [], 'page');
  t('x_bookmark', 'Bookmark a tweet.', { url: str(), keyword: str() }, [], 'page');
  t('x_unbookmark', 'Remove bookmark.', { url: str(), keyword: str() }, [], 'page');
  t('x_reply', 'Open reply composer and type text (may need user confirm send).', { url: str(), keyword: str(), text: str('reply text') }, ['text'], 'page');
  t('x_quote_tweet', 'Open quote composer with commentary.', { url: str(), text: str() }, ['text'], 'page');
  t('x_post_tweet', 'Compose a new tweet (types into composer; clicks Post if possible).', { text: str() }, ['text'], 'page');
  t('x_post_thread', 'Start a multi-tweet thread in composer.', { tweets: str('tweets separated by ---') }, ['tweets'], 'page');
  t('x_delete_tweet', 'Delete own tweet via caret menu if on page.', { url: str() }, [], 'page');
  t('x_pin_tweet', 'Pin own tweet if available.', { url: str() }, [], 'page');

  // ── User actions (10) ──────────────────────────────────────
  t('x_follow', 'Follow a user by username or visible cell.', { username: str() }, [], 'page');
  t('x_unfollow', 'Unfollow a user.', { username: str() }, [], 'page');
  t('x_mute_user', 'Mute a user.', { username: str() }, ['username'], 'page');
  t('x_unmute_user', 'Unmute a user.', { username: str() }, ['username'], 'page');
  t('x_block_user', 'Block a user.', { username: str() }, ['username'], 'page');
  t('x_unblock_user', 'Unblock a user.', { username: str() }, ['username'], 'page');
  t('x_report_user', 'Open report flow for a user (may need user confirm).', { username: str() }, ['username'], 'page');
  t('x_open_user', 'Open user profile page.', { username: str() }, ['username'], 'page');
  t('x_get_user_card', 'Extract visible user card info.', { username: str() }, [], 'page');
  t('x_follow_visible', 'Follow first N visible Follow buttons.', { max: num('default 5'), dryRun: bool() }, [], 'page');

  // ── Read / scrape visible (15) ─────────────────────────────
  t('x_get_visible_tweets', 'List tweets currently in DOM.', { max: num('default 15') }, [], 'page');
  t('x_get_visible_users', 'List user cells currently visible.', { max: num() }, [], 'page');
  t('x_search_tweets', 'Navigate to search and collect results.', { query: str(), max: num() }, ['query'], 'page');
  t('x_get_trends', 'Read trending topics if on explore.', { max: num() }, [], 'page');
  t('x_get_notifications', 'Read visible notifications.', { max: num() }, [], 'page');
  t('x_get_profile_stats', 'Read followers/following/posts from profile page.', { username: str() }, [], 'page');
  t('x_get_tweet_detail', 'Open tweet and extract text/stats.', { url: str() }, [], 'page');
  t('x_get_replies_visible', 'Collect visible replies under a tweet.', { max: num() }, [], 'page');
  t('x_get_media_visible', 'Collect visible media URLs.', { max: num() }, [], 'page');
  t('x_get_likes_tab', 'Open Likes tab of a profile and list.', { username: str(), max: num() }, [], 'page');
  t('x_get_followers_visible', 'List visible followers (must be on followers page).', { max: num() }, [], 'page');
  t('x_get_following_visible', 'List visible following.', { max: num() }, [], 'page');
  t('x_get_bookmarks_visible', 'List visible bookmarks.', { max: num() }, [], 'page');
  t('x_get_lists_visible', 'List visible lists.', { max: num() }, [], 'page');
  t('x_extract_links', 'Extract external links from visible tweets.', { max: num() }, [], 'page');

  // ── Automations (15) ───────────────────────────────────────
  t('x_start_auto_like', 'START Auto-Liker automation for the user.', { keywords: str('comma-separated'), maxActions: num(), minDelay: num(), maxDelay: num() }, [], 'auto', { automationId: 'autoLiker' });
  t('x_start_smart_unfollow', 'START Smart Unfollow.', { maxActions: num(), dryRun: bool(), daysToWait: num(), whitelist: str() }, [], 'auto', { automationId: 'smartUnfollow' });
  t('x_start_keyword_follow', 'START Keyword Follow.', { keywords: str(), maxActions: num(), maxPerKeyword: num(), minFollowers: num() }, [], 'auto', { automationId: 'keywordFollow' });
  t('x_start_growth_suite', 'START Growth Suite (like+follow+unfollow).', { keywords: str(), maxLikes: num(), maxFollows: num(), maxUnfollows: num(), sessionMinutes: num() }, [], 'auto', { automationId: 'growthSuite' });
  t('x_start_auto_comment', 'START Auto-Commenter.', { comments: str('comma-separated templates'), keywords: str(), maxActions: num() }, [], 'auto', { automationId: 'autoCommenter' });
  t('x_start_follow_engagers', 'START Follow Engagers.', { mode: str('likers|retweeters'), maxActions: num(), minFollowers: num() }, [], 'auto', { automationId: 'followEngagers' });
  t('x_start_unfollower_detector', 'START Who Unfollowed Me scan.', {}, [], 'auto', { automationId: 'unfollowerDetector' });
  t('x_start_best_time', 'START Best Time to Post analysis.', { tweetCount: num() }, [], 'auto', { automationId: 'bestTimeToPost' });
  t('x_start_quick_stats', 'START Quick Stats overlay.', { sampleSize: num() }, [], 'auto', { automationId: 'quickStats' });
  t('x_start_video_downloader', 'Enable Video Downloader buttons.', { quality: str() }, [], 'auto', { automationId: 'videoDownloader' });
  t('x_start_thread_reader', 'Enable Thread Reader unroll.', {}, [], 'auto', { automationId: 'threadReader' });
  t('x_stop_automation', 'Stop one running automation.', { automationId: str() }, ['automationId'], 'auto');
  t('x_stop_all', 'Stop all running automations.', {}, [], 'auto');
  t('x_list_automations', 'List automations and running state.', {}, [], 'auto');
  t('x_automation_status', 'Status of a specific automation.', { automationId: str() }, ['automationId'], 'auto');

  // ── Control / safety (8) ───────────────────────────────────
  t('x_pause_all', 'Pause all automations.', {}, [], 'auto');
  t('x_resume_all', 'Resume paused automations.', {}, [], 'auto');
  t('x_get_running', 'List currently running automations with counts.', {}, [], 'auto');
  t('x_set_safety', 'Update safety caps (maxActionsPerTurn).', { maxActionsPerTurn: num() }, [], 'config');
  t('x_get_safety', 'Read safety limits.', {}, [], 'config');
  t('x_clear_agent_log', 'Clear agent chat history.', {}, [], 'config');
  t('x_export_activity_hint', 'Return how to export activity / current activity summary.', {}, [], 'config');
  t('x_open_following_page', 'Navigate to following list for unfollow tools.', { username: str() }, [], 'page');

  // ── AI content (12) ────────────────────────────────────────
  t('x_draft_tweet', 'Draft a tweet (does NOT post).', { topic: str(), style: str() }, ['topic'], 'llm');
  t('x_draft_reply', 'Draft a reply (does NOT post).', { author: str(), tweetText: str() }, ['author', 'tweetText'], 'llm');
  t('x_draft_thread', 'Draft a thread (does NOT post).', { topic: str(), parts: num('3-6') }, ['topic'], 'llm');
  t('x_rewrite_text', 'Rewrite text in persona voice.', { text: str(), style: str() }, ['text'], 'llm');
  t('x_summarize_feed', 'Summarize visible tweets (uses page + LLM).', { maxTweets: num() }, [], 'llm');
  t('x_analyze_sentiment_visible', 'Sentiment summary of visible tweets.', { maxTweets: num() }, [], 'llm');
  t('x_suggest_hashtags', 'Suggest hashtags for a topic/text.', { text: str() }, ['text'], 'llm');
  t('x_generate_variations', 'Generate tweet variations.', { text: str(), count: num() }, ['text'], 'llm');
  t('x_optimize_tweet', 'Optimize a draft for engagement.', { text: str() }, ['text'], 'llm');
  t('x_voice_match_check', 'Check if text matches persona voice.', { text: str() }, ['text'], 'llm');
  t('x_competitor_summary', 'Summarize competitor style from visible profile tweets.', { username: str() }, [], 'llm');
  t('x_niche_ideas', 'Generate content ideas for niche.', { niche: str(), count: num() }, [], 'llm');

  // ── Analytics visible (8) ──────────────────────────────────
  t('x_engagement_snapshot', 'Aggregate likes/RTs/replies from visible tweets.', { max: num() }, [], 'page');
  t('x_follower_ratio_visible', 'Parse follower/following counts on profile.', { username: str() }, [], 'page');
  t('x_top_tweets_visible', 'Rank visible tweets by engagement text.', { max: num() }, [], 'page');
  t('x_hashtag_frequency', 'Count hashtags in visible tweets.', { max: num() }, [], 'page');
  t('x_mention_frequency', 'Count @mentions in visible tweets.', { max: num() }, [], 'page');
  t('x_best_time_hint', 'Heuristic best-time hint from visible timestamps.', { max: num() }, [], 'page');
  t('x_bot_score_visible', 'Heuristic bot-likeness for visible users.', { max: num() }, [], 'page');
  t('x_link_domains', 'Top domains linked in visible tweets.', { max: num() }, [], 'page');

  // ── Lists / communities (6) ────────────────────────────────
  t('x_open_lists', 'Open lists page.', {}, [], 'page');
  t('x_open_communities', 'Open communities.', {}, [], 'page');
  t('x_open_bookmarks', 'Open bookmarks.', {}, [], 'page');
  t('x_open_settings', 'Open settings.', { path: str('optional subpath') }, [], 'page');
  t('x_open_messages_user', 'Open DM with a user if possible.', { username: str() }, ['username'], 'page');
  t('x_open_search_people', 'Search people tab.', { query: str() }, ['query'], 'page');

  // ── DM / social (4) ────────────────────────────────────────
  t('x_get_dm_preview', 'Preview visible DM conversation titles.', { max: num() }, [], 'page');
  t('x_compose_dm', 'Open DM compose and type message (send if possible).', { username: str(), message: str() }, ['username', 'message'], 'page');
  t('x_get_sidebar_account', 'Logged-in account from sidebar.', {}, [], 'page');
  t('x_refresh_page', 'Hard reload current page.', {}, [], 'page');

  // ── Persona / config ───────────────────────────────────────
  t('x_get_agent_config', 'Read persona and safety.', {}, [], 'config');
  t('x_update_persona', 'Update persona fields.', {
    name: str(),
    tone: str(),
    niche: str(),
    expertise: str('comma-separated'),
    avoid: str('comma-separated'),
  }, [], 'config');

  // One-shot matching + meta
  t('x_like_visible_matching', 'Like up to N visible tweets matching keywords (one-shot, not full automation).', { keywords: str(), max: num('default 5') }, [], 'page');
  t('x_retweet_visible_matching', 'Retweet up to N visible matching tweets.', { keywords: str(), max: num() }, [], 'page');
  t('x_bookmark_visible_matching', 'Bookmark up to N matching tweets.', { keywords: str(), max: num() }, [], 'page');
  t('x_copy_tweet_text', 'Get full text of a visible tweet.', { keyword: str(), url: str() }, [], 'page');
  t('x_wait', 'Wait milliseconds (rate-limit pacing).', { ms: num('100-10000') }, ['ms'], 'config');

  // Meta / discovery (agent self-help)
  t('x_list_tools', 'List available agent tools. Optional filter by kind: page|auto|llm|config or keyword in name/description.', {
    kind: str('page|auto|llm|config'),
    query: str('filter keyword'),
    limit: num('default 40'),
  }, [], 'config');
  t('x_describe_tool', 'Describe one tool by name (parameters + kind).', {
    name: str('tool name e.g. x_start_auto_like'),
  }, ['name'], 'config');
  t('x_ping_tab', 'Check that the x.com tab + content script are ready for page tools.', {}, [], 'config');

  const TOOL_DEFINITIONS = TOOLS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  const TOOL_META = Object.fromEntries(TOOLS.map((tool) => [tool.name, tool]));

  globalThis.XActionsCatalog = {
    TOOLS,
    TOOL_DEFINITIONS,
    TOOL_META,
    count: TOOLS.length,
  };
})();
