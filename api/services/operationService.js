// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * Unified Operation enqueue — all long jobs go through Operation + Bull.
 * Resolves encrypted XSession → plaintext cookie only in memory for queue payload.
 * @module api/services/operationService
 */

import { PrismaClient } from '@prisma/client';
import { queueJob, cancelJob, getJob, getHistory } from './jobQueue.js';
import { resolveSessionCookie } from './xSessionService.js';
import { redactSecrets } from '../utils/sessionCrypto.js';

const prisma = new PrismaClient();

/** Whitelist of operation types accepted by generic enqueue (Phase A). */
export const OPERATION_TYPES = [
  'unfollowNonFollowers',
  'unfollowEveryone',
  'detectUnfollowers',
  'autoLike',
  'followEngagers',
  'keywordFollow',
  'autoComment',
];

/**
 * Create Operation row + enqueue Bull job with decrypted session cookie.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.type
 * @param {object} [params.config]
 * @param {string} [params.sessionId]
 * @param {boolean} [params.requireSession=true]
 */
export async function enqueueOperation(params) {
  const {
    userId,
    type,
    config = {},
    sessionId,
    requireSession = true,
  } = params;

  if (!userId) {
    throw Object.assign(new Error('userId required'), { status: 400 });
  }
  if (!OPERATION_TYPES.includes(type)) {
    throw Object.assign(
      new Error(`Unsupported operation type: ${type}`),
      { status: 400 },
    );
  }

  let resolved = null;
  if (requireSession) {
    resolved = await resolveSessionCookie(userId, sessionId);
  }

  const safeConfig = {
    ...config,
    username: config.username || resolved?.username || undefined,
  };

  // Store config without secrets
  const operation = await prisma.operation.create({
    data: {
      userId,
      sessionId: resolved?.sessionId || null,
      type,
      status: 'pending',
      config: JSON.stringify(safeConfig),
    },
  });

  const jobPayload = {
    type,
    operationId: operation.id,
    userId,
    authMethod: resolved ? 'session' : 'oauth',
    sessionId: resolved?.sessionId || null,
    config: {
      ...safeConfig,
      // Worker needs plaintext cookie in memory; never log this object
      sessionCookie: resolved?.sessionCookie,
      username: safeConfig.username,
    },
  };

  // eslint-disable-next-line no-console
  console.log(
    '📨 enqueueOperation',
    JSON.stringify(
      redactSecrets({
        operationId: operation.id,
        type,
        userId,
        sessionId: resolved?.sessionId,
        config: safeConfig,
      }),
    ),
  );

  await queueJob(jobPayload);

  return {
    operationId: operation.id,
    type: operation.type,
    status: 'queued',
    sessionId: resolved?.sessionId || null,
  };
}

/**
 * List operations for a user.
 */
export async function listOperations(userId, { page = 1, limit = 20, status, type } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  /** @type {import('@prisma/client').Prisma.OperationWhereInput} */
  const where = { userId };
  if (status) where.status = String(status);
  if (type) where.type = String(type);

  const [items, total] = await Promise.all([
    prisma.operation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        type: true,
        status: true,
        sessionId: true,
        config: true,
        result: true,
        error: true,
        unfollowedCount: true,
        followedCount: true,
        creditsUsed: true,
        retryCount: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.operation.count({ where }),
  ]);

  return { items, total, page: Math.floor(skip / take) + 1, limit: take };
}

/**
 * @param {string} userId
 * @param {string} operationId
 */
export async function getOperationForUser(userId, operationId) {
  const operation = await prisma.operation.findFirst({
    where: { id: operationId, userId },
  });
  if (!operation) {
    throw Object.assign(new Error('Operation not found'), { status: 404 });
  }
  // Live status from queue if available
  const live = await getJob(operationId);
  return {
    ...operation,
    liveStatus: live?.status,
    progress: live?.progress ?? null,
  };
}

/**
 * @param {string} userId
 * @param {string} operationId
 */
export async function cancelOperationForUser(userId, operationId) {
  const operation = await prisma.operation.findFirst({
    where: {
      id: operationId,
      userId,
      status: { in: ['pending', 'processing', 'queued', 'waiting', 'active'] },
    },
  });
  if (!operation) {
    // Still try cancelJob for in-memory markers
    const op = await prisma.operation.findFirst({
      where: { id: operationId, userId },
    });
    if (!op) {
      throw Object.assign(new Error('Operation not found'), { status: 404 });
    }
    throw Object.assign(
      new Error('Operation not found or already completed'),
      { status: 404 },
    );
  }

  await cancelJob(operationId);
  return { success: true, operationId, message: 'Operation cancelled' };
}

export { getHistory };

export default {
  OPERATION_TYPES,
  enqueueOperation,
  listOperations,
  getOperationForUser,
  cancelOperationForUser,
};
