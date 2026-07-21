// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * Public XSession DTO — never includes cookieEnc.
 * @module api/utils/xSessionPublic
 */

/**
 * @param {object | null | undefined} row
 * @returns {object | null}
 */
export function toPublicSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    username: row.username,
    status: row.status,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export default { toPublicSession };
