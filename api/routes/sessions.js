// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * X Session API — encrypted cookie store (Phase A).
 *
 * POST   /api/sessions          — create (encrypt cookie)
 * GET    /api/sessions          — list metadata only
 * GET    /api/sessions/:id      — one session metadata
 * DELETE /api/sessions/:id      — revoke/wipe
 *
 * @module api/routes/sessions
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.js';
import {
  createSession,
  listSessions,
  getSessionForUser,
  revokeSession,
} from '../services/xSessionService.js';
import { toPublicSession } from '../utils/xSessionPublic.js';

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/sessions
 * Body: { sessionCookie, username?, label? }
 */
router.post(
  '/',
  [
    body('sessionCookie').isString().notEmpty().withMessage('sessionCookie required'),
    body('username').optional().isString(),
    body('label').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const session = await createSession(req.user.id, {
        sessionCookie: req.body.sessionCookie,
        username: req.body.username,
        label: req.body.label,
      });

      return res.status(201).json({
        success: true,
        session,
        message: 'X session stored encrypted',
      });
    } catch (err) {
      const status = err.status || 500;
      console.error('❌ create session:', err.message);
      return res.status(status).json({ error: err.message || 'Failed to save session' });
    }
  },
);

/**
 * GET /api/sessions
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await listSessions(req.user.id);
    return res.json({ success: true, sessions });
  } catch (err) {
    console.error('❌ list sessions:', err.message);
    return res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/sessions/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const row = await getSessionForUser(req.user.id, req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json({ success: true, session: toPublicSession(row) });
  } catch (err) {
    console.error('❌ get session:', err.message);
    return res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * DELETE /api/sessions/:id — revoke / wipe encrypted cookie
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await revokeSession(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error('❌ revoke session:', err.message);
    return res.status(status).json({ error: err.message || 'Failed to revoke session' });
  }
});

export default router;
