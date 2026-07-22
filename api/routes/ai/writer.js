// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * AI Tweet Writer API Routes
 *
 * AI-powered tweet generation without voice analysis.
 *
 * POST /api/ai/writer/generate — generate tweets
 * POST /api/ai/writer/rewrite — improve an existing tweet
 * POST /api/ai/writer/calendar — generate weekly content calendar
 * POST /api/ai/writer/reply — generate a reply to a tweet
 *
 * Rate limit: 10 generations/minute for free tier.
 *
 * @author nich (@nichxbt) - https://github.com/nirholas
 * @license MIT
 */

import express from 'express';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// ============================================================================
// Rate Limiting — 10 generations/minute
// ============================================================================

const generationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Maximum 10 AI generations per minute. Please wait.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function handleGenerationError(error, res, defaultError) {
  if (error.message?.includes('OpenRouter API key required')) {
    return res.status(400).json({
      error: 'AI_API_KEY_REQUIRED',
      message: error.message,
      hint: 'Pass an OpenRouter apiKey in the request or set OPENROUTER_API_KEY on the server',
    });
  }
  res.status(500).json({
    error: defaultError,
    message: error.message,
  });
}

// ============================================================================
// Routes
// ============================================================================

/**
 * Generate tweets
 * POST /api/ai/writer/generate
 *
 * Body: { topic, style?, count?, type?, threadLength?, model?, apiKey? }
 * type: 'tweet' | 'thread'
 */
router.post('/generate', generationLimiter, async (req, res) => {
  try {
    const {
      topic, style, count = 3,
      type = 'tweet', threadLength = 5,
      model, apiKey,
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const {
      generateTweet,
      generateThread,
    } = await import('../../src/ai/tweetGenerator.js');

    let result;
    if (type === 'thread') {
      result = await generateThread({ topic, length: threadLength, style, model, apiKey });
      res.json({
        success: true,
        data: result,
        operation: 'ai:generate-thread',
      });
    } else {
      result = await generateTweet({ topic, style, count, model, apiKey });
      res.json({
        success: true,
        data: result,
        operation: 'ai:generate-tweet',
      });
    }
  } catch (error) {
    handleGenerationError(error, res, 'Generation failed');
  }
});

/**
 * Rewrite/improve an existing tweet
 * POST /api/ai/writer/rewrite
 *
 * Body: { text, goal?, count?, style?, model?, apiKey? }
 */
router.post('/rewrite', generationLimiter, async (req, res) => {
  try {
    const {
      text, goal = 'more_engaging', count = 3,
      style, model, apiKey,
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required — the tweet to rewrite' });
    }

    const { rewriteTweet } = await import('../../src/ai/tweetGenerator.js');
    const result = await rewriteTweet(text, { goal, count, style, model, apiKey });

    res.json({
      success: true,
      data: result,
      operation: 'ai:rewrite-tweet',
    });
  } catch (error) {
    handleGenerationError(error, res, 'Rewrite failed');
  }
});

/**
 * Generate weekly content calendar
 * POST /api/ai/writer/calendar
 *
 * Body: { topics?, postsPerDay?, days?, style?, model?, apiKey? }
 */
router.post('/calendar', generationLimiter, async (req, res) => {
  try {
    const {
      topics, postsPerDay = 2, days = 7,
      style, model, apiKey,
    } = req.body;

    const { generateWeek } = await import('../../src/ai/tweetGenerator.js');
    const result = await generateWeek({ topics, postsPerDay, days, style, model, apiKey });

    res.json({
      success: true,
      data: result,
      operation: 'ai:generate-calendar',
    });
  } catch (error) {
    handleGenerationError(error, res, 'Calendar generation failed');
  }
});

/**
 * Generate reply to a tweet
 * POST /api/ai/writer/reply
 *
 * Body: { originalTweet, tone?, count?, style?, model?, apiKey? }
 */
router.post('/reply', generationLimiter, async (req, res) => {
  try {
    const {
      originalTweet, tone, count = 3,
      style, model, apiKey,
    } = req.body;

    if (!originalTweet) {
      return res.status(400).json({ error: 'originalTweet is required — the tweet to reply to' });
    }

    const { generateReply } = await import('../../src/ai/tweetGenerator.js');
    const result = await generateReply(originalTweet, { tone, count, style, model, apiKey });

    res.json({
      success: true,
      data: result,
      operation: 'ai:generate-reply',
    });
  } catch (error) {
    handleGenerationError(error, res, 'Reply generation failed');
  }
});

export default router;
