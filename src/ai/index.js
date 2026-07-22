// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * XActions AI Module — Public API
 *
 * AI tweet generation and content optimization.
 *
 * @author nich (@nichxbt) - https://github.com/nirholas
 */

export {
  generateTweet,
  generateThread,
  rewriteTweet,
  generateWeek,
  generateReply,
} from './tweetGenerator.js';

// Content Optimizer
export { suggestHashtags, optimizeTweet, predictPerformance, generateVariations } from './contentOptimizer.js';
