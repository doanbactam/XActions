// Bundle entry point for the extension HTTP client.
// Re-exports the shared src/scrapers/twitter/http modules so the service
// worker can import a single IIFE file via importScripts.
// by nichxbt

import { TwitterHttpClient, WaitingRateLimitStrategy, ErrorRateLimitStrategy } from '../../src/scrapers/twitter/http/client.js';
import * as engagement from '../../src/scrapers/twitter/http/engagement.js';
import * as profile from '../../src/scrapers/twitter/http/profile.js';
import * as tweets from '../../src/scrapers/twitter/http/tweets.js';
import * as search from '../../src/scrapers/twitter/http/search.js';
import * as actions from '../../src/scrapers/twitter/http/actions.js';
import {
  TwitterApiError,
  RateLimitError,
  AuthError,
  NotFoundError,
  NetworkError,
  parseTwitterErrors,
} from '../../src/scrapers/twitter/http/errors.js';

globalThis.XActionsHttpClient = {
  TwitterHttpClient,
  WaitingRateLimitStrategy,
  ErrorRateLimitStrategy,

  errors: {
    TwitterApiError,
    RateLimitError,
    AuthError,
    NotFoundError,
    NetworkError,
    parseTwitterErrors,
  },

  parseTweetData: tweets.parseTweetData,
  parseTimelineInstructions: tweets.parseTimelineInstructions,

  scrapeProfile: profile.scrapeProfile,
  scrapeTweetById: tweets.scrapeTweetById,
  searchTweets: search.searchTweets,

  likeTweet: engagement.likeTweet,
  unlikeTweet: engagement.unlikeTweet,
  retweet: engagement.retweet,
  unretweet: engagement.unretweet,
  bookmarkTweet: engagement.bookmarkTweet,
  unbookmarkTweet: engagement.unbookmarkTweet,
  followUser: engagement.followUser,
  unfollowUser: engagement.unfollowUser,
  followByUsername: engagement.followByUsername,
  blockUser: engagement.blockUser,
  unblockUser: engagement.unblockUser,
  muteUser: engagement.muteUser,
  unmuteUser: engagement.unmuteUser,
  pinTweet: engagement.pinTweet,
  unpinTweet: engagement.unpinTweet,

  postTweet: actions.postTweet,
  replyToTweet: actions.replyToTweet,
  quoteTweet: actions.quoteTweet,
  deleteTweet: actions.deleteTweet,
  postThread: actions.postThread,
  schedulePost: actions.schedulePost,
};
