// Phase B — agent tools catalog + system prompt (no Prisma/LLM network)
// node --test tests/api/agentTools.test.js
// by nichxbt

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('agent tools module (source contract)', () => {
  const toolsSrc = fs.readFileSync(
    path.join(root, 'api/services/agent/tools.js'),
    'utf8',
  );
  const llmSrc = fs.readFileSync(
    path.join(root, 'api/services/agent/llmClient.js'),
    'utf8',
  );
  const asstSrc = fs.readFileSync(
    path.join(root, 'api/services/agent/assistantService.js'),
    'utf8',
  );
  const routesSrc = fs.readFileSync(
    path.join(root, 'api/routes/assistantChat.js'),
    'utf8',
  );
  const serverSrc = fs.readFileSync(path.join(root, 'api/server.js'), 'utf8');
  const uiSrc = fs.readFileSync(
    path.join(root, 'dashboard/operator.html'),
    'utf8',
  );

  it('defines server tools for sessions and operations', () => {
    for (const name of [
      'list_sessions',
      'list_operations',
      'start_operation',
      'cancel_operation',
      'draft_tweet',
      'draft_reply',
    ]) {
      assert.ok(toolsSrc.includes(`name: '${name}'`), `missing tool ${name}`);
    }
  });

  it('maps aliases to operation types', () => {
    assert.ok(toolsSrc.includes('autoLiker: \'autoLike\''));
    assert.ok(toolsSrc.includes('smartUnfollow: \'unfollowNonFollowers\''));
  });

  it('system prompt prefers dryRun and Operation path', () => {
    assert.ok(toolsSrc.includes('function systemPrompt'));
    assert.ok(toolsSrc.includes('dryRun'));
    assert.ok(toolsSrc.includes('Operations') || toolsSrc.includes('Operation'));
  });

  it('llm client supports xai and grok-4.5', () => {
    assert.ok(llmSrc.includes('api.x.ai'));
    assert.ok(llmSrc.includes('grok-4.5'));
    assert.ok(llmSrc.includes('XAI_API_KEY'));
  });

  it('assistant service runs tool loop and persists messages', () => {
    assert.ok(asstSrc.includes('MAX_TOOL_ROUNDS'));
    assert.ok(asstSrc.includes('agentMessage.create'));
    assert.ok(asstSrc.includes('enqueueOperation') || toolsSrc.includes('enqueueOperation'));
  });

  it('routes mount chat under /api/agent', () => {
    assert.ok(routesSrc.includes("router.post('/chat'"));
    assert.ok(routesSrc.includes("router.get('/threads'"));
    assert.ok(serverSrc.includes('assistantChatRoutes'));
  });

  it('operator UI posts to /agent/chat', () => {
    assert.ok(uiSrc.includes('/agent/chat'));
    assert.ok(uiSrc.includes('btnChatSend'));
    assert.ok(uiSrc.includes('chatLog'));
  });
});
