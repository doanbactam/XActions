// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * Backend AI assistant chat (Phase B) — mount under /api/agent
 *
 * POST /api/agent/chat
 * GET  /api/agent/threads
 * GET  /api/agent/threads/:id
 * GET  /api/agent/tools
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  runChat,
  listThreads,
  getThread,
  listToolsCatalog,
} from '../services/agent/assistantService.js';

const router = express.Router();

router.get('/tools', authMiddleware, (_req, res) => {
  res.json({ tools: listToolsCatalog() });
});

router.get('/threads', authMiddleware, async (req, res) => {
  try {
    const threads = await listThreads(req.user.id);
    res.json({ success: true, threads });
  } catch (err) {
    console.error('❌ list threads:', err.message);
    res.status(500).json({ error: err.message || 'Failed to list threads' });
  }
});

router.get('/threads/:id', authMiddleware, async (req, res) => {
  try {
    const thread = await getThread(req.user.id, req.params.id);
    res.json({ success: true, thread });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to get thread' });
  }
});

router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, threadId, persona, safety, llm } = req.body || {};
    const result = await runChat(req.user.id, {
      message,
      threadId,
      persona,
      safety,
      llm,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('❌ agent chat:', err.message);
    res.status(status).json({
      ok: false,
      error: err.message || 'Agent chat failed',
    });
  }
});

export default router;
