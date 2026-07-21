// XActions Extension — Injected Page Script
// Runs in the actual x.com page context (not content script sandbox)
// Has full access to the page DOM, same as pasting in console
// by nichxbt

(() => {
  if (window.__xactions_injected) return;
  window.__xactions_injected = true;

  // ============================================
  // CORE MODULE (from src/automation/core.js)
  // ============================================
  window.XActions = window.XActions || {};

  window.XActions.Core = (() => {
    const CONFIG = {
      DELAY_SHORT: 500,
      DELAY_MEDIUM: 1500,
      DELAY_LONG: 3000,
      DELAY_BETWEEN_ACTIONS: 2000,
      MAX_ACTIONS_PER_HOUR: 50,
      MAX_FOLLOWS_PER_DAY: 100,
      MAX_LIKES_PER_DAY: 200,
      STORAGE_PREFIX: 'xactions_',
      DEBUG: true,
    };

    const SELECTORS = {
      followButton: '[data-testid$="-follow"]',
      unfollowButton: '[data-testid$="-unfollow"]',
      likeButton: '[data-testid="like"]',
      unlikeButton: '[data-testid="unlike"]',
      retweetButton: '[data-testid="retweet"]',
      replyButton: '[data-testid="reply"]',
      confirmButton: '[data-testid="confirmationSheetConfirm"]',
      tweet: '[data-testid="tweet"]',
      tweetText: '[data-testid="tweetText"]',
      tweetLink: 'a[href*="/status/"]',
      userCell: '[data-testid="UserCell"]',
      userAvatar: '[data-testid="UserAvatar-Container"]',
      userName: '[data-testid="User-Name"]',
      userFollowIndicator: '[data-testid="userFollowIndicator"]',
      tweetInput: '[data-testid="tweetTextarea_0"]',
      searchInput: '[data-testid="SearchBox_Search_Input"]',
      primaryColumn: '[data-testid="primaryColumn"]',
      timeline: 'section[role="region"]',
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const randomDelay = (min, max) => {
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      return sleep(delay);
    };

    const log = (message, type = 'info') => {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = { info: '📘', success: '✅', warning: '⚠️', error: '❌', action: '🔧' }[type] || '📘';
      if (CONFIG.DEBUG || type === 'error') {
        console.log(`${prefix} [${timestamp}] ${message}`);
      }
      // Emit to extension
      notify('ACTION_PERFORMED', { action: `[${type}] ${message}` });
    };

    const scrollToBottom = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollBy = (pixels) => window.scrollBy({ top: pixels, behavior: 'smooth' });

    const storage = {
      get: (key) => { try { const d = localStorage.getItem(CONFIG.STORAGE_PREFIX + key); return d ? JSON.parse(d) : null; } catch { return null; } },
      set: (key, value) => { try { localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(value)); return true; } catch { return false; } },
      remove: (key) => localStorage.removeItem(CONFIG.STORAGE_PREFIX + key),
    };

    const waitForElement = async (selector, timeout = 10000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await sleep(100);
      }
      return null;
    };

    const waitForElements = async (selector, minCount = 1, timeout = 10000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const els = document.querySelectorAll(selector);
        if (els.length >= minCount) return Array.from(els);
        await sleep(100);
      }
      return [];
    };

    const clickElement = async (element) => {
      if (!element) return false;
      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        element.click();
        return true;
      } catch { return false; }
    };

    const typeText = async (element, text, delay = 50) => {
      if (!element) return false;
      try {
        element.focus();
        for (const char of text) {
          element.textContent += char;
          element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: char }));
          await sleep(delay);
        }
        return true;
      } catch { return false; }
    };

    const extractUsername = (element) => {
      const link = element.querySelector('a[href^="/"]');
      if (link) {
        const match = link.getAttribute('href').match(/^\/([^/]+)$/);
        if (match) return match[1].toLowerCase();
      }
      return null;
    };

    const extractTweetInfo = (tweetElement) => {
      try {
        const text = tweetElement.querySelector(SELECTORS.tweetText)?.textContent || '';
        const tweetLink = tweetElement.querySelector(SELECTORS.tweetLink)?.href || '';
        const userName = tweetElement.querySelector(SELECTORS.userName)?.textContent || '';
        return { text, tweetLink, userName };
      } catch { return null; }
    };

    const rateLimit = {
      check: (action, limit, period = 'hour') => {
        const key = `ratelimit_${action}_${period}`;
        const data = storage.get(key) || { count: 0, timestamp: Date.now() };
        const periodMs = period === 'hour' ? 3600000 : 86400000;
        if (Date.now() - data.timestamp > periodMs) { data.count = 0; data.timestamp = Date.now(); }
        return data.count < limit;
      },
      increment: (action, period = 'hour') => {
        const key = `ratelimit_${action}_${period}`;
        const data = storage.get(key) || { count: 0, timestamp: Date.now() };
        data.count++;
        storage.set(key, data);
      },
      getRemaining: (action, limit, period = 'hour') => {
        const key = `ratelimit_${action}_${period}`;
        const data = storage.get(key) || { count: 0, timestamp: Date.now() };
        return Math.max(0, limit - data.count);
      },
    };

    // Notify extension bridge
    function notify(type, data) {
      window.postMessage({ source: 'xactions-page', type, ...data }, '*');
    }

    return {
      CONFIG, SELECTORS, sleep, randomDelay, log,
      scrollToBottom, scrollToTop, scrollBy, storage,
      waitForElement, waitForElements, clickElement, typeText,
      extractUsername, extractTweetInfo, rateLimit, notify,
    };
  })();

  // ============================================
  // AUTOMATION REGISTRY
  // ============================================
  const automationRunners = {};
  const automationStopFlags = {};

  function registerAutomation(id, runFn) {
    automationRunners[id] = runFn;
  }

  // ============================================
  // AUTO-LIKER
  // ============================================
  registerAutomation('autoLiker', async (settings) => {
    const { log, sleep, randomDelay, scrollBy, clickElement, SELECTORS, storage, rateLimit } = window.XActions.Core;
    const opts = {
      LIKE_ALL: false,
      KEYWORDS: settings.keywords || [],
      MAX_LIKES: settings.maxActions || 20,
      MAX_SCROLL_DEPTH: 50,
      MIN_DELAY: settings.minDelay || 2000,
      MAX_DELAY: settings.maxDelay || 5000,
      SKIP_REPLIES: true,
      SKIP_ADS: true,
    };

    let likeCount = 0;
    let scrollCount = 0;
    const likedTweets = new Set(storage.get('liked_tweets') || []);

    const matchesKeywords = (text) => {
      if (opts.KEYWORDS.length === 0) return true;
      const lower = text.toLowerCase();
      return opts.KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
    };

    log(`🤍 Auto-Liker started (max: ${opts.MAX_LIKES}, keywords: ${opts.KEYWORDS.length ? opts.KEYWORDS.join(', ') : 'any'})`, 'info');

    while (likeCount < opts.MAX_LIKES && scrollCount < opts.MAX_SCROLL_DEPTH && !automationStopFlags['autoLiker']) {
      const tweets = document.querySelectorAll(SELECTORS.tweet);

      for (const tweet of tweets) {
        if (automationStopFlags['autoLiker']) break;
        if (likeCount >= opts.MAX_LIKES) break;
        if (!rateLimit.check('like', 200, 'day')) { log('⚠️ Daily like limit reached', 'warning'); return; }

        const tweetLink = tweet.querySelector(SELECTORS.tweetLink)?.href || '';
        const tweetId = tweetLink.match(/status\/(\d+)/)?.[1];
        if (!tweetId || likedTweets.has(tweetId)) continue;

        const text = tweet.querySelector(SELECTORS.tweetText)?.textContent || '';
        if (!matchesKeywords(text)) continue;

        // Skip ads
        if (opts.SKIP_ADS && (tweet.querySelector('[data-testid="placementTracking"]') || tweet.textContent?.includes('Promoted'))) continue;

        const likeBtn = tweet.querySelector(SELECTORS.likeButton);
        if (!likeBtn) continue;

        await clickElement(likeBtn);
        likeCount++;
        likedTweets.add(tweetId);
        rateLimit.increment('like', 'day');

        window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'autoLiker', action: `❤️ Liked tweet ${tweetId} (${likeCount}/${opts.MAX_LIKES})` }, '*');
        log(`❤️ Liked: "${text.substring(0, 50)}..." (${likeCount}/${opts.MAX_LIKES})`, 'success');

        await randomDelay(opts.MIN_DELAY, opts.MAX_DELAY);
      }

      scrollBy(800);
      scrollCount++;
      await sleep(1500);
    }

    storage.set('liked_tweets', Array.from(likedTweets));
    log(`✅ Auto-Liker done! Liked ${likeCount} tweets.`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'autoLiker', summary: `${likeCount} tweets liked` }, '*');
  });

  // ============================================
  // SMART UNFOLLOW
  // ============================================
  registerAutomation('smartUnfollow', async (settings) => {
    const { log, sleep, randomDelay, scrollBy, clickElement, waitForElement, storage, SELECTORS } = window.XActions.Core;
    const opts = {
      DAYS_TO_WAIT: settings.daysToWait || 3,
      MAX_UNFOLLOWS: settings.maxActions || 50,
      WHITELIST: settings.whitelist || [],
      DRY_RUN: settings.dryRun || false,
      DELAY_BETWEEN_UNFOLLOWS: settings.minDelay || 2000,
    };

    let unfollowCount = 0;

    log(`🔄 Smart Unfollow started (max: ${opts.MAX_UNFOLLOWS}, wait: ${opts.DAYS_TO_WAIT}d${opts.DRY_RUN ? ', DRY RUN' : ''})`, 'info');

    // Must be on following page
    const currentPath = window.location.pathname;
    if (!currentPath.endsWith('/following')) {
      log('⚠️ Navigate to your following page first (x.com/YOUR_USERNAME/following)', 'warning');
      window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_ERROR', automationId: 'smartUnfollow', error: 'Navigate to your following page first' }, '*');
      return;
    }

    while (unfollowCount < opts.MAX_UNFOLLOWS && !automationStopFlags['smartUnfollow']) {
      const cells = document.querySelectorAll(SELECTORS.userCell);
      if (cells.length === 0) {
        await sleep(2000);
        scrollBy(600);
        continue;
      }

      for (const cell of cells) {
        if (automationStopFlags['smartUnfollow']) break;
        if (unfollowCount >= opts.MAX_UNFOLLOWS) break;

        const userLink = cell.querySelector('a[href^="/"]');
        const username = userLink?.getAttribute('href')?.replace('/', '') || '';
        if (!username) continue;

        // Check whitelist
        if (opts.WHITELIST.some(w => w.toLowerCase() === username.toLowerCase())) continue;

        // Check if they follow back
        const followsYou = cell.querySelector(SELECTORS.userFollowIndicator);
        if (followsYou) continue; // They follow back, skip

        const unfollowBtn = cell.querySelector(SELECTORS.unfollowButton);
        if (!unfollowBtn) continue;

        if (opts.DRY_RUN) {
          log(`[DRY RUN] Would unfollow @${username}`, 'info');
        } else {
          await clickElement(unfollowBtn);
          await sleep(500);
          const confirmBtn = await waitForElement(SELECTORS.confirmButton, 3000);
          if (confirmBtn) await clickElement(confirmBtn);
        }

        unfollowCount++;
        window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'smartUnfollow', action: `👋 Unfollowed @${username} (${unfollowCount}/${opts.MAX_UNFOLLOWS})` }, '*');
        log(`👋 Unfollowed @${username} (${unfollowCount}/${opts.MAX_UNFOLLOWS})`, 'success');

        await randomDelay(opts.DELAY_BETWEEN_UNFOLLOWS, opts.DELAY_BETWEEN_UNFOLLOWS * 1.5);
      }

      scrollBy(600);
      await sleep(1500);
    }

    log(`✅ Smart Unfollow done! Unfollowed ${unfollowCount} users.`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'smartUnfollow', summary: `${unfollowCount} users unfollowed` }, '*');
  });

  // ============================================
  // KEYWORD FOLLOW
  // ============================================
  registerAutomation('keywordFollow', async (settings) => {
    const { log, sleep, randomDelay, scrollBy, clickElement, waitForElement, storage, rateLimit, SELECTORS } = window.XActions.Core;
    const opts = {
      KEYWORDS: settings.keywords || ['web3', 'crypto'],
      MAX_FOLLOWS_PER_KEYWORD: settings.maxPerKeyword || 10,
      MAX_FOLLOWS_TOTAL: settings.maxActions || 30,
      MIN_FOLLOWERS: settings.minFollowers || 100,
      MAX_FOLLOWERS: settings.maxFollowers || 100000,
      MUST_HAVE_BIO: settings.mustHaveBio || false,
      DELAY_BETWEEN_FOLLOWS: settings.minDelay || 3000,
    };

    let followCount = 0;
    const followedUsers = new Map(Object.entries(storage.get('followed_users') || {}));

    const saveFollowedUser = (username) => {
      followedUsers.set(username.toLowerCase(), { followedAt: Date.now(), followedBack: false });
      storage.set('followed_users', Object.fromEntries(followedUsers));
    };

    log(`🔍 Keyword Follow started (keywords: ${opts.KEYWORDS.join(', ')}, max: ${opts.MAX_FOLLOWS_TOTAL})`, 'info');

    for (const keyword of opts.KEYWORDS) {
      if (followCount >= opts.MAX_FOLLOWS_TOTAL || automationStopFlags['keywordFollow']) break;

      const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=user`;
      window.location.href = searchUrl;
      await sleep(3000);
      await waitForElement(SELECTORS.userCell, 10000);
      await sleep(1000);

      let keywordFollows = 0;
      let scrollAttempts = 0;

      while (keywordFollows < opts.MAX_FOLLOWS_PER_KEYWORD && followCount < opts.MAX_FOLLOWS_TOTAL && scrollAttempts < 20 && !automationStopFlags['keywordFollow']) {
        const cells = document.querySelectorAll(SELECTORS.userCell);

        for (const cell of cells) {
          if (automationStopFlags['keywordFollow']) break;
          if (keywordFollows >= opts.MAX_FOLLOWS_PER_KEYWORD || followCount >= opts.MAX_FOLLOWS_TOTAL) break;
          if (!rateLimit.check('follow', 100, 'day')) { log('⚠️ Daily follow limit reached', 'warning'); return; }

          const userLink = cell.querySelector('a[href^="/"]');
          const username = userLink?.getAttribute('href')?.replace('/', '') || '';
          if (!username || followedUsers.has(username.toLowerCase())) continue;

          // Check for follow button (not already following)
          const followBtn = cell.querySelector(SELECTORS.followButton);
          if (!followBtn) continue;

          await clickElement(followBtn);
          followCount++;
          keywordFollows++;
          rateLimit.increment('follow', 'day');
          saveFollowedUser(username);

          window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'keywordFollow', action: `➕ Followed @${username} for "${keyword}" (${followCount}/${opts.MAX_FOLLOWS_TOTAL})` }, '*');
          log(`➕ Followed @${username} (${followCount}/${opts.MAX_FOLLOWS_TOTAL})`, 'success');

          await randomDelay(opts.DELAY_BETWEEN_FOLLOWS, opts.DELAY_BETWEEN_FOLLOWS * 1.5);
        }

        scrollBy(600);
        scrollAttempts++;
        await sleep(1500);
      }
    }

    log(`✅ Keyword Follow done! Followed ${followCount} users.`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'keywordFollow', summary: `${followCount} users followed` }, '*');
  });

  // ============================================
  // FOLLOW ENGAGERS
  // ============================================
  registerAutomation('followEngagers', async (settings) => {
    const { log, sleep, randomDelay, scrollBy, clickElement, waitForElement, storage, rateLimit, SELECTORS } = window.XActions.Core;
    const opts = {
      MODE: settings.mode || 'likers',
      MAX_FOLLOWS: settings.maxActions || 30,
      MIN_FOLLOWERS: settings.minFollowers || 50,
      DELAY_BETWEEN_FOLLOWS: settings.minDelay || 3000,
    };

    let followCount = 0;

    log(`👥 Follow Engagers started (mode: ${opts.MODE}, max: ${opts.MAX_FOLLOWS})`, 'info');

    // Must be on a tweet page
    if (!window.location.pathname.includes('/status/')) {
      log('⚠️ Navigate to a specific tweet first', 'warning');
      window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_ERROR', automationId: 'followEngagers', error: 'Navigate to a specific tweet first' }, '*');
      return;
    }

    // Click on likes to open likers panel
    const likesLink = document.querySelector('a[href$="/likes"]');
    if (likesLink) {
      await clickElement(likesLink);
      await sleep(2000);
    }

    let scrollAttempts = 0;
    while (followCount < opts.MAX_FOLLOWS && scrollAttempts < 30 && !automationStopFlags['followEngagers']) {
      const cells = document.querySelectorAll(SELECTORS.userCell);

      for (const cell of cells) {
        if (automationStopFlags['followEngagers']) break;
        if (followCount >= opts.MAX_FOLLOWS) break;
        if (!rateLimit.check('follow', 100, 'day')) { log('⚠️ Daily follow limit reached', 'warning'); return; }

        const followBtn = cell.querySelector(SELECTORS.followButton);
        if (!followBtn) continue;

        const userLink = cell.querySelector('a[href^="/"]');
        const username = userLink?.getAttribute('href')?.replace('/', '') || 'unknown';

        await clickElement(followBtn);
        followCount++;
        rateLimit.increment('follow', 'day');

        window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'followEngagers', action: `➕ Followed @${username} (${followCount}/${opts.MAX_FOLLOWS})` }, '*');
        log(`➕ Followed engager @${username} (${followCount}/${opts.MAX_FOLLOWS})`, 'success');

        await randomDelay(opts.DELAY_BETWEEN_FOLLOWS, opts.DELAY_BETWEEN_FOLLOWS * 1.5);
      }

      scrollBy(600);
      scrollAttempts++;
      await sleep(1500);
    }

    log(`✅ Follow Engagers done! Followed ${followCount} users.`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'followEngagers', summary: `${followCount} engagers followed` }, '*');
  });

  // ============================================
  // AUTO-COMMENTER
  // ============================================
  registerAutomation('autoCommenter', async (settings) => {
    const { log, sleep, randomDelay, scrollToTop, clickElement, waitForElement, storage, SELECTORS } = window.XActions.Core;
    const opts = {
      COMMENTS: settings.comments || ['🔥', 'Great point!', 'Interesting take!', 'Love this!', '💯'],
      CHECK_INTERVAL_SECONDS: settings.checkInterval || 60,
      MAX_COMMENTS: settings.maxActions || 5,
      ONLY_ORIGINAL_TWEETS: true,
      KEYWORDS: settings.keywords || [],
    };

    let commentCount = 0;
    let checkCount = 0;
    const commentedTweets = new Set(storage.get('commented_tweets') || []);

    const getRandomComment = () => opts.COMMENTS[Math.floor(Math.random() * opts.COMMENTS.length)];

    log(`💬 Auto-Commenter started (max: ${opts.MAX_COMMENTS}, interval: ${opts.CHECK_INTERVAL_SECONDS}s)`, 'info');

    while (commentCount < opts.MAX_COMMENTS && !automationStopFlags['autoCommenter']) {
      checkCount++;
      scrollToTop();
      await sleep(2000);

      const tweets = document.querySelectorAll(SELECTORS.tweet);

      for (const tweet of tweets) {
        if (automationStopFlags['autoCommenter']) break;
        if (commentCount >= opts.MAX_COMMENTS) break;

        const tweetLink = tweet.querySelector(SELECTORS.tweetLink)?.href || '';
        const tweetId = tweetLink.match(/status\/(\d+)/)?.[1];
        if (!tweetId || commentedTweets.has(tweetId)) continue;

        const text = tweet.querySelector(SELECTORS.tweetText)?.textContent || '';
        if (opts.KEYWORDS.length > 0 && !opts.KEYWORDS.some(kw => text.toLowerCase().includes(kw.toLowerCase()))) continue;

        // Click reply button
        const replyBtn = tweet.querySelector(SELECTORS.replyButton);
        if (!replyBtn) continue;

        await clickElement(replyBtn);
        await sleep(1500);

        // Type comment
        const replyBox = await waitForElement(SELECTORS.tweetInput, 5000);
        if (!replyBox) continue;

        const comment = getRandomComment();
        replyBox.focus();
        document.execCommand('insertText', false, comment);
        await sleep(500);

        // Find and click the reply submit button
        const submitBtn = document.querySelector('[data-testid="tweetButtonInline"]') || document.querySelector('[data-testid="tweetButton"]');
        if (submitBtn) {
          await clickElement(submitBtn);
          commentCount++;
          commentedTweets.add(tweetId);
          storage.set('commented_tweets', Array.from(commentedTweets));

          window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'autoCommenter', action: `💬 Commented "${comment}" on tweet ${tweetId} (${commentCount}/${opts.MAX_COMMENTS})` }, '*');
          log(`💬 Commented on tweet: "${comment}" (${commentCount}/${opts.MAX_COMMENTS})`, 'success');
        }

        await randomDelay(3000, 6000);
      }

      if (commentCount < opts.MAX_COMMENTS && !automationStopFlags['autoCommenter']) {
        log(`⏱️ Check ${checkCount} done. Waiting ${opts.CHECK_INTERVAL_SECONDS}s...`, 'info');
        await sleep(opts.CHECK_INTERVAL_SECONDS * 1000);
      }
    }

    log(`✅ Auto-Commenter done! Posted ${commentCount} comments.`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'autoCommenter', summary: `${commentCount} comments posted` }, '*');
  });

  // ============================================
  // GROWTH SUITE
  // ============================================
  registerAutomation('growthSuite', async (settings) => {
    const { log, sleep, randomDelay, scrollBy, clickElement, waitForElement, storage, rateLimit, SELECTORS } = window.XActions.Core;
    const opts = {
      KEYWORDS: settings.keywords || ['web3', 'crypto', 'AI'],
      enableFollow: settings.enableFollow !== false,
      enableLike: settings.enableLike !== false,
      enableUnfollow: settings.enableUnfollow !== false,
      maxFollows: settings.maxFollows || 20,
      maxLikes: settings.maxLikes || 30,
      maxUnfollows: settings.maxUnfollows || 15,
      UNFOLLOW_AFTER_DAYS: settings.daysToWait || 3,
      SESSION_DURATION_MINUTES: settings.sessionMinutes || 30,
      DELAY: settings.minDelay || 3000,
    };

    const endTime = Date.now() + opts.SESSION_DURATION_MINUTES * 60 * 1000;
    const state = { follows: 0, likes: 0, unfollows: 0 };

    log(`🚀 Growth Suite started! Session: ${opts.SESSION_DURATION_MINUTES}min`, 'info');
    log(`   Follow: ${opts.enableFollow}, Like: ${opts.enableLike}, Unfollow: ${opts.enableUnfollow}`, 'info');

    // Phase 1: Like tweets in feed
    if (opts.enableLike && !automationStopFlags['growthSuite']) {
      log('📌 Phase 1: Liking tweets in feed...', 'action');
      let scrolls = 0;
      while (state.likes < opts.maxLikes && scrolls < 30 && Date.now() < endTime && !automationStopFlags['growthSuite']) {
        const tweets = document.querySelectorAll(SELECTORS.tweet);
        for (const tweet of tweets) {
          if (automationStopFlags['growthSuite'] || state.likes >= opts.maxLikes || Date.now() >= endTime) break;
          const text = tweet.querySelector(SELECTORS.tweetText)?.textContent || '';
          if (opts.KEYWORDS.length > 0 && !opts.KEYWORDS.some(kw => text.toLowerCase().includes(kw.toLowerCase()))) continue;
          const likeBtn = tweet.querySelector(SELECTORS.likeButton);
          if (!likeBtn) continue;
          await clickElement(likeBtn);
          state.likes++;
          window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'growthSuite', action: `❤️ Liked tweet (${state.likes}/${opts.maxLikes})` }, '*');
          await randomDelay(opts.DELAY, opts.DELAY * 1.5);
        }
        scrollBy(600);
        scrolls++;
        await sleep(1500);
      }
    }

    log(`✅ Growth Suite done! Likes: ${state.likes}, Follows: ${state.follows}, Unfollows: ${state.unfollows}`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'growthSuite', summary: `${state.likes} likes, ${state.follows} follows, ${state.unfollows} unfollows` }, '*');
  });

  // ============================================
  // ACCOUNT INFO SCRAPER
  // ============================================
  /**
   * Logged-in account — never trust bare pathname (home/explore/… are not handles).
   */
  function scrapeAccountInfo() {
    const RESERVED = new Set([
      'home', 'explore', 'search', 'notifications', 'messages', 'i', 'settings',
      'compose', 'login', 'logout', 'signup', 'tos', 'privacy', 'jobs', 'about',
      'following', 'followers', 'lists', 'communities', 'bookmarks', 'premium',
    ]);

    try {
      let handle = '';
      let name = '';
      let avatar = '';

      // 1) Account switcher (most reliable for logged-in user)
      const switcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      if (switcher) {
        const txt = switcher.innerText || switcher.textContent || '';
        const m = txt.match(/@([A-Za-z0-9_]{1,15})/);
        if (m) handle = m[1];
        const lines = txt.split('\n').map((s) => s.trim()).filter(Boolean);
        name = lines.find((l) => !l.startsWith('@')) || lines[0] || '';
        avatar = switcher.querySelector('img')?.src || '';
      }

      // 2) Profile page self — UserName block
      if (!handle) {
        const userName = document.querySelector('[data-testid="UserName"]');
        if (userName) {
          const m = (userName.innerText || '').match(/@([A-Za-z0-9_]{1,15})/);
          if (m) handle = m[1];
          name = name || (userName.innerText || '').split('\n')[0] || '';
        }
      }

      // 3) Profile link in left nav (a[href="/handle"] with avatar)
      if (!handle) {
        const navLinks = document.querySelectorAll('nav a[href^="/"], header a[href^="/"]');
        for (const a of navLinks) {
          const href = a.getAttribute('href') || '';
          const m = href.match(/^\/([A-Za-z0-9_]{1,15})$/);
          if (!m || RESERVED.has(m[1].toLowerCase())) continue;
          if (a.querySelector('img') || /profile/i.test(a.getAttribute('aria-label') || '')) {
            handle = m[1];
            break;
          }
        }
      }

      // 4) Pathname only if looks like a real profile path
      if (!handle) {
        const seg = (location.pathname.split('/')[1] || '').replace(/^@/, '');
        if (seg && !RESERVED.has(seg.toLowerCase()) && /^[A-Za-z0-9_]{1,15}$/.test(seg)) {
          handle = seg;
        }
      }

      if (!avatar) {
        avatar =
          document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"] img')?.src ||
          document.querySelector('a[href*="/photo"] img')?.src ||
          '';
      }
      if (!name) {
        name =
          document.querySelector('[data-testid="UserName"] span')?.textContent ||
          handle ||
          'Unknown';
      }

      return {
        name,
        avatar,
        handle: handle || '',
        url: location.href,
        path: location.pathname,
      };
    } catch {
      return { name: 'Unknown', avatar: '', handle: '', url: location.href, path: location.pathname };
    }
  }

  // ============================================
  // MESSAGE LISTENER (from content script bridge)
  // ============================================
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'xactions-extension') return;

    const msg = event.data;

    switch (msg.type) {
      case 'RUN_AUTOMATION': {
        const runner = automationRunners[msg.automationId];
        if (runner) {
          automationStopFlags[msg.automationId] = false;
          try {
            await runner(msg.settings || {});
          } catch (err) {
            console.error(`XActions automation error (${msg.automationId}):`, err);
            window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_ERROR', automationId: msg.automationId, error: err.message }, '*');
          }
        }
        break;
      }

      case 'STOP_AUTOMATION':
        automationStopFlags[msg.automationId] = true;
        break;

      case 'STOP_ALL':
      case 'PAUSE_ALL':
        Object.keys(automationStopFlags).forEach(k => automationStopFlags[k] = true);
        Object.keys(automationRunners).forEach(k => automationStopFlags[k] = true);
        break;

      case 'RESUME_ALL':
        // Resuming would need re-running, handled by popup
        break;

      case 'GET_ACCOUNT_INFO':
        window.postMessage({ source: 'xactions-page', type: 'ACCOUNT_INFO', data: scrapeAccountInfo() }, '*');
        break;

      case 'AGENT_TOOL': {
        const requestId = msg.requestId;
        let result;
        try {
          result = await runAgentPageTool(msg.tool, msg.args || {});
        } catch (err) {
          result = { error: err.message || String(err) };
        }
        window.postMessage(
          {
            source: 'xactions-page',
            type: 'AGENT_TOOL_RESULT',
            requestId,
            result,
          },
          '*',
        );
        break;
      }
    }
  });

  // ============================================
  // AGENT PAGE TOOLS (~70 DOM tools for AI)
  // ============================================
  async function runAgentPageTool(tool, args) {
    const core = window.XActions.Core;
    const { sleep, SELECTORS, clickElement, waitForElement, typeText, extractUsername } = core;
    const a = args || {};

    // Normalize legacy short names
    const aliases = {
      scroll_timeline: 'x_scroll_timeline',
      get_page_context: 'x_get_page_context',
    };
    const name = aliases[tool] || tool;

    // ── helpers ──────────────────────────────────────────
    function parseCount(txt) {
      if (!txt) return 0;
      const s = String(txt).replace(/,/g, '').trim();
      const m = s.match(/([\d.]+)\s*([KkMmBb])?/);
      if (!m) return parseInt(s, 10) || 0;
      let n = parseFloat(m[1]);
      const u = (m[2] || '').toUpperCase();
      if (u === 'K') n *= 1e3;
      if (u === 'M') n *= 1e6;
      if (u === 'B') n *= 1e9;
      return Math.round(n);
    }

    function authorFromTweet(el) {
      const nameBlock = el.querySelector(SELECTORS.userName);
      if (!nameBlock) return 'unknown';
      const handles = Array.from(nameBlock.querySelectorAll('a[href^="/"]'))
        .map((x) => x.getAttribute('href')?.replace(/^\//, ''))
        .filter((h) => h && !h.includes('/'));
      return handles[0] || 'unknown';
    }

    function tweetUrl(el) {
      return (
        el.querySelector(SELECTORS.tweetLink)?.href ||
        el.querySelector('a[href*="/status/"]')?.href ||
        ''
      );
    }

    function collectTweets(max = 15) {
      const out = [];
      for (const el of document.querySelectorAll(SELECTORS.tweet)) {
        if (out.length >= max) break;
        const text = el.querySelector(SELECTORS.tweetText)?.innerText?.trim() || '';
        if (!text) continue;
        const stats = {};
        const group = el.querySelector('[role="group"]');
        if (group) {
          const aria = group.getAttribute('aria-label') || '';
          const likes = aria.match(/([\d,.]+[KkMmBb]?)\s*like/i);
          const rts = aria.match(/([\d,.]+[KkMmBb]?)\s*repost/i);
          const replies = aria.match(/([\d,.]+[KkMmBb]?)\s*repl/i);
          if (likes) stats.likes = parseCount(likes[1]);
          if (rts) stats.retweets = parseCount(rts[1]);
          if (replies) stats.replies = parseCount(replies[1]);
        }
        const timeEl = el.querySelector('time');
        out.push({
          author: authorFromTweet(el),
          text: text.slice(0, 800),
          url: tweetUrl(el),
          time: timeEl?.getAttribute('datetime') || timeEl?.textContent || '',
          stats,
          el,
        });
      }
      return out;
    }

    function collectUsers(max = 20) {
      const out = [];
      for (const cell of document.querySelectorAll(SELECTORS.userCell)) {
        if (out.length >= max) break;
        const username = extractUsername(cell);
        if (!username) continue;
        const display =
          cell.querySelector(SELECTORS.userName)?.innerText?.split('\n')[0] || username;
        const bio = cell.querySelector('[data-testid="UserDescription"]')?.innerText || '';
        const followsYou = !!cell.querySelector(SELECTORS.userFollowIndicator);
        const canFollow = !!cell.querySelector(SELECTORS.followButton);
        const canUnfollow = !!cell.querySelector(SELECTORS.unfollowButton);
        out.push({
          username,
          display: display.slice(0, 80),
          bio: bio.slice(0, 200),
          followsYou,
          canFollow,
          canUnfollow,
          el: cell,
        });
      }
      return out;
    }

    function findTweet(url, keyword) {
      const tweets = collectTweets(40);
      if (url) {
        const hit = tweets.find((t) => t.url && t.url.includes(url.replace(/https?:\/\/(www\.)?x\.com/, '').replace(/https?:\/\/(www\.)?twitter\.com/, '')));
        if (hit) return hit;
        const byId = url.match(/status\/(\d+)/)?.[1];
        if (byId) {
          const h2 = tweets.find((t) => t.url?.includes(byId));
          if (h2) return h2;
        }
      }
      if (keyword) {
        const kw = String(keyword).toLowerCase();
        return tweets.find((t) => t.text.toLowerCase().includes(kw));
      }
      return tweets[0] || null;
    }

    /**
     * Soft navigate on X SPA without killing the page (hard location.href would
     * drop AGENT_TOOL_RESULT). Prefer link click → history push → last resort assign.
     */
    async function go(pathOrUrl) {
      let url = pathOrUrl;
      if (!url) return { error: 'url required' };
      if (url.startsWith('/')) url = `https://x.com${url}`;
      if (!/^https?:\/\//i.test(url)) url = `https://x.com/${url.replace(/^@/, '')}`;

      let path = '/';
      let search = '';
      try {
        const u = new URL(url);
        path = u.pathname || '/';
        search = u.search || '';
      } catch {
        return { error: 'bad url', url };
      }

      const target = path + search;
      const here = location.pathname + location.search;
      if (here === target || location.href.replace(/\/$/, '') === url.replace(/\/$/, '')) {
        return { url: location.href, navigated: false, method: 'noop' };
      }

      // 1) Click existing SPA link
      const candidates = [
        `a[href="${target}"]`,
        `a[href="${path}"]`,
        `a[href^="${path}?"]`,
      ];
      for (const sel of candidates) {
        const link = document.querySelector(sel);
        if (link) {
          link.click();
          await sleep(1400);
          return { url: location.href, navigated: true, method: 'link' };
        }
      }

      // 2) Synthetic anchor click (X often intercepts)
      try {
        const aEl = document.createElement('a');
        aEl.href = target;
        aEl.style.display = 'none';
        document.body.appendChild(aEl);
        aEl.click();
        aEl.remove();
        await sleep(1600);
        if (location.pathname + location.search === target || location.pathname === path) {
          return { url: location.href, navigated: true, method: 'synthetic_a' };
        }
      } catch {
        /* continue */
      }

      // 3) history API + popstate (best-effort SPA)
      try {
        window.history.pushState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        await sleep(1200);
        if (location.pathname === path) {
          return { url: location.href, navigated: true, method: 'history' };
        }
      } catch {
        /* continue */
      }

      // 4) Hard nav — reply first via microtask is impossible after unload;
      // prefer staying put and reporting need for SW nav tools.
      return {
        url: location.href,
        navigated: false,
        method: 'failed_soft',
        error: 'SPA soft-nav failed — use x_navigate / x_go_* (service worker nav)',
        wanted: url,
      };
    }

    async function clickTweetAction(tweet, testidWant, testidAlt) {
      if (!tweet?.el) return false;
      const btn =
        tweet.el.querySelector(`[data-testid="${testidWant}"]`) ||
        (testidAlt ? tweet.el.querySelector(`[data-testid="${testidAlt}"]`) : null);
      if (!btn) return false;
      await clickElement(btn);
      await sleep(600);
      // confirm sheet for RT etc.
      const confirm = document.querySelector(SELECTORS.confirmButton);
      if (confirm) {
        await clickElement(confirm);
        await sleep(400);
      }
      return true;
    }

    async function typeIntoComposer(text) {
      let box =
        document.querySelector(SELECTORS.tweetInput) ||
        document.querySelector('[data-testid="tweetTextarea_0"]') ||
        document.querySelector('[contenteditable="true"][data-testid^="tweetTextarea"]');
      if (!box) {
        // open compose
        const compose =
          document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
          document.querySelector('a[href="/compose/post"]') ||
          document.querySelector('a[href="/compose/tweet"]');
        if (compose) {
          await clickElement(compose);
          await sleep(800);
        }
        box =
          (await waitForElement(SELECTORS.tweetInput, 5000)) ||
          document.querySelector('[contenteditable="true"][role="textbox"]');
      }
      if (!box) return { ok: false, error: 'composer not found' };

      box.focus();
      // Draft.js / Lexical-friendly: select all + insert
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      await sleep(400);
      return { ok: true, box };
    }

    async function clickPostIfPossible() {
      const btn =
        document.querySelector('[data-testid="tweetButtonInline"]') ||
        document.querySelector('[data-testid="tweetButton"]');
      if (!btn || btn.getAttribute('aria-disabled') === 'true' || btn.disabled) {
        return { posted: false, reason: 'Post button disabled or missing' };
      }
      await clickElement(btn);
      await sleep(1200);
      return { posted: true };
    }

    function matchKeywords(text, keywords) {
      if (!keywords || !keywords.length) return true;
      const lower = text.toLowerCase();
      return keywords.some((k) => lower.includes(String(k).toLowerCase()));
    }

    function splitKw(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(String);
      return String(val)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // ── dispatch ─────────────────────────────────────────
    switch (name) {
      // Navigation
      case 'x_scroll_timeline': {
        const px = Math.min(Math.max(Number(a.pixels) || 1200, 200), 4000);
        window.scrollBy({ top: px, behavior: 'smooth' });
        await sleep(800);
        return { scrolled: px, y: window.scrollY };
      }
      case 'x_get_page_context': {
        const maxTweets = Math.min(Math.max(Number(a.maxTweets) || 8, 1), 20);
        const tweets = collectTweets(maxTweets).map(({ el, ...rest }) => rest);
        return {
          url: location.href,
          path: location.pathname,
          title: document.title,
          account: scrapeAccountInfo(),
          visibleTweetCount: tweets.length,
          tweets,
        };
      }
      case 'x_navigate':
        return go(a.url);
      case 'x_go_home':
        return go('/home');
      case 'x_go_profile':
        return go(`/${String(a.username || '').replace(/^@/, '')}`);
      case 'x_go_notifications':
        return go('/notifications');
      case 'x_go_messages':
        return go('/messages');
      case 'x_go_explore': {
        if (a.query) return go(`/search?q=${encodeURIComponent(a.query)}&src=typed_query`);
        return go('/explore');
      }
      case 'x_open_following_page': {
        const u = String(a.username || scrapeAccountInfo().handle || '').replace(/^@/, '');
        if (!u) return { error: 'username required' };
        return go(`/${u}/following`);
      }
      case 'x_open_lists':
        return go('/i/lists');
      case 'x_open_communities':
        return go('/i/communities');
      case 'x_open_bookmarks':
        return go('/i/bookmarks');
      case 'x_open_settings':
        return go(a.path ? `/settings/${a.path.replace(/^\//, '')}` : '/settings');
      case 'x_open_search_people':
        return go(`/search?q=${encodeURIComponent(a.query || '')}&f=user`);
      case 'x_open_user':
        return go(`/${String(a.username || '').replace(/^@/, '')}`);
      case 'x_refresh_page':
        // Hard reload kills this script — SW owns x_refresh_page.
        return {
          reloading: false,
          note: 'Handled by service worker via chrome.tabs.reload',
        };

      // Tweet actions
      case 'x_like': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const ok = await clickTweetAction(t, 'like');
        return { success: ok, url: t.url, author: t.author };
      }
      case 'x_unlike': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const ok = await clickTweetAction(t, 'unlike');
        return { success: ok, url: t.url };
      }
      case 'x_retweet': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const ok = await clickTweetAction(t, 'retweet');
        // menu item
        const menuRt = document.querySelector('[data-testid="retweetConfirm"]');
        if (menuRt) {
          await clickElement(menuRt);
          await sleep(400);
        }
        return { success: ok, url: t.url };
      }
      case 'x_unretweet': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const ok = await clickTweetAction(t, 'unretweet');
        const menu = document.querySelector('[data-testid="unretweetConfirm"]');
        if (menu) {
          await clickElement(menu);
          await sleep(400);
        }
        return { success: ok, url: t.url };
      }
      case 'x_bookmark': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const ok = await clickTweetAction(t, 'bookmark');
        return { success: ok, url: t.url };
      }
      case 'x_unbookmark': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const ok =
          (await clickTweetAction(t, 'removeBookmark')) ||
          (await clickTweetAction(t, 'bookmark'));
        return { success: ok, url: t.url };
      }
      case 'x_reply': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const replyBtn = t.el.querySelector(SELECTORS.replyButton);
        if (!replyBtn) return { success: false, error: 'reply button missing' };
        await clickElement(replyBtn);
        await sleep(700);
        const typed = await typeIntoComposer(a.text || '');
        if (!typed.ok) return typed;
        const post = await clickPostIfPossible();
        return { success: true, url: t.url, ...post, text: a.text };
      }
      case 'x_quote_tweet': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        await clickTweetAction(t, 'retweet');
        await sleep(400);
        const quote = document.querySelector('[data-testid="Dropdown"] [href*="quote"]') ||
          Array.from(document.querySelectorAll('[role="menuitem"]')).find((el) =>
            /quote/i.test(el.textContent || ''),
          );
        if (quote) await clickElement(quote);
        await sleep(700);
        const typed = await typeIntoComposer(a.text || '');
        if (!typed.ok) return typed;
        const post = await clickPostIfPossible();
        return { success: true, url: t.url, ...post };
      }
      case 'x_post_tweet': {
        const typed = await typeIntoComposer(a.text || '');
        if (!typed.ok) return typed;
        const post = await clickPostIfPossible();
        return { success: true, text: a.text, ...post };
      }
      case 'x_post_thread': {
        const parts = String(a.tweets || '')
          .split(/\n*---\n*/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (!parts.length) return { error: 'no tweets' };
        const typed = await typeIntoComposer(parts[0]);
        if (!typed.ok) return typed;
        // add more if UI allows
        for (let i = 1; i < parts.length; i++) {
          const add =
            document.querySelector('[data-testid="addButton"]') ||
            document.querySelector('[aria-label*="Add"]');
          if (add) {
            await clickElement(add);
            await sleep(500);
            await typeIntoComposer(parts[i]);
          }
        }
        const post = await clickPostIfPossible();
        return { success: true, parts: parts.length, ...post };
      }
      case 'x_delete_tweet': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const caret = t.el.querySelector('[data-testid="caret"]');
        if (!caret) return { success: false, error: 'caret menu not found' };
        await clickElement(caret);
        await sleep(500);
        const del = Array.from(document.querySelectorAll('[role="menuitem"]')).find((el) =>
          /delete/i.test(el.textContent || ''),
        );
        if (!del) return { success: false, error: 'Delete not in menu (not your tweet?)' };
        await clickElement(del);
        await sleep(400);
        const conf = document.querySelector(SELECTORS.confirmButton);
        if (conf) await clickElement(conf);
        return { success: true, url: t.url };
      }
      case 'x_pin_tweet': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { success: false, error: 'tweet not found' };
        const caret = t.el.querySelector('[data-testid="caret"]');
        if (!caret) return { success: false, error: 'caret not found' };
        await clickElement(caret);
        await sleep(500);
        const pin = Array.from(document.querySelectorAll('[role="menuitem"]')).find((el) =>
          /pin/i.test(el.textContent || ''),
        );
        if (!pin) return { success: false, error: 'Pin not available' };
        await clickElement(pin);
        return { success: true, url: t.url };
      }

      // User actions
      case 'x_follow':
      case 'x_unfollow': {
        const uname = String(a.username || '').replace(/^@/, '').toLowerCase();
        // try user cells first
        const users = collectUsers(40);
        let cell = uname ? users.find((u) => u.username === uname) : users.find((u) => u.canFollow || u.canUnfollow);
        if (!cell && uname) {
          await go(`/${uname}`);
          await sleep(1200);
        }
        const wantFollow = name === 'x_follow';
        let btn = null;
        if (cell?.el) {
          btn = wantFollow
            ? cell.el.querySelector(SELECTORS.followButton)
            : cell.el.querySelector(SELECTORS.unfollowButton);
        }
        if (!btn) {
          // profile page button
          btn = wantFollow
            ? document.querySelector('[data-testid$="-follow"]')
            : document.querySelector('[data-testid$="-unfollow"]');
        }
        if (!btn) return { success: false, error: 'follow/unfollow button not found', username: uname };
        await clickElement(btn);
        await sleep(500);
        if (!wantFollow) {
          const conf = await waitForElement(SELECTORS.confirmButton, 2000);
          if (conf) await clickElement(conf);
        }
        return { success: true, action: wantFollow ? 'follow' : 'unfollow', username: uname };
      }
      case 'x_mute_user':
      case 'x_block_user':
      case 'x_unmute_user':
      case 'x_unblock_user':
      case 'x_report_user': {
        const uname = String(a.username || '').replace(/^@/, '');
        if (!uname) return { error: 'username required' };
        await go(`/${uname}`);
        await sleep(1000);
        const more =
          document.querySelector('[data-testid="userActions"]') ||
          document.querySelector('[aria-label*="More"]');
        if (!more) return { success: false, error: 'user menu not found' };
        await clickElement(more);
        await sleep(500);
        const labelMap = {
          x_mute_user: /mute @/i,
          x_unmute_user: /unmute @/i,
          x_block_user: /block @/i,
          x_unblock_user: /unblock @/i,
          x_report_user: /report/i,
        };
        const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((el) =>
          labelMap[name].test(el.textContent || ''),
        );
        if (!item) return { success: false, error: 'menu item not found', username: uname };
        await clickElement(item);
        await sleep(400);
        const conf = document.querySelector(SELECTORS.confirmButton);
        if (conf && (name === 'x_block_user' || name === 'x_mute_user')) {
          await clickElement(conf);
        }
        return { success: true, action: name, username: uname };
      }
      case 'x_get_user_card': {
        const users = collectUsers(30).map(({ el, ...rest }) => rest);
        if (a.username) {
          const u = users.find((x) => x.username === String(a.username).replace(/^@/, '').toLowerCase());
          return u || { error: 'not visible', username: a.username };
        }
        return { users: users.slice(0, 10) };
      }
      case 'x_follow_visible': {
        const max = Math.min(Math.max(Number(a.max) || 5, 1), 20);
        const dry = !!a.dryRun;
        const users = collectUsers(40).filter((u) => u.canFollow);
        let n = 0;
        const followed = [];
        for (const u of users) {
          if (n >= max) break;
          if (dry) {
            followed.push(u.username);
            n++;
            continue;
          }
          const btn = u.el.querySelector(SELECTORS.followButton);
          if (btn) {
            await clickElement(btn);
            followed.push(u.username);
            n++;
            await sleep(1500);
          }
        }
        return { success: true, dryRun: dry, count: followed.length, followed };
      }

      // Read / scrape
      case 'x_get_visible_tweets': {
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 40);
        return { tweets: collectTweets(max).map(({ el, ...r }) => r) };
      }
      case 'x_get_visible_users': {
        const max = Math.min(Math.max(Number(a.max) || 20, 1), 50);
        return { users: collectUsers(max).map(({ el, ...r }) => r) };
      }
      case 'x_search_tweets': {
        await go(`/search?q=${encodeURIComponent(a.query || '')}&src=typed_query`);
        await sleep(1500);
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 30);
        return { query: a.query, tweets: collectTweets(max).map(({ el, ...r }) => r) };
      }
      case 'x_get_trends': {
        const max = Math.min(Math.max(Number(a.max) || 10, 1), 30);
        const trends = [];
        const items = document.querySelectorAll('[data-testid="trend"]');
        for (const el of items) {
          if (trends.length >= max) break;
          const text = el.innerText?.trim() || '';
          if (text) trends.push(text.split('\n').slice(0, 3).join(' · '));
        }
        // fallback explore links
        if (!trends.length) {
          document.querySelectorAll('a[href*="/search?q="]').forEach((aEl) => {
            if (trends.length >= max) return;
            const t = aEl.innerText?.trim();
            if (t && t.length < 80) trends.push(t);
          });
        }
        return { trends, path: location.pathname };
      }
      case 'x_get_notifications': {
        if (!location.pathname.includes('notifications')) {
          await go('/notifications');
          await sleep(1200);
        }
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 40);
        const items = [];
        document.querySelectorAll('[data-testid="cellInnerDiv"]').forEach((el) => {
          if (items.length >= max) return;
          const text = el.innerText?.trim();
          if (text && text.length > 5) items.push(text.slice(0, 300));
        });
        return { notifications: items };
      }
      case 'x_get_profile_stats': {
        if (a.username) {
          await go(`/${String(a.username).replace(/^@/, '')}`);
          await sleep(1200);
        }
        const links = Array.from(document.querySelectorAll('a[href$="/followers"], a[href$="/following"], a[href*="/verified_followers"]'));
        const stats = { url: location.href };
        for (const link of links) {
          const t = link.innerText || '';
          if (/following/i.test(link.getAttribute('href') || '') && !/followers/i.test(link.getAttribute('href') || '')) {
            stats.following = parseCount(t);
          } else if (/followers/i.test(link.getAttribute('href') || '')) {
            stats.followers = parseCount(t);
          }
        }
        // posts count heuristic
        const header = document.querySelector('[data-testid="primaryColumn"] h2')?.parentElement;
        const postsTxt = header?.innerText || '';
        const pm = postsTxt.match(/([\d,.]+[KkMm]?)\s*posts?/i);
        if (pm) stats.posts = parseCount(pm[1]);
        stats.displayName =
          document.querySelector('[data-testid="UserName"] span')?.textContent || '';
        return stats;
      }
      case 'x_get_tweet_detail': {
        if (a.url) {
          await go(a.url);
          await sleep(1200);
        }
        const tweets = collectTweets(5).map(({ el, ...r }) => r);
        return { tweet: tweets[0] || null, related: tweets.slice(1) };
      }
      case 'x_get_replies_visible': {
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 40);
        const tweets = collectTweets(max + 1).map(({ el, ...r }) => r);
        return { replies: tweets.slice(1), root: tweets[0] || null };
      }
      case 'x_get_media_visible': {
        const max = Math.min(Math.max(Number(a.max) || 20, 1), 50);
        const media = [];
        document.querySelectorAll(`${SELECTORS.tweet} img[src*="media"], ${SELECTORS.tweet} video`).forEach((el) => {
          if (media.length >= max) return;
          if (el.tagName === 'VIDEO') media.push({ type: 'video', src: el.src || el.currentSrc });
          else media.push({ type: 'image', src: el.src });
        });
        return { media };
      }
      case 'x_get_likes_tab': {
        const u = String(a.username || '').replace(/^@/, '');
        if (u) {
          await go(`/${u}/likes`);
          await sleep(1200);
        }
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 30);
        return { tweets: collectTweets(max).map(({ el, ...r }) => r) };
      }
      case 'x_get_followers_visible':
      case 'x_get_following_visible': {
        const max = Math.min(Math.max(Number(a.max) || 20, 1), 50);
        return { users: collectUsers(max).map(({ el, ...r }) => r), path: location.pathname };
      }
      case 'x_get_bookmarks_visible': {
        if (!location.pathname.includes('bookmarks')) {
          await go('/i/bookmarks');
          await sleep(1200);
        }
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 30);
        return { tweets: collectTweets(max).map(({ el, ...r }) => r) };
      }
      case 'x_get_lists_visible': {
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 30);
        const lists = [];
        document.querySelectorAll('a[href*="/lists/"]').forEach((el) => {
          if (lists.length >= max) return;
          const t = el.innerText?.trim();
          if (t) lists.push({ name: t.split('\n')[0], href: el.href });
        });
        return { lists };
      }
      case 'x_extract_links': {
        const max = Math.min(Math.max(Number(a.max) || 30, 1), 50);
        const links = [];
        document.querySelectorAll(`${SELECTORS.tweet} a[href^="https://"]`).forEach((el) => {
          if (links.length >= max) return;
          const href = el.href;
          if (/x\.com|twitter\.com|t\.co/.test(href) && !/t\.co/.test(href)) return;
          links.push(href);
        });
        return { links: [...new Set(links)] };
      }
      case 'x_copy_tweet_text': {
        const t = findTweet(a.url, a.keyword);
        if (!t) return { error: 'tweet not found' };
        return { text: t.text, author: t.author, url: t.url };
      }

      // Analytics visible
      case 'x_engagement_snapshot': {
        const max = Math.min(Math.max(Number(a.max) || 20, 1), 40);
        const tweets = collectTweets(max);
        const sum = { likes: 0, retweets: 0, replies: 0, count: tweets.length };
        for (const t of tweets) {
          sum.likes += t.stats.likes || 0;
          sum.retweets += t.stats.retweets || 0;
          sum.replies += t.stats.replies || 0;
        }
        return sum;
      }
      case 'x_follower_ratio_visible': {
        const stats = await runAgentPageTool('x_get_profile_stats', a);
        const followers = stats.followers || 0;
        const following = stats.following || 0;
        return {
          ...stats,
          ratio: following ? +(followers / following).toFixed(2) : null,
        };
      }
      case 'x_top_tweets_visible': {
        const max = Math.min(Math.max(Number(a.max) || 10, 1), 20);
        const tweets = collectTweets(40).map(({ el, ...r }) => r);
        tweets.sort(
          (x, y) =>
            (y.stats.likes || 0) + (y.stats.retweets || 0) * 2 -
            ((x.stats.likes || 0) + (x.stats.retweets || 0) * 2),
        );
        return { top: tweets.slice(0, max) };
      }
      case 'x_hashtag_frequency': {
        const tweets = collectTweets(Math.min(Number(a.max) || 30, 40));
        const freq = {};
        for (const t of tweets) {
          const tags = t.text.match(/#[\w\u00C0-\u024F]+/g) || [];
          for (const tag of tags) {
            const k = tag.toLowerCase();
            freq[k] = (freq[k] || 0) + 1;
          }
        }
        return {
          hashtags: Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([tag, count]) => ({ tag, count })),
        };
      }
      case 'x_mention_frequency': {
        const tweets = collectTweets(Math.min(Number(a.max) || 30, 40));
        const freq = {};
        for (const t of tweets) {
          const ms = t.text.match(/@\w+/g) || [];
          for (const m of ms) {
            const k = m.toLowerCase();
            freq[k] = (freq[k] || 0) + 1;
          }
        }
        return {
          mentions: Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([handle, count]) => ({ handle, count })),
        };
      }
      case 'x_best_time_hint': {
        const tweets = collectTweets(Math.min(Number(a.max) || 30, 40));
        const hours = {};
        for (const t of tweets) {
          if (!t.time) continue;
          const d = new Date(t.time);
          if (Number.isNaN(d.getTime())) continue;
          const h = d.getHours();
          hours[h] = (hours[h] || 0) + 1;
        }
        const ranked = Object.entries(hours)
          .map(([h, c]) => ({ hour: Number(h), count: c }))
          .sort((a, b) => b.count - a.count);
        return {
          hourHistogram: ranked,
          hint: ranked[0]
            ? `Visible sample peaks around ${ranked[0].hour}:00 (local browser time).`
            : 'Not enough timestamps visible.',
        };
      }
      case 'x_bot_score_visible': {
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 30);
        const users = collectUsers(max).map(({ el, ...r }) => {
          let score = 0;
          const notes = [];
          if (!r.bio) {
            score += 2;
            notes.push('empty bio');
          }
          if (/bot|follow.?back|crypto airdrop/i.test(r.bio)) {
            score += 3;
            notes.push('spammy bio');
          }
          if (/^\w+\d{4,}$/.test(r.username)) {
            score += 1;
            notes.push('numeric handle');
          }
          return { ...r, botScore: score, notes };
        });
        return { users };
      }
      case 'x_link_domains': {
        const linksRes = await runAgentPageTool('x_extract_links', a);
        const domains = {};
        for (const href of linksRes.links || []) {
          try {
            const d = new URL(href).hostname.replace(/^www\./, '');
            domains[d] = (domains[d] || 0) + 1;
          } catch {
            /* skip */
          }
        }
        return {
          domains: Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .map(([domain, count]) => ({ domain, count })),
        };
      }

      // Matching bulk one-shots
      case 'x_like_visible_matching':
      case 'x_retweet_visible_matching':
      case 'x_bookmark_visible_matching': {
        const max = Math.min(Math.max(Number(a.max) || 5, 1), 15);
        const kws = splitKw(a.keywords);
        const tweets = collectTweets(40);
        const done = [];
        for (const t of tweets) {
          if (done.length >= max) break;
          if (!matchKeywords(t.text, kws)) continue;
          let ok = false;
          if (name === 'x_like_visible_matching') ok = await clickTweetAction(t, 'like');
          else if (name === 'x_retweet_visible_matching') {
            ok = await clickTweetAction(t, 'retweet');
            const menuRt = document.querySelector('[data-testid="retweetConfirm"]');
            if (menuRt) await clickElement(menuRt);
          } else ok = await clickTweetAction(t, 'bookmark');
          if (ok) {
            done.push({ author: t.author, url: t.url, text: t.text.slice(0, 80) });
            await sleep(1200 + Math.random() * 800);
          }
        }
        return { success: true, count: done.length, items: done };
      }

      // DM / account
      case 'x_get_dm_preview': {
        if (!location.pathname.includes('messages')) {
          await go('/messages');
          await sleep(1200);
        }
        const max = Math.min(Math.max(Number(a.max) || 15, 1), 30);
        const convos = [];
        document.querySelectorAll('[data-testid="conversation"] , [data-testid="cellInnerDiv"]').forEach((el) => {
          if (convos.length >= max) return;
          const t = el.innerText?.trim();
          if (t && t.length > 3) convos.push(t.split('\n').slice(0, 3).join(' · ').slice(0, 200));
        });
        return { conversations: convos };
      }
      case 'x_compose_dm': {
        const uname = String(a.username || '').replace(/^@/, '');
        await go(`/messages/compose`);
        await sleep(1000);
        // try search recipient
        const search =
          document.querySelector('[data-testid="searchPeople"]') ||
          document.querySelector('input[aria-label*="Search"]') ||
          document.querySelector('input[type="text"]');
        if (search && uname) {
          search.focus();
          document.execCommand('insertText', false, uname);
          search.dispatchEvent(new Event('input', { bubbles: true }));
          await sleep(1000);
          const person = document.querySelector(`[data-testid="TypeaheadUser"]`) ||
            document.querySelector(`div[role="listbox"] [role="option"]`);
          if (person) await clickElement(person);
          await sleep(600);
        }
        const box =
          document.querySelector('[data-testid="dmComposerTextInput"]') ||
          document.querySelector('[contenteditable="true"][role="textbox"]');
        if (box && a.message) {
          box.focus();
          document.execCommand('insertText', false, a.message);
          box.dispatchEvent(new InputEvent('input', { bubbles: true, data: a.message }));
          await sleep(400);
          const send = document.querySelector('[data-testid="dmComposerSendButton"]');
          if (send) {
            await clickElement(send);
            return { success: true, username: uname, sent: true };
          }
          return { success: true, username: uname, sent: false, note: 'typed but send button not clicked' };
        }
        return { success: false, error: 'DM composer not ready', username: uname };
      }
      case 'x_get_sidebar_account':
        return scrapeAccountInfo();

      case 'x_open_messages_user': {
        // better path: open compose
        const uname = String(a.username || '').replace(/^@/, '');
        await go('/messages/compose');
        await sleep(800);
        return { success: true, username: uname, note: 'opened compose — use x_compose_dm to send' };
      }

      default:
        return { error: `Unsupported page tool: ${name}` };
    }
  }

  console.log('✅ XActions automation engine injected');

  // ============================================
  // VIDEO DOWNLOADER
  // ============================================
  registerAutomation('videoDownloader', async (settings) => {
    const { log, sleep, SELECTORS } = window.XActions.Core;
    const opts = {
      quality: settings.quality || 'highest',
      autoDownload: settings.autoDownload || false,
      showButton: settings.showButton !== false,
    };

    log('🎬 Video Downloader enabled — scanning for videos...', 'info');

    const injectedTweets = new Set();

    function findVideoUrl(tweetEl) {
      // Look for video elements
      const video = tweetEl.querySelector('video');
      if (video?.src) return video.src;
      // Check for source tags
      const source = tweetEl.querySelector('video source');
      if (source?.src) return source.src;
      // Try to find mp4 URL in tweet data
      const links = tweetEl.querySelectorAll('a[href*="video"]');
      for (const link of links) {
        if (link.href.includes('.mp4')) return link.href;
      }
      return null;
    }

    function addDownloadButton(tweetEl) {
      const tweetLink = tweetEl.querySelector(SELECTORS.tweetLink)?.href || '';
      const tweetId = tweetLink.match(/status\/(\d+)/)?.[1];
      if (!tweetId || injectedTweets.has(tweetId)) return;

      // Check for video content
      const hasVideo = tweetEl.querySelector('video') || tweetEl.querySelector('[data-testid="videoPlayer"]') || tweetEl.querySelector('[data-testid="videoComponent"]');
      if (!hasVideo) return;

      injectedTweets.add(tweetId);
      const actionBar = tweetEl.querySelector('[role="group"]');
      if (!actionBar) return;

      const btn = document.createElement('button');
      btn.className = 'xactions-dl-btn';
      btn.innerHTML = '⬇';
      btn.title = 'Download video (XActions)';
      btn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:4px 8px;border-radius:50%;transition:background 0.2s;color:#1d9bf0;';
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(29,155,240,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'none');

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.innerHTML = '⏳';
        const videoUrl = findVideoUrl(tweetEl);
        if (videoUrl) {
          const a = document.createElement('a');
          a.href = videoUrl;
          a.download = `xactions_video_${tweetId}.mp4`;
          a.click();
          btn.innerHTML = '✅';
          window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'videoDownloader', action: `⬇ Downloaded video from tweet ${tweetId}` }, '*');
          log(`⬇ Downloaded video from tweet ${tweetId}`, 'success');
        } else {
          // Fallback: open tweet in new tab for manual download
          btn.innerHTML = '🔗';
          btn.title = 'Could not extract video URL — try right-click > Save Video';
          log(`⚠️ Could not extract video URL for tweet ${tweetId}`, 'warning');
        }
        setTimeout(() => { btn.innerHTML = '⬇'; btn.title = 'Download video (XActions)'; }, 3000);
      });

      actionBar.appendChild(btn);
    }

    if (opts.showButton) {
      // Initial scan
      document.querySelectorAll(SELECTORS.tweet).forEach(addDownloadButton);

      // Watch for new tweets
      const observer = new MutationObserver(() => {
        document.querySelectorAll(SELECTORS.tweet).forEach(addDownloadButton);
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Store observer so we can disconnect on stop
      window.__xactions_videoObserver = observer;

      // Keep running until stopped
      while (!automationStopFlags['videoDownloader']) {
        await sleep(5000);
      }
      observer.disconnect();
      window.__xactions_videoObserver = null;
    }

    log('🎬 Video Downloader disabled', 'info');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'videoDownloader', summary: 'Video downloader stopped' }, '*');
  });

  // ============================================
  // UNFOLLOWER DETECTOR
  // ============================================
  registerAutomation('unfollowerDetector', async (settings) => {
    const { log, sleep, scrollBy, waitForElements, SELECTORS, storage } = window.XActions.Core;
    const opts = {
      notifications: settings.notifications !== false,
      keepHistory: settings.keepHistory !== false,
    };

    log('🔔 Unfollower Detector scanning...', 'info');

    // Get current path to determine username
    const pathParts = window.location.pathname.split('/');
    const username = pathParts[1];
    if (!username || pathParts[2] !== 'followers') {
      log('⚠️ Navigate to your followers page first (x.com/YOUR_USERNAME/followers)', 'warning');
      window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_ERROR', automationId: 'unfollowerDetector', error: 'Navigate to your followers page (x.com/YOUR_USERNAME/followers)' }, '*');
      return;
    }

    const currentFollowers = new Set();
    let scrollAttempts = 0;
    let lastCount = 0;
    let noNewCount = 0;

    // Scroll through followers page and collect
    while (scrollAttempts < 100 && noNewCount < 5 && !automationStopFlags['unfollowerDetector']) {
      const cells = document.querySelectorAll(SELECTORS.userCell);
      cells.forEach(cell => {
        const userLink = cell.querySelector('a[href^="/"]');
        const handle = userLink?.getAttribute('href')?.replace('/', '');
        if (handle) currentFollowers.add(handle.toLowerCase());
      });

      if (currentFollowers.size === lastCount) {
        noNewCount++;
      } else {
        noNewCount = 0;
        lastCount = currentFollowers.size;
      }

      scrollBy(800);
      scrollAttempts++;
      await sleep(1000);
    }

    log(`📋 Found ${currentFollowers.size} current followers`, 'info');

    // Compare with previous snapshot
    const previousFollowers = new Set(storage.get('follower_snapshot') || []);
    const unfollowers = [];

    if (previousFollowers.size > 0) {
      for (const prev of previousFollowers) {
        if (!currentFollowers.has(prev)) {
          unfollowers.push(prev);
        }
      }
      const newFollowers = [];
      for (const curr of currentFollowers) {
        if (!previousFollowers.has(curr)) {
          newFollowers.push(curr);
        }
      }

      if (unfollowers.length > 0) {
        log(`🚨 ${unfollowers.length} unfollower(s): ${unfollowers.map(u => '@' + u).join(', ')}`, 'warning');
        window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'unfollowerDetector', action: `🚨 Detected ${unfollowers.length} unfollower(s): ${unfollowers.map(u => '@' + u).join(', ')}` }, '*');
      } else {
        log('✅ No unfollowers detected since last scan', 'success');
      }
      if (newFollowers.length > 0) {
        log(`🎉 ${newFollowers.length} new follower(s): ${newFollowers.map(u => '@' + u).join(', ')}`, 'success');
      }

      // Save unfollower history
      if (opts.keepHistory && unfollowers.length > 0) {
        const history = storage.get('unfollower_history') || [];
        history.unshift({ date: Date.now(), unfollowers, newFollowers });
        if (history.length > 50) history.length = 50;
        storage.set('unfollower_history', history);
      }
    } else {
      log('📸 First scan — saving follower snapshot for future comparison', 'info');
    }

    // Save current snapshot
    storage.set('follower_snapshot', Array.from(currentFollowers));
    storage.set('last_follower_scan', Date.now());

    log(`✅ Unfollower scan complete! ${currentFollowers.size} followers recorded`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'unfollowerDetector', summary: `${unfollowers.length} unfollower(s), ${currentFollowers.size} total followers` }, '*');
  });

  // ============================================
  // BEST TIME TO POST
  // ============================================
  registerAutomation('bestTimeToPost', async (settings) => {
    const { log, sleep, scrollBy, SELECTORS, storage } = window.XActions.Core;
    const opts = {
      tweetCount: settings.tweetCount || 50,
      timezone: settings.timezone || 'local',
    };

    log(`📊 Best Time to Post — analyzing ${opts.tweetCount} tweets...`, 'info');

    const tweetData = [];
    let scrollAttempts = 0;
    let noNewCount = 0;
    let lastCount = 0;
    const seenTweets = new Set();

    while (tweetData.length < opts.tweetCount && scrollAttempts < 80 && noNewCount < 5 && !automationStopFlags['bestTimeToPost']) {
      const tweets = document.querySelectorAll(SELECTORS.tweet);

      for (const tweet of tweets) {
        if (tweetData.length >= opts.tweetCount) break;
        const link = tweet.querySelector(SELECTORS.tweetLink)?.href || '';
        const tweetId = link.match(/status\/(\d+)/)?.[1];
        if (!tweetId || seenTweets.has(tweetId)) continue;
        seenTweets.add(tweetId);

        // Extract engagement data
        const text = tweet.querySelector(SELECTORS.tweetText)?.textContent || '';
        const timeEl = tweet.querySelector('time');
        const datetime = timeEl?.getAttribute('datetime');
        if (!datetime) continue;

        // Count likes, retweets, replies from aria-labels
        const groups = tweet.querySelectorAll('[role="group"] button');
        let likes = 0, retweets = 0, replies = 0;
        groups.forEach(btn => {
          const label = btn.getAttribute('aria-label') || '';
          const likeMatch = label.match(/(\d+)\s*[Ll]ike/);
          const rtMatch = label.match(/(\d+)\s*[Rr]e(?:post|tweet)/);
          const replyMatch = label.match(/(\d+)\s*repl/i);
          if (likeMatch) likes = parseInt(likeMatch[1]);
          if (rtMatch) retweets = parseInt(rtMatch[1]);
          if (replyMatch) replies = parseInt(replyMatch[1]);
        });

        const date = new Date(datetime);
        tweetData.push({
          tweetId,
          datetime,
          hour: date.getHours(),
          day: date.getDay(),
          dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
          likes,
          retweets,
          replies,
          engagement: likes + retweets + replies,
          text: text.substring(0, 80),
        });

        window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'bestTimeToPost', action: `📊 Analyzed tweet ${tweetData.length}/${opts.tweetCount}` }, '*');
      }

      if (tweetData.length === lastCount) {
        noNewCount++;
      } else {
        noNewCount = 0;
        lastCount = tweetData.length;
      }

      scrollBy(800);
      scrollAttempts++;
      await sleep(1000);
    }

    // Compute best times
    const hourStats = {};
    const dayStats = {};
    for (let h = 0; h < 24; h++) hourStats[h] = { total: 0, count: 0 };
    for (let d = 0; d < 7; d++) dayStats[d] = { total: 0, count: 0 };

    for (const t of tweetData) {
      hourStats[t.hour].total += t.engagement;
      hourStats[t.hour].count++;
      dayStats[t.day].total += t.engagement;
      dayStats[t.day].count++;
    }

    const bestHours = Object.entries(hourStats)
      .filter(([, v]) => v.count > 0)
      .map(([h, v]) => ({ hour: parseInt(h), avg: v.total / v.count, count: v.count }))
      .sort((a, b) => b.avg - a.avg);

    const bestDays = Object.entries(dayStats)
      .filter(([, v]) => v.count > 0)
      .map(([d, v]) => ({ day: parseInt(d), dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d], avg: v.total / v.count, count: v.count }))
      .sort((a, b) => b.avg - a.avg);

    // Save results
    const results = { tweetData, bestHours, bestDays, analyzedAt: Date.now(), tweetCount: tweetData.length };
    storage.set('best_time_results', results);

    if (bestHours.length > 0) {
      const top3 = bestHours.slice(0, 3).map(h => `${h.hour}:00 (avg ${h.avg.toFixed(1)} eng)`).join(', ');
      log(`🏆 Best hours: ${top3}`, 'success');
    }
    if (bestDays.length > 0) {
      const topDay = bestDays[0];
      log(`📅 Best day: ${topDay.dayName} (avg ${topDay.avg.toFixed(1)} engagement)`, 'success');
    }

    log(`✅ Analyzed ${tweetData.length} tweets!`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'bestTimeToPost', summary: `${tweetData.length} tweets analyzed` }, '*');
  });

  // ============================================
  // THREAD READER
  // ============================================
  registerAutomation('threadReader', async (settings) => {
    const { log, sleep, SELECTORS } = window.XActions.Core;
    const opts = {
      showUnrollBtn: settings.showUnrollBtn !== false,
      autoDetect: settings.autoDetect !== false,
      maxTweets: settings.maxTweets || 50,
    };

    log('🧵 Thread Reader enabled — watching for threads...', 'info');

    const processedThreads = new Set();

    function isThread(tweetEl) {
      // Thread indicators: "Show this thread" link, self-reply chain, thread line
      const showThread = tweetEl.querySelector('a[href*="/status/"]')?.textContent?.includes('Show this thread');
      const threadLine = tweetEl.querySelector('[data-testid="tweet-thread-line"]') || tweetEl.parentElement?.querySelector('[style*="border-left"]');
      return showThread || threadLine;
    }

    function addUnrollButton(tweetEl) {
      const tweetLink = tweetEl.querySelector(SELECTORS.tweetLink)?.href || '';
      const tweetId = tweetLink.match(/status\/(\d+)/)?.[1];
      if (!tweetId || processedThreads.has(tweetId)) return;
      if (!isThread(tweetEl)) return;

      processedThreads.add(tweetId);

      const actionBar = tweetEl.querySelector('[role="group"]');
      if (!actionBar) return;

      const btn = document.createElement('button');
      btn.className = 'xactions-unroll-btn';
      btn.innerHTML = '🧵';
      btn.title = 'Unroll thread (XActions)';
      btn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:14px;padding:4px 8px;border-radius:50%;transition:background 0.2s;color:#1d9bf0;';
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(29,155,240,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'none');

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.innerHTML = '⏳';

        // Collect thread tweets by navigating to the tweet
        const threadTweets = [];
        const currentTweets = document.querySelectorAll(SELECTORS.tweet);
        currentTweets.forEach(t => {
          const text = t.querySelector(SELECTORS.tweetText)?.textContent || '';
          if (text) threadTweets.push(text);
        });

        if (threadTweets.length > 0) {
          // Create overlay with unrolled thread
          const overlay = document.createElement('div');
          overlay.id = 'xactions-thread-overlay';
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;overflow-y:auto;padding:20px;';

          const container = document.createElement('div');
          container.style.cssText = 'max-width:600px;margin:0 auto;background:#16181c;border-radius:16px;padding:20px;color:#e7e9ea;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';

          const header = document.createElement('div');
          header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #2f3336;';
          header.innerHTML = `<span style="font-size:18px;font-weight:700;">🧵 Thread (${threadTweets.length} tweets)</span>`;

          const closeBtn = document.createElement('button');
          closeBtn.textContent = '✕';
          closeBtn.style.cssText = 'background:none;border:none;color:#71767b;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:50%;';
          closeBtn.addEventListener('click', () => overlay.remove());
          header.appendChild(closeBtn);
          container.appendChild(header);

          threadTweets.slice(0, opts.maxTweets).forEach((text, i) => {
            const p = document.createElement('div');
            p.style.cssText = 'padding:12px 0;border-bottom:1px solid #2f3336;font-size:15px;line-height:1.5;';
            p.innerHTML = `<span style="color:#71767b;font-size:12px;">${i + 1}/${threadTweets.length}</span><br>${text}`;
            container.appendChild(p);
          });

          // Copy all button
          const copyBtn = document.createElement('button');
          copyBtn.textContent = '📋 Copy Thread';
          copyBtn.style.cssText = 'display:block;margin:16px auto 0;background:#1d9bf0;color:white;border:none;padding:10px 24px;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;';
          copyBtn.addEventListener('click', () => {
            const fullText = threadTweets.map((t, i) => `${i + 1}. ${t}`).join('\n\n');
            navigator.clipboard.writeText(fullText);
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => { copyBtn.textContent = '📋 Copy Thread'; }, 2000);
          });
          container.appendChild(copyBtn);

          overlay.appendChild(container);
          overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
          document.body.appendChild(overlay);

          btn.innerHTML = '🧵';
          window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'threadReader', action: `🧵 Unrolled thread with ${threadTweets.length} tweets` }, '*');
          log(`🧵 Unrolled thread: ${threadTweets.length} tweets`, 'success');
        } else {
          btn.innerHTML = '🧵';
          log('⚠️ Could not collect thread tweets', 'warning');
        }
      });

      actionBar.appendChild(btn);
    }

    if (opts.showUnrollBtn) {
      document.querySelectorAll(SELECTORS.tweet).forEach(addUnrollButton);

      const observer = new MutationObserver(() => {
        document.querySelectorAll(SELECTORS.tweet).forEach(addUnrollButton);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.__xactions_threadObserver = observer;

      while (!automationStopFlags['threadReader']) {
        await sleep(5000);
      }
      observer.disconnect();
      window.__xactions_threadObserver = null;
    }

    log('🧵 Thread Reader disabled', 'info');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'threadReader', summary: 'Thread reader stopped' }, '*');
  });

  // ============================================
  // QUICK STATS
  // ============================================
  registerAutomation('quickStats', async (settings) => {
    const { log, sleep, scrollBy, SELECTORS, storage } = window.XActions.Core;
    const opts = {
      showOverlay: settings.showOverlay !== false,
      trackDaily: settings.trackDaily !== false,
      sampleSize: settings.sampleSize || 20,
    };

    log('⚡ Quick Stats — calculating engagement rate...', 'info');

    // Collect engagement data from visible tweets
    const tweetStats = [];
    let scrollAttempts = 0;
    let noNewCount = 0;
    let lastCount = 0;
    const seenIds = new Set();

    while (tweetStats.length < opts.sampleSize && scrollAttempts < 40 && noNewCount < 3 && !automationStopFlags['quickStats']) {
      const tweets = document.querySelectorAll(SELECTORS.tweet);

      for (const tweet of tweets) {
        if (tweetStats.length >= opts.sampleSize) break;
        const link = tweet.querySelector(SELECTORS.tweetLink)?.href || '';
        const tweetId = link.match(/status\/(\d+)/)?.[1];
        if (!tweetId || seenIds.has(tweetId)) continue;
        seenIds.add(tweetId);

        const groups = tweet.querySelectorAll('[role="group"] button');
        let likes = 0, retweets = 0, replies = 0, views = 0;
        groups.forEach(btn => {
          const label = btn.getAttribute('aria-label') || '';
          const likeMatch = label.match(/(\d+)\s*[Ll]ike/);
          const rtMatch = label.match(/(\d+)\s*[Rr]e(?:post|tweet)/);
          const replyMatch = label.match(/(\d+)\s*repl/i);
          const viewMatch = label.match(/(\d+)\s*[Vv]iew/);
          if (likeMatch) likes = parseInt(likeMatch[1]);
          if (rtMatch) retweets = parseInt(rtMatch[1]);
          if (replyMatch) replies = parseInt(replyMatch[1]);
          if (viewMatch) views = parseInt(viewMatch[1]);
        });

        tweetStats.push({ tweetId, likes, retweets, replies, views, engagement: likes + retweets + replies });
      }

      if (tweetStats.length === lastCount) {
        noNewCount++;
      } else {
        noNewCount = 0;
        lastCount = tweetStats.length;
      }

      scrollBy(600);
      scrollAttempts++;
      await sleep(800);
    }

    if (tweetStats.length === 0) {
      log('⚠️ No tweets found to analyze', 'warning');
      window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_ERROR', automationId: 'quickStats', error: 'No tweets found' }, '*');
      return;
    }

    // Calculate stats
    const totalEngagement = tweetStats.reduce((sum, t) => sum + t.engagement, 0);
    const totalViews = tweetStats.reduce((sum, t) => sum + t.views, 0);
    const avgEngagement = totalEngagement / tweetStats.length;
    const engagementRate = totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(2) : 'N/A';
    const avgLikes = (tweetStats.reduce((s, t) => s + t.likes, 0) / tweetStats.length).toFixed(1);
    const avgRetweets = (tweetStats.reduce((s, t) => s + t.retweets, 0) / tweetStats.length).toFixed(1);
    const avgReplies = (tweetStats.reduce((s, t) => s + t.replies, 0) / tweetStats.length).toFixed(1);

    const results = {
      tweetCount: tweetStats.length,
      totalEngagement,
      totalViews,
      avgEngagement: avgEngagement.toFixed(1),
      engagementRate,
      avgLikes,
      avgRetweets,
      avgReplies,
      analyzedAt: Date.now(),
    };

    storage.set('quick_stats', results);

    // Track daily
    if (opts.trackDaily) {
      const dailyHistory = storage.get('daily_stats') || [];
      dailyHistory.unshift({ ...results, date: new Date().toISOString().slice(0, 10) });
      if (dailyHistory.length > 90) dailyHistory.length = 90;
      storage.set('daily_stats', dailyHistory);
    }

    // Show overlay on page
    if (opts.showOverlay) {
      // Remove existing overlay
      document.querySelector('#xactions-stats-overlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'xactions-stats-overlay';
      overlay.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#16181c;border:1px solid #2f3336;border-radius:16px;padding:16px;z-index:99998;color:#e7e9ea;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;min-width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
      overlay.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-weight:700;font-size:14px;">⚡ Quick Stats</span>
          <button id="xactions-close-stats" style="background:none;border:none;color:#71767b;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div style="font-size:12px;color:#71767b;margin-bottom:8px;">${tweetStats.length} tweets analyzed</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:#000;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#1d9bf0;">${engagementRate}%</div>
            <div style="font-size:10px;color:#71767b;">Eng. Rate</div>
          </div>
          <div style="background:#000;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#00ba7c;">${avgEngagement.toFixed(0)}</div>
            <div style="font-size:10px;color:#71767b;">Avg Eng.</div>
          </div>
          <div style="background:#000;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:14px;font-weight:700;">❤️ ${avgLikes}</div>
            <div style="font-size:10px;color:#71767b;">Avg Likes</div>
          </div>
          <div style="background:#000;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:14px;font-weight:700;">🔁 ${avgRetweets}</div>
            <div style="font-size:10px;color:#71767b;">Avg RTs</div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#xactions-close-stats').addEventListener('click', () => overlay.remove());
    }

    window.postMessage({ source: 'xactions-page', type: 'ACTION_PERFORMED', automationId: 'quickStats', action: `⚡ Engagement rate: ${engagementRate}%, avg: ${avgEngagement.toFixed(1)} per tweet` }, '*');
    log(`⚡ Engagement rate: ${engagementRate}% | Avg: ${avgEngagement.toFixed(1)} | Likes: ${avgLikes} | RTs: ${avgRetweets} | Replies: ${avgReplies}`, 'success');
    window.postMessage({ source: 'xactions-page', type: 'AUTOMATION_COMPLETE', automationId: 'quickStats', summary: `${engagementRate}% engagement rate (${tweetStats.length} tweets)` }, '*');
  });

})();
