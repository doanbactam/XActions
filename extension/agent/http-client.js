// XActions Extension — HTTP-only Twitter/X client for the service worker.
// No tab required. Falls back to page tools when HTTP cannot handle a flow.
// by nichxbt

(() => {
  const BEARER_TOKEN =
    'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  const GRAPHQL_BASE = 'https://x.com/i/api/graphql';
  const REST_BASE = 'https://x.com/i/api';

  const GRAPHQL = {
    UserByScreenName: { queryId: 'NimuplG1OB7Fd2btCLdBOw', operationName: 'UserByScreenName' },
    UserByRestId: { queryId: 'tD8zKvQzwY3kdx5yz6YmOw', operationName: 'UserByRestId' },
    UserTweets: { queryId: 'QWF3SzpHmykQHsQMixG0cg', operationName: 'UserTweets' },
    UserTweetsAndReplies: { queryId: 'vMkJyzx1wdmvOeeNG0n6Wg', operationName: 'UserTweetsAndReplies' },
    UserMedia: { queryId: '2tLOJWwGuCTytDrGBg8VwQ', operationName: 'UserMedia' },
    UserLikes: { queryId: 'IohM3gxQHfvWePH5E3KuNA', operationName: 'Likes' },
    TweetDetail: { queryId: 'U0HTv-bAWTBYylwEMT7x5A', operationName: 'TweetDetail' },
    TweetResultByRestId: { queryId: 'Xl5pC_lBk_gcO2ItU39DQw', operationName: 'TweetResultByRestId' },
    SearchTimeline: { queryId: 'flaR-PUMshxFWZWPNpq4zA', operationName: 'SearchTimeline' },
    Followers: { queryId: 'gC_lyAxZOptAMLCJX5UhWw', operationName: 'Followers' },
    Following: { queryId: '2vUj-_Ek-UmBVDNtd8OnQA', operationName: 'Following' },
    Likes: { queryId: 'LLkw5EcVutJL6y-2gkz22A', operationName: 'Favoriters' },
    Retweeters: { queryId: 'X-XEqG5qHQSAwmvy00xfyQ', operationName: 'Retweeters' },
    ListMembers: { queryId: 'BQp2IEYkgxuSxqbTAr1e1g', operationName: 'ListMembers' },
    ListTimeline: { queryId: 'HjsWc-nwwHKYwHenbHm-tw', operationName: 'ListLatestTweetsTimeline' },
    BookmarkTimeline: { queryId: 'qToeLeMs43Q8cr7tRYXmaQ', operationName: 'Bookmarks' },
    HomeTimeline: { queryId: '-X_hcgQzmHGl29-UXxz4sw', operationName: 'HomeTimeline' },
    HomeLatestTimeline: { queryId: 'U0cdisy7QFIoTfu3-Okw0A', operationName: 'HomeLatestTimeline' },
    CreateTweet: { queryId: 'SiM_cAu83R0wnrpmKQQSEw', operationName: 'CreateTweet' },
    DeleteTweet: { queryId: 'VaenaVgh5q5ih7kvyVjgtg', operationName: 'DeleteTweet' },
    FavoriteTweet: { queryId: 'lI07N6Otwv1PhnEgXILM7A', operationName: 'FavoriteTweet' },
    UnfavoriteTweet: { queryId: 'ZYKSe-w7KEslx3JhSIk5LA', operationName: 'UnfavoriteTweet' },
    CreateRetweet: { queryId: 'ojPdsZsimiJrUGLR1sjUtA', operationName: 'CreateRetweet' },
    DeleteRetweet: { queryId: 'iQtK4dl5hBmXewYZuEOKVw', operationName: 'DeleteRetweet' },
    CreateBookmark: { queryId: 'aoDbu3RHznuiSkQ9aNM67Q', operationName: 'CreateBookmark' },
    DeleteBookmark: { queryId: 'Wlmlj2-xzyS1GN3a6cj-mQ', operationName: 'DeleteBookmark' },
  };

  const REST = {
    friendshipsCreate: '/1.1/friendships/create.json',
    friendshipsDestroy: '/1.1/friendships/destroy.json',
    blocksCreate: '/1.1/blocks/create.json',
    blocksDestroy: '/1.1/blocks/destroy.json',
    mutesCreate: '/1.1/mutes/users/create.json',
    mutesDestroy: '/1.1/mutes/users/destroy.json',
    pinTweet: '/1.1/account/pin_tweet.json',
    unpinTweet: '/1.1/account/unpin_tweet.json',
    guestActivate: '/1.1/guest/activate.json',
    verifyCredentials: '/1.1/account/verify_credentials.json',
    dmNew: '/1.1/dm/new2.json',
    dmInbox: '/1.1/dm/inbox_initial_state.json',
    notificationsAll: '/2/notifications/all.json',
    guide: '/2/guide.json',
  };

  const DEFAULT_FEATURES = {
    rweb_video_screen_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: false,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: true,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false,
    responsive_web_profile_redirect_enabled: false,
  };

  const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function pickUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  function buildGraphQLUrl(queryId, operationName, variables, features = DEFAULT_FEATURES, fieldToggles) {
    const params = new URLSearchParams();
    params.set('variables', JSON.stringify(variables));
    params.set('features', JSON.stringify(features));
    if (fieldToggles) params.set('fieldToggles', JSON.stringify(fieldToggles));
    return `${GRAPHQL_BASE}/${queryId}/${operationName}?${params.toString()}`;
  }

  function extractTweetId(input) {
    if (!input) return null;
    if (/^\d+$/.test(String(input))) return String(input);
    const m = String(input).match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/);
    if (m) return m[1];
    const n = String(input).match(/status\/(\d+)/);
    return n ? n[1] : null;
  }

  function extractUsername(input) {
    if (!input) return null;
    const s = String(input).trim().replace(/^@/, '');
    if (/^[a-zA-Z0-9_]{1,15}$/.test(s)) return s;
    const m = String(input).match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})/);
    return m ? m[1] : null;
  }

  class HttpError extends Error {
    constructor(message, info = {}) {
      super(message);
      this.name = 'HttpError';
      this.status = info.status;
      this.code = info.code;
      this.endpoint = info.endpoint;
    }
  }

  class HttpClient {
    constructor(options = {}) {
      this._cookies = {};
      this._debug = !!options.debug;
      this._maxRetries = options.maxRetries ?? 1;
      this._fetch = options.fetch || globalThis.fetch;
      if (options.cookies) this.setCookies(options.cookies);
    }

    setCookies(cookieString) {
      if (typeof cookieString === 'string') {
        this._cookies = {};
        cookieString.split(';').forEach((p) => {
          const [k, ...rest] = p.split('=');
          if (!k) return;
          this._cookies[k.trim()] = rest.join('=').trim();
        });
      } else if (Array.isArray(cookieString)) {
        this._cookies = {};
        cookieString.forEach((c) => {
          if (c?.name) this._cookies[c.name] = c.value || '';
        });
      }
    }

    getCsrfToken() {
      return this._cookies.ct0 || '';
    }

    isAuthenticated() {
      return Boolean(this._cookies.auth_token);
    }

    getCookieString() {
      return Object.entries(this._cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    _buildHeaders(authenticated = true) {
      const headers = {
        authorization: `Bearer ${decodeURIComponent(BEARER_TOKEN)}`,
        'user-agent': pickUserAgent(),
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
      };
      if (authenticated && this.isAuthenticated()) {
        headers['x-csrf-token'] = this.getCsrfToken();
        headers['x-twitter-auth-type'] = 'OAuth2Session';
        headers.cookie = this.getCookieString();
      }
      return headers;
    }

    async request(url, options = {}) {
      const method = options.method || 'GET';
      const authenticated = options.authenticated !== false;
      const headers = { ...this._buildHeaders(authenticated), ...options.headers };
      const body = options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body;

      let lastError;
      for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
        try {
          const res = await this._fetch(url, { method, headers, body });
          if (this._debug) console.log(`[XActionsHttpClient] ${method} ${url} → ${res.status}`);

          if (res.status === 429) {
            const retryAfter = parseInt(res.headers?.get?.('retry-after') || '5', 10);
            if (attempt < this._maxRetries) {
              await sleep(retryAfter * 1000);
              continue;
            }
            throw new HttpError(`Rate limited on ${url}`, { status: 429, code: 'RATE_LIMIT', endpoint: url });
          }

          if (res.status === 401 || res.status === 403) {
            throw new HttpError(`Authentication failed (${res.status})`, { status: res.status, code: 'AUTH_REQUIRED', endpoint: url });
          }
          if (res.status === 404) {
            throw new HttpError('Not found', { status: 404, code: 'NOT_FOUND', endpoint: url });
          }

          const json = await res.json?.().catch(() => ({}));
          if (res.status >= 400) {
            const msg = json?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
            throw new HttpError(msg, { status: res.status, code: 'HTTP_ERROR', endpoint: url });
          }
          return json;
        } catch (err) {
          if (err instanceof HttpError) throw err;
          lastError = err;
          if (attempt < this._maxRetries) {
            await sleep(1000 + Math.random() * 500);
          }
        }
      }
      throw new HttpError(lastError?.message || 'Request failed', { code: 'NETWORK_ERROR', endpoint: url });
    }

    async graphql(queryId, operationName, variables, options = {}) {
      const features = options.features || DEFAULT_FEATURES;
      if (options.mutation) {
        const url = `${GRAPHQL_BASE}/${queryId}/${operationName}`;
        return this.request(url, {
          method: 'POST',
          body: { variables, features, queryId },
        });
      }
      const url = buildGraphQLUrl(queryId, operationName, variables, features, options.fieldToggles);
      return this.request(url);
    }

    async rest(path, options = {}) {
      const url = `${REST_BASE}${path}`;
      const method = options.method || 'POST';
      const headers = { 'content-type': 'application/x-www-form-urlencoded' };
      let body;
      if (options.body && typeof options.body === 'object') {
        body = new URLSearchParams(options.body).toString();
      } else {
        body = options.body;
      }
      return this.request(url, { method, headers, body });
    }

    async resolveUserId(username) {
      const clean = extractUsername(username);
      if (!clean) throw new HttpError('Invalid username', { code: 'INVALID_ARGS' });
      const data = await this.graphql(GRAPHQL.UserByScreenName.queryId, GRAPHQL.UserByScreenName.operationName, {
        screen_name: clean,
        withSafetyModeUserFields: true,
      });
      const user = data?.data?.user?.result;
      if (!user || user.__typename === 'UserUnavailable') {
        throw new HttpError(`User @${clean} not found`, { code: 'NOT_FOUND' });
      }
      return user.rest_id;
    }

    async getProfile(username) {
      const clean = extractUsername(username);
      if (!clean) throw new HttpError('Invalid username', { code: 'INVALID_ARGS' });
      const data = await this.graphql(GRAPHQL.UserByScreenName.queryId, GRAPHQL.UserByScreenName.operationName, {
        screen_name: clean,
        withSafetyModeUserFields: true,
      });
      const user = data?.data?.user?.result;
      if (!user || user.__typename === 'UserUnavailable') return null;
      const legacy = user.legacy || {};
      return {
        id: user.rest_id,
        username: legacy.screen_name || clean,
        displayName: legacy.name || clean,
        bio: legacy.description || '',
        followersCount: legacy.followers_count || 0,
        followingCount: legacy.friends_count || 0,
        tweetsCount: legacy.statuses_count || 0,
        isVerified: legacy.verified || false,
      };
    }

    async getTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      const data = await this.graphql(GRAPHQL.TweetDetail.queryId, GRAPHQL.TweetDetail.operationName, {
        focalTweetId: id,
        with_rux_injections: false,
        includePromotedContent: false,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
        withV2Timeline: true,
      });
      const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions;
      if (instructions) {
        for (const instruction of instructions) {
          if (instruction.type !== 'TimelineAddEntries') continue;
          for (const entry of instruction.entries || []) {
            if (!entry.entryId?.startsWith('tweet-')) continue;
            const result = entry.content?.itemContent?.tweet_results?.result;
            if (result) {
              const t = result.tweet || result;
              return this._tweetFromGraphQL(t, id);
            }
          }
        }
      }
      const direct = data?.data?.tweetResult?.result;
      if (direct) return this._tweetFromGraphQL(direct, id);
      return null;
    }

    async *searchTweets(query, count = 20) {
      let yielded = 0;
      let cursor = null;
      while (yielded < count) {
        const variables = {
          rawQuery: query,
          count: Math.min(count - yielded, 20),
          querySource: 'typed_query',
          product: 'Latest',
        };
        if (cursor) variables.cursor = cursor;
        const data = await this.graphql(GRAPHQL.SearchTimeline.queryId, GRAPHQL.SearchTimeline.operationName, variables);
        const timeline = data?.data?.search_by_raw_query?.search_timeline?.timeline;
        const instructions = timeline?.instructions || [];
        let found = 0;
        for (const instruction of instructions) {
          const entries = instruction.entries || [];
          for (const entry of entries) {
            const tweet = this._extractTweetFromEntry(entry);
            if (tweet) {
              yield tweet;
              yielded++;
              found++;
              if (yielded >= count) return;
            }
          }
        }
        const bottom = instructions
          .flatMap((i) => i.entries || [])
          .find((e) => e.entryId?.startsWith('cursor-bottom'));
        cursor = bottom?.content?.value || bottom?.content?.itemContent?.value || null;
        if (!cursor || !found) return;
        await sleep(1000 + Math.random() * 1000);
      }
    }

    _extractTweetFromEntry(entry) {
      const result = entry?.content?.itemContent?.tweet_results?.result;
      if (!result) return null;
      const t = result.tweet || result;
      return this._tweetFromGraphQL(t);
    }

    _tweetFromGraphQL(result, fallbackId) {
      const t = result.tweet || result;
      const legacy = t.legacy || {};
      const author = t.core?.user_results?.result?.legacy || {};
      return {
        id: t.rest_id || legacy.id_str || fallbackId,
        text: legacy.full_text || legacy.text || '',
        authorId: t.core?.user_results?.result?.rest_id,
        authorUsername: author.screen_name,
        authorName: author.name,
        createdAt: legacy.created_at,
        likeCount: legacy.favorite_count || 0,
        retweetCount: legacy.retweet_count || 0,
        replyCount: legacy.reply_count || 0,
      };
    }

    async likeTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.graphql(GRAPHQL.FavoriteTweet.queryId, GRAPHQL.FavoriteTweet.operationName, { tweet_id: id }, { mutation: true });
    }

    async unlikeTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.graphql(GRAPHQL.UnfavoriteTweet.queryId, GRAPHQL.UnfavoriteTweet.operationName, { tweet_id: id }, { mutation: true });
    }

    async retweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.graphql(GRAPHQL.CreateRetweet.queryId, GRAPHQL.CreateRetweet.operationName, { tweet_id: id, dark_request: false }, { mutation: true });
    }

    async unretweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.graphql(GRAPHQL.DeleteRetweet.queryId, GRAPHQL.DeleteRetweet.operationName, { source_tweet_id: id, dark_request: false }, { mutation: true });
    }

    async bookmarkTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.graphql(GRAPHQL.CreateBookmark.queryId, GRAPHQL.CreateBookmark.operationName, { tweet_id: id }, { mutation: true });
    }

    async unbookmarkTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.graphql(GRAPHQL.DeleteBookmark.queryId, GRAPHQL.DeleteBookmark.operationName, { tweet_id: id }, { mutation: true });
    }

    async sendTweet(text, options = {}) {
      const variables = {
        tweet_text: text,
        dark_request: false,
        media: { media_entities: (options.mediaIds || []).map((id) => ({ media_id: id, tagged_users: [] })), possibly_sensitive: false },
        semantic_annotation_ids: [],
      };
      if (options.replyTo) {
        variables.reply = { in_reply_to_tweet_id: options.replyTo, exclude_reply_user_ids: [] };
      }
      const data = await this.graphql(GRAPHQL.CreateTweet.queryId, GRAPHQL.CreateTweet.operationName, variables, { mutation: true });
      const result = data?.data?.create_tweet?.tweet_results?.result;
      if (!result) throw new HttpError('Create tweet failed', { code: 'TWITTER_ERROR' });
      return this._tweetFromGraphQL(result);
    }

    async sendQuoteTweet(text, quotedTweetId, mediaIds = []) {
      const variables = {
        tweet_text: text,
        dark_request: false,
        attachment_url: `https://x.com/i/status/${extractTweetId(quotedTweetId)}`,
        media: { media_entities: mediaIds.map((id) => ({ media_id: id, tagged_users: [] })), possibly_sensitive: false },
        semantic_annotation_ids: [],
      };
      const data = await this.graphql(GRAPHQL.CreateTweet.queryId, GRAPHQL.CreateTweet.operationName, variables, { mutation: true });
      const result = data?.data?.create_tweet?.tweet_results?.result;
      if (!result) throw new HttpError('Create quote tweet failed', { code: 'TWITTER_ERROR' });
      return this._tweetFromGraphQL(result);
    }

    async deleteTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.graphql(GRAPHQL.DeleteTweet.queryId, GRAPHQL.DeleteTweet.operationName, { tweet_id: id, dark_request: false }, { mutation: true });
    }

    async followUser(username) {
      const userId = await this.resolveUserId(username);
      return this.rest(REST.friendshipsCreate, {
        body: { include_profile_interstitial_type: '1', skip_status: 'true', user_id: userId },
      });
    }

    async unfollowUser(username) {
      const userId = await this.resolveUserId(username);
      return this.rest(REST.friendshipsDestroy, {
        body: { include_profile_interstitial_type: '1', skip_status: 'true', user_id: userId },
      });
    }

    async followByUserId(userId) {
      return this.rest(REST.friendshipsCreate, {
        body: { include_profile_interstitial_type: '1', skip_status: 'true', user_id: userId },
      });
    }

    async unfollowByUserId(userId) {
      return this.rest(REST.friendshipsDestroy, {
        body: { include_profile_interstitial_type: '1', skip_status: 'true', user_id: userId },
      });
    }

    async blockUser(username) {
      const userId = await this.resolveUserId(username);
      return this.rest(REST.blocksCreate, { body: { user_id: userId } });
    }

    async unblockUser(username) {
      const userId = await this.resolveUserId(username);
      return this.rest(REST.blocksDestroy, { body: { user_id: userId } });
    }

    async muteUser(username) {
      const userId = await this.resolveUserId(username);
      return this.rest(REST.mutesCreate, { body: { user_id: userId } });
    }

    async unmuteUser(username) {
      const userId = await this.resolveUserId(username);
      return this.rest(REST.mutesDestroy, { body: { user_id: userId } });
    }

    async pinTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.rest(REST.pinTweet, { body: { id, tweet_mode: 'extended' } });
    }

    async unpinTweet(tweetId) {
      const id = extractTweetId(tweetId);
      if (!id) throw new HttpError('Invalid tweet id', { code: 'INVALID_ARGS' });
      return this.rest(REST.unpinTweet, { body: { id, tweet_mode: 'extended' } });
    }
  }

  globalThis.XActionsHttpClient = {
    HttpClient,
    extractTweetId,
    extractUsername,
    HttpError,
    GRAPHQL,
    REST,
  };
})();
