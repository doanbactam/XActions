// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * Server-side assistant tools → Operation / sessions (Phase B).
 * @module api/services/agent/tools
 */

import {
  enqueueOperation,
  listOperations,
  getOperationForUser,
  cancelOperationForUser,
  OPERATION_TYPES,
} from '../operationService.js';
import { listSessions } from '../xSessionService.js';
import { chatCompletion } from './llmClient.js';

/** Map friendly automation ids → operation types */
export const AUTOMATION_TO_OPERATION = {
  autoLiker: 'autoLike',
  autoLike: 'autoLike',
  smartUnfollow: 'unfollowNonFollowers',
  unfollowNonFollowers: 'unfollowNonFollowers',
  unfollowEveryone: 'unfollowEveryone',
  keywordFollow: 'keywordFollow',
  followEngagers: 'followEngagers',
  autoCommenter: 'autoComment',
  autoComment: 'autoComment',
  unfollowerDetector: 'detectUnfollowers',
  detectUnfollowers: 'detectUnfollowers',
};

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_sessions',
      description: 'List encrypted X sessions (metadata only) for this operator.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_operation_types',
      description: 'List allowed backend operation types that can be enqueued.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_operations',
      description: 'List recent operations and their status.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          status: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_operation',
      description: 'Get one operation by id (progress/result summary).',
      parameters: {
        type: 'object',
        properties: { operationId: { type: 'string' } },
        required: ['operationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_operation',
      description:
        'Enqueue a backend automation job (creates Operation + queue). Prefer dryRun for destructive types.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: `One of: ${OPERATION_TYPES.join(', ')} or aliases like autoLiker, smartUnfollow`,
          },
          sessionId: { type: 'string' },
          dryRun: { type: 'boolean' },
          maxUnfollows: { type: 'number' },
          maxUsers: { type: 'number' },
          maxActions: { type: 'number' },
          keywords: { type: 'string', description: 'Comma-separated keywords if needed' },
          config: { type: 'object' },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_operation',
      description: 'Cancel a pending/running operation.',
      parameters: {
        type: 'object',
        properties: { operationId: { type: 'string' } },
        required: ['operationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_tweet',
      description: 'Draft a tweet in persona voice. Does NOT post.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          style: { type: 'string' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_reply',
      description: 'Draft a short reply. Does NOT post.',
      parameters: {
        type: 'object',
        properties: {
          author: { type: 'string' },
          tweetText: { type: 'string' },
        },
        required: ['author', 'tweetText'],
      },
    },
  },
];

export function systemPrompt(persona = {}, safety = {}) {
  const name = persona.name || 'XActions Operator Assistant';
  const tone = persona.tone || 'concise, helpful, safety-first';
  const max = safety.maxActionsPerTurn || 20;
  return [
    `You are ${name}, a backend AI assistant for X/Twitter automation (SaaS).`,
    `Tone: ${tone}.`,
    'You run on the server. Clients only chat — you enqueue durable Operations.',
    '',
    'Tools: list/create sessions metadata, start/cancel operations, draft content.',
    `Safety: prefer dryRun=true for unfollow/mass actions; cap maxActions ~${max}.`,
    'Never claim you posted a tweet unless a future post tool confirms it.',
    'Draft tools only return text with posted:false.',
    'When starting jobs, report operationId and status queued.',
    'Be short and clear in Vietnamese or English matching the user.',
  ].join('\n');
}

/**
 * @param {string} name
 * @param {object} args
 * @param {{ userId: string, persona?: object, safety?: object, llmConfig?: object }} ctx
 */
export async function executeTool(name, args, ctx) {
  const a = args || {};
  const userId = ctx.userId;
  if (!userId) return { error: 'userId missing' };

  switch (name) {
    case 'list_sessions': {
      const sessions = await listSessions(userId);
      return { sessions };
    }
    case 'list_operation_types':
      return { types: OPERATION_TYPES, aliases: AUTOMATION_TO_OPERATION };

    case 'list_operations': {
      const result = await listOperations(userId, {
        limit: a.limit || 15,
        status: a.status,
        type: a.type,
      });
      return {
        total: result.total,
        operations: result.items.map((o) => ({
          id: o.id,
          type: o.type,
          status: o.status,
          sessionId: o.sessionId,
          createdAt: o.createdAt,
          error: o.error,
        })),
      };
    }

    case 'get_operation': {
      if (!a.operationId) return { error: 'operationId required' };
      const op = await getOperationForUser(userId, a.operationId);
      return {
        id: op.id,
        type: op.type,
        status: op.status,
        liveStatus: op.liveStatus,
        progress: op.progress,
        result: safeParse(op.result),
        error: op.error,
        sessionId: op.sessionId,
      };
    }

    case 'start_operation': {
      const rawType = a.type || a.automationId;
      const type = AUTOMATION_TO_OPERATION[rawType] || rawType;
      if (!OPERATION_TYPES.includes(type)) {
        return { error: `Unknown type: ${rawType}`, allowed: OPERATION_TYPES };
      }

      const maxCap = ctx.safety?.maxActionsPerTurn || 20;
      const config = {
        ...(a.config || {}),
        dryRun:
          a.dryRun !== undefined
            ? !!a.dryRun
            : type.includes('unfollow') || type === 'unfollowEveryone'
              ? true
              : a.config?.dryRun,
        maxUnfollows: Math.min(
          Number(a.maxUnfollows || a.maxActions || a.config?.maxUnfollows || 15),
          maxCap,
        ),
        maxUsers: Math.min(
          Number(a.maxUsers || a.maxActions || a.config?.maxUsers || 50),
          200,
        ),
        maxActions: Math.min(
          Number(a.maxActions || a.config?.maxActions || 15),
          maxCap,
        ),
      };
      if (a.keywords) {
        config.keywords = String(a.keywords)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const result = await enqueueOperation({
        userId,
        type,
        sessionId: a.sessionId,
        config,
      });
      return { ...result, note: 'Job queued on backend workers' };
    }

    case 'cancel_operation': {
      if (!a.operationId) return { error: 'operationId required' };
      return cancelOperationForUser(userId, a.operationId);
    }

    case 'draft_tweet': {
      const persona = ctx.persona || {};
      const result = await chatCompletion(
        ctx.llmConfig || {},
        [
          {
            role: 'system',
            content: `You are ${persona.name || 'a creator'}. Tone: ${persona.tone || 'sharp'}. Write ONE tweet ≤280 chars. No hashtag spam. Return ONLY the tweet.`,
          },
          {
            role: 'user',
            content: `Topic: ${a.topic}${a.style ? `\nStyle: ${a.style}` : ''}`,
          },
        ],
        null,
        { temperature: 0.9, maxTokens: 200 },
      );
      return {
        draft: (result.message.content || '').replace(/^["']|["']$/g, '').trim(),
        posted: false,
      };
    }

    case 'draft_reply': {
      const persona = ctx.persona || {};
      const result = await chatCompletion(
        ctx.llmConfig || {},
        [
          {
            role: 'system',
            content: `You are ${persona.name || 'a creator'}. 1-2 sentence reply. No generic openers. Return ONLY reply text.`,
          },
          {
            role: 'user',
            content: `Reply to @${a.author}: "${a.tweetText}"`,
          },
        ],
        null,
        { temperature: 0.85, maxTokens: 150 },
      );
      return {
        draft: (result.message.content || '').replace(/^["']|["']$/g, '').trim(),
        posted: false,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function safeParse(s) {
  if (s == null) return null;
  if (typeof s !== 'string') return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export default {
  TOOL_DEFINITIONS,
  AUTOMATION_TO_OPERATION,
  systemPrompt,
  executeTool,
};
