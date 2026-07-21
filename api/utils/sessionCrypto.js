// Copyright (c) 2024-2026 nich (@nichxbt). Business Source License 1.1.
/**
 * Session cookie encryption at rest (AES-256-GCM).
 * Key: env SESSION_ENCRYPTION_KEY (32-byte secret, base64 or utf8 ≥ 32 chars)
 * Fallback (dev only): derived from JWT_SECRET / SESSION_SECRET.
 *
 * @module api/utils/sessionCrypto
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * Resolve 32-byte key material from env.
 * @returns {Buffer}
 */
export function getEncryptionKey() {
  const raw =
    process.env.SESSION_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    '';

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SESSION_ENCRYPTION_KEY (or JWT_SECRET) must be set in production',
      );
    }
    // Deterministic dev-only key — never use in production
    return crypto.scryptSync('xactions-dev-session-key', 'xactions-salt', KEY_LEN);
  }

  // Prefer base64 32-byte keys
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === KEY_LEN) return b64;
  } catch {
    /* fall through */
  }

  if (Buffer.byteLength(raw, 'utf8') >= KEY_LEN) {
    return Buffer.from(raw, 'utf8').subarray(0, KEY_LEN);
  }

  return crypto.scryptSync(raw, 'xactions-session-v1', KEY_LEN);
}

/**
 * Encrypt plaintext cookie string.
 * Wire format: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 * @param {string} plaintext
 * @returns {string}
 */
export function encryptSessionSecret(plaintext) {
  if (typeof plaintext !== 'string' || !plaintext) {
    throw new Error('encryptSessionSecret: plaintext required');
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

/**
 * Decrypt cookie ciphertext.
 * Supports v1 format and legacy session-auth format (salt:iv:tag:hex).
 * @param {string} payload
 * @returns {string}
 */
export function decryptSessionSecret(payload) {
  if (typeof payload !== 'string' || !payload) {
    throw new Error('decryptSessionSecret: payload required');
  }

  // New v1 format
  if (payload.startsWith('v1:')) {
    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid v1 ciphertext format');
    }
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const data = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    );
  }

  // Legacy format from api/routes/session-auth.js (salt:iv:tag:hex)
  const legacy = payload.split(':');
  if (legacy.length === 4) {
    const encKey =
      process.env.SESSION_SECRET ||
      process.env.JWT_SECRET ||
      'dev-only-key';
    const salt = Buffer.from(legacy[0], 'hex');
    const key = crypto.scryptSync(encKey, salt, 32);
    const iv = Buffer.from(legacy[1], 'hex');
    const authTag = Buffer.from(legacy[2], 'hex');
    const encrypted = legacy[3];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Last resort: treat as plaintext (pre-encrypt era) — only non-production
  if (process.env.NODE_ENV !== 'production' && !payload.includes(':')) {
    return payload;
  }

  throw new Error('Unrecognized session ciphertext format');
}

/**
 * Redact secrets from objects/strings for logging.
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value
      .replace(/auth_token=[^;\s]+/gi, 'auth_token=[REDACTED]')
      .replace(/ct0=[^;\s]+/gi, 'ct0=[REDACTED]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (
        /cookie|token|password|secret|authorization/i.test(k) ||
        k === 'cookieEnc' ||
        k === 'sessionCookie'
      ) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}

export default {
  getEncryptionKey,
  encryptSessionSecret,
  decryptSessionSecret,
  redactSecrets,
};
