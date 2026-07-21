// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * Backend AI assistant — chat loop with tools → Operation queue.
 * @module api/services/agent/assistantService
 */

import { PrismaClient } from '@prisma/client';
import { chatCompletion, resolveLlmConfig } from './llmClient.js';
import {
  TOOL_DEFINITIONS,
  systemPrompt,
  executeTool,
} from './tools.js';

const prisma = new PrismaClient();
const MAX_TOOL_ROUNDS = 6;

const DEFAULT_PERSONA = {
  name: 'XActions Operator Assistant',
  tone: 'concise, safety-first, bilingual VI/EN',
  niche: 'X/Twitter growth automation',
};

const DEFAULT_SAFETY = {
  maxActionsPerTurn: 20,
  dryRunDefault: true,
};

/**
 * @param {string} userId
 * @param {{ message: string, threadId?: string, persona?: object, safety?: object, llm?: object }} input
 */
export async function runChat(userId, input) {
  const userMessage = String(input.message || '').trim();
  if (!userMessage) {
    throw Object.assign(new Error('message required'), { status: 400 });
  }

  const llmConfig = resolveLlmConfig(input.llm || {});
  const persona = { ...DEFAULT_PERSONA, ...(input.persona || {}) };
  const safety = { ...DEFAULT_SAFETY, ...(input.safety || {}) };

  let threadId = input.threadId || null;
  if (threadId) {
    const existing = await prisma.agentThread.findFirst({
      where: { id: threadId, userId },
    });
    if (!existing) {
      throw Object.assign(new Error('Thread not found'), { status: 404 });
    }
  } else {
    const title =
      userMessage.length > 48 ? `${userMessage.slice(0, 48)}…` : userMessage;
    const thread = await prisma.agentThread.create({
      data: { userId, title },
    });
    threadId = thread.id;
  }

  // Load history (user/assistant only for context budget)
  const prior = await prisma.agentMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });

  await prisma.agentMessage.create({
    data: {
      threadId,
      role: 'user',
      content: userMessage,
    },
  });

  const history = prior
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
    { role: 'system', content: systemPrompt(persona, safety) },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const toolTrace = [];
  const operationIds = [];
  let rounds = 0;
  let finalContent = '';

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const result = await chatCompletion(
      llmConfig,
      messages,
      TOOL_DEFINITIONS,
      { temperature: 0.55, maxTokens: 1400 },
    );

    const msg = result.message;
    messages.push(normalizeAssistantMessage(msg));

    const toolCalls = msg.tool_calls || [];
    if (!toolCalls.length) {
      finalContent = (msg.content || '').trim();
      break;
    }

    for (const call of toolCalls) {
      const name = call.function?.name || call.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || call.arguments || '{}');
      } catch {
        args = {};
      }

      let toolResult;
      try {
        toolResult = await executeTool(name, args, {
          userId,
          persona,
          safety,
          llmConfig,
        });
      } catch (err) {
        toolResult = { error: err.message || String(err) };
      }

      if (toolResult?.operationId) {
        operationIds.push(toolResult.operationId);
      }

      toolTrace.push({
        name,
        args: redactArgs(args),
        result: summarizeResult(toolResult),
      });

      messages.push({
        role: 'tool',
        tool_call_id: call.id || `call_${name}_${rounds}`,
        content: JSON.stringify(toolResult).slice(0, 12000),
      });
    }
  }

  if (!finalContent) {
    finalContent =
      toolTrace.length > 0
        ? 'Đã chạy tools — xem operation / tool results.'
        : '(no reply)';
  }

  await prisma.agentMessage.create({
    data: {
      threadId,
      role: 'assistant',
      content: finalContent,
      toolTrace: toolTrace.length ? JSON.stringify(toolTrace) : null,
    },
  });

  await prisma.agentThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  return {
    ok: true,
    threadId,
    content: finalContent,
    toolTrace,
    operationIds,
    model: llmConfig.model,
    provider: llmConfig.provider,
  };
}

/**
 * @param {string} userId
 */
export async function listThreads(userId, limit = 20) {
  const threads = await prisma.agentThread.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 50),
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  return threads.map((t) => ({
    id: t.id,
    title: t.title,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    messageCount: t._count.messages,
  }));
}

/**
 * @param {string} userId
 * @param {string} threadId
 */
export async function getThread(userId, threadId) {
  const thread = await prisma.agentThread.findFirst({
    where: { id: threadId, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 100 },
    },
  });
  if (!thread) {
    throw Object.assign(new Error('Thread not found'), { status: 404 });
  }
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolTrace: m.toolTrace ? safeJson(m.toolTrace) : null,
      createdAt: m.createdAt,
    })),
  };
}

export function listToolsCatalog() {
  return TOOL_DEFINITIONS.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

function normalizeAssistantMessage(msg) {
  const out = { role: 'assistant', content: msg.content || null };
  if (msg.tool_calls?.length) out.tool_calls = msg.tool_calls;
  return out;
}

function redactArgs(args) {
  if (!args || typeof args !== 'object') return args;
  const out = { ...args };
  for (const k of Object.keys(out)) {
    if (/cookie|token|password|secret/i.test(k)) out[k] = '[REDACTED]';
  }
  return out;
}

function summarizeResult(result) {
  if (!result || typeof result !== 'object') return result;
  const json = JSON.stringify(result);
  if (json.length <= 800) return result;
  return {
    ...result,
    _truncated: true,
    _note: 'result truncated in toolTrace',
  };
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export default {
  runChat,
  listThreads,
  getThread,
  listToolsCatalog,
  DEFAULT_PERSONA,
  DEFAULT_SAFETY,
};
