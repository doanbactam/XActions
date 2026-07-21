// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * Operations API — all long jobs enqueue via operationService (Operation + Bull).
 * Session cookies resolved from encrypted XSession (Phase A).
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  enqueueOperation,
  listOperations,
  getOperationForUser,
  cancelOperationForUser,
  OPERATION_TYPES,
} from '../services/operationService.js';

const router = express.Router();
router.use(authMiddleware);

function sendErr(res, err, fallback) {
  const status = err.status || 500;
  if (status >= 500) console.error(`❌ ${fallback}:`, err.message);
  return res.status(status).json({ error: err.message || fallback });
}

/**
 * POST /api/operations
 * Generic enqueue: { type, config?, sessionId? }
 */
router.post('/', async (req, res) => {
  try {
    const { type, config = {}, sessionId } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type,
      config,
      sessionId,
    });
    return res.status(201).json(result);
  } catch (err) {
    return sendErr(res, err, 'Failed to enqueue operation');
  }
});

/**
 * GET /api/operations/types — whitelist
 */
router.get('/types', (_req, res) => {
  res.json({ types: OPERATION_TYPES });
});

// ── Typed aliases (backward compatible) ──────────────────────────

router.post('/unfollow-non-followers', async (req, res) => {
  try {
    const { maxUnfollows = 100, dryRun = false, sessionId } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type: 'unfollowNonFollowers',
      sessionId,
      config: { maxUnfollows, dryRun },
    });
    return res.json({
      ...result,
      message: 'Unfollow operation queued successfully',
    });
  } catch (err) {
    return sendErr(res, err, 'Failed to start unfollow operation');
  }
});

router.post('/unfollow-everyone', async (req, res) => {
  try {
    const { maxUnfollows = 100, dryRun = false, sessionId } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type: 'unfollowEveryone',
      sessionId,
      config: { maxUnfollows, dryRun },
    });
    return res.json({
      ...result,
      message: 'Unfollow everyone operation queued successfully',
    });
  } catch (err) {
    return sendErr(res, err, 'Failed to start unfollow operation');
  }
});

router.post('/detect-unfollowers', async (req, res) => {
  try {
    const { sessionId, maxUsers } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type: 'detectUnfollowers',
      sessionId,
      config: { maxUsers },
    });
    return res.json({
      ...result,
      message: 'Detect unfollowers operation queued successfully',
    });
  } catch (err) {
    return sendErr(res, err, 'Failed to start detect operation');
  }
});

router.post('/auto-like', async (req, res) => {
  try {
    const { sessionId, ...config } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type: 'autoLike',
      sessionId,
      config,
    });
    return res.json({ ...result, message: 'Auto-like queued' });
  } catch (err) {
    return sendErr(res, err, 'Failed to start auto-like');
  }
});

router.post('/keyword-follow', async (req, res) => {
  try {
    const { sessionId, ...config } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type: 'keywordFollow',
      sessionId,
      config,
    });
    return res.json({ ...result, message: 'Keyword follow queued' });
  } catch (err) {
    return sendErr(res, err, 'Failed to start keyword follow');
  }
});

router.post('/follow-engagers', async (req, res) => {
  try {
    const { sessionId, ...config } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type: 'followEngagers',
      sessionId,
      config,
    });
    return res.json({ ...result, message: 'Follow engagers queued' });
  } catch (err) {
    return sendErr(res, err, 'Failed to start follow engagers');
  }
});

router.post('/auto-comment', async (req, res) => {
  try {
    const { sessionId, ...config } = req.body || {};
    const result = await enqueueOperation({
      userId: req.user.id,
      type: 'autoComment',
      sessionId,
      config,
    });
    return res.json({ ...result, message: 'Auto-comment queued' });
  } catch (err) {
    return sendErr(res, err, 'Failed to start auto-comment');
  }
});

// ── Status / cancel / list ───────────────────────────────────────

router.get('/status/:operationId', async (req, res) => {
  try {
    const operation = await getOperationForUser(
      req.user.id,
      req.params.operationId,
    );
    return res.json(operation);
  } catch (err) {
    return sendErr(res, err, 'Failed to fetch operation status');
  }
});

router.get('/:operationId', async (req, res) => {
  // Avoid capturing "types" etc. — only cuid-like ids
  if (req.params.operationId === 'types') {
    return res.json({ types: OPERATION_TYPES });
  }
  try {
    const operation = await getOperationForUser(
      req.user.id,
      req.params.operationId,
    );
    return res.json(operation);
  } catch (err) {
    return sendErr(res, err, 'Failed to fetch operation');
  }
});

router.post('/cancel/:operationId', async (req, res) => {
  try {
    const result = await cancelOperationForUser(
      req.user.id,
      req.params.operationId,
    );
    return res.json(result);
  } catch (err) {
    return sendErr(res, err, 'Failed to cancel operation');
  }
});

router.post('/:operationId/cancel', async (req, res) => {
  try {
    const result = await cancelOperationForUser(
      req.user.id,
      req.params.operationId,
    );
    return res.json(result);
  } catch (err) {
    return sendErr(res, err, 'Failed to cancel operation');
  }
});

router.get('/', async (req, res) => {
  try {
    const { page, limit, status, type } = req.query;
    const result = await listOperations(req.user.id, {
      page,
      limit,
      status,
      type,
    });
    return res.json({
      operations: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit) || 1,
      },
    });
  } catch (err) {
    return sendErr(res, err, 'Failed to fetch operations');
  }
});

export default router;
