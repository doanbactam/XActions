// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * XSession service — encrypted X cookie store for backend automation.
 * @module api/services/xSessionService
 */

import { PrismaClient } from '@prisma/client';
import {
  encryptSessionSecret,
  decryptSessionSecret,
} from '../utils/sessionCrypto.js';
import { toPublicSession } from '../utils/xSessionPublic.js';

const prisma = new PrismaClient();

export { toPublicSession };

/**
 * @param {string} userId
 * @param {{ sessionCookie: string, username?: string, label?: string }} input
 */
export async function createSession(userId, input) {
  const cookie = String(input.sessionCookie || '').trim();
  if (!cookie) {
    throw Object.assign(new Error('sessionCookie is required'), { status: 400 });
  }

  const cookieEnc = encryptSessionSecret(cookie);
  const label = (input.label || 'primary').trim() || 'primary';
  const username = input.username?.trim() || null;

  const row = await prisma.xSession.create({
    data: {
      userId,
      label,
      username,
      cookieEnc,
      status: 'active',
    },
  });

  // Keep legacy User fields in sync for older routes (encrypted)
  await prisma.user.update({
    where: { id: userId },
    data: {
      sessionCookie: cookieEnc,
      twitterUsername: username || undefined,
      authMethod: 'session',
    },
  });

  return toPublicSession(row);
}

/**
 * @param {string} userId
 */
export async function listSessions(userId) {
  const rows = await prisma.xSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPublicSession);
}

/**
 * @param {string} userId
 * @param {string} sessionId
 */
export async function getSessionForUser(userId, sessionId) {
  const row = await prisma.xSession.findFirst({
    where: { id: sessionId, userId },
  });
  return row;
}

/**
 * Decrypt cookie for worker use only. Updates lastUsedAt.
 * @param {string} userId
 * @param {string} [sessionId] — omit to use latest active session
 * @returns {Promise<{ sessionId: string, username: string|null, sessionCookie: string, label: string }>}
 */
export async function resolveSessionCookie(userId, sessionId) {
  /** @type {import('@prisma/client').XSession | null} */
  let row = null;

  if (sessionId) {
    row = await prisma.xSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row) {
      throw Object.assign(new Error('X session not found'), { status: 404 });
    }
  } else {
    row = await prisma.xSession.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Fallback: legacy User.sessionCookie
  if (!row) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.sessionCookie) {
      throw Object.assign(
        new Error('No X session — POST /api/sessions with sessionCookie'),
        { status: 400 },
      );
    }
    let plain;
    try {
      plain = decryptSessionSecret(user.sessionCookie);
    } catch {
      // Stored as plaintext historically
      plain = user.sessionCookie;
    }
    return {
      sessionId: null,
      username: user.twitterUsername || null,
      sessionCookie: plain,
      label: 'legacy-user-field',
    };
  }

  if (row.status !== 'active') {
    throw Object.assign(
      new Error(`X session is ${row.status} — re-authenticate`),
      { status: 400 },
    );
  }

  const sessionCookie = decryptSessionSecret(row.cookieEnc);

  await prisma.xSession.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    sessionId: row.id,
    username: row.username,
    sessionCookie,
    label: row.label,
  };
}

/**
 * @param {string} userId
 * @param {string} sessionId
 */
export async function revokeSession(userId, sessionId) {
  const row = await prisma.xSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!row) {
    throw Object.assign(new Error('X session not found'), { status: 404 });
  }

  await prisma.xSession.delete({ where: { id: sessionId } });

  // Clear legacy field if it was the only session
  const remaining = await prisma.xSession.count({ where: { userId } });
  if (remaining === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { sessionCookie: null },
    });
  }

  return { success: true, id: sessionId };
}

/**
 * Mark session expired (e.g. worker auth failure).
 * @param {string} sessionId
 * @param {string} [status]
 */
export async function markSessionStatus(sessionId, status = 'expired') {
  if (!sessionId) return;
  await prisma.xSession.updateMany({
    where: { id: sessionId },
    data: { status },
  });
}

export default {
  toPublicSession,
  createSession,
  listSessions,
  getSessionForUser,
  resolveSessionCookie,
  revokeSession,
  markSessionStatus,
};
