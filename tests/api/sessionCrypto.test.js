// Phase A — session crypto + public session shape (no DB required)
// node --test tests/api/sessionCrypto.test.js
// by nichxbt

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSessionSecret,
  decryptSessionSecret,
  redactSecrets,
  getEncryptionKey,
} from '../../api/utils/sessionCrypto.js';
import { toPublicSession } from '../../api/utils/xSessionPublic.js';

// Inline whitelist mirror of operationService.OPERATION_TYPES (avoid Prisma import in unit test)
const OPERATION_TYPES = [
  'unfollowNonFollowers',
  'unfollowEveryone',
  'detectUnfollowers',
  'autoLike',
  'followEngagers',
  'keywordFollow',
  'autoComment',
];

describe('sessionCrypto AES-256-GCM', () => {
  before(() => {
    process.env.SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('round-trips cookie material', () => {
    const plain = 'auth_token=abc123secret; ct0=xyz789';
    const enc = encryptSessionSecret(plain);
    assert.ok(enc.startsWith('v1:'));
    assert.notEqual(enc, plain);
    assert.ok(!enc.includes('abc123secret'));
    const dec = decryptSessionSecret(enc);
    assert.equal(dec, plain);
  });

  it('produces different ciphertext each encrypt (random IV)', () => {
    const plain = 'auth_token=same';
    const a = encryptSessionSecret(plain);
    const b = encryptSessionSecret(plain);
    assert.notEqual(a, b);
    assert.equal(decryptSessionSecret(a), plain);
    assert.equal(decryptSessionSecret(b), plain);
  });

  it('rejects empty plaintext', () => {
    assert.throws(() => encryptSessionSecret(''), /required/);
  });

  it('getEncryptionKey returns 32 bytes', () => {
    assert.equal(getEncryptionKey().length, 32);
  });

  it('redactSecrets strips cookie fields', () => {
    const out = redactSecrets({
      sessionCookie: 'auth_token=SECRET',
      cookieEnc: 'v1:...',
      type: 'autoLike',
      nested: { Authorization: 'Bearer tok' },
    });
    assert.equal(out.sessionCookie, '[REDACTED]');
    assert.equal(out.cookieEnc, '[REDACTED]');
    assert.equal(out.type, 'autoLike');
    assert.equal(out.nested.Authorization, '[REDACTED]');
  });
});

describe('xSessionService.toPublicSession', () => {
  it('never exposes cookieEnc', () => {
    const pub = toPublicSession({
      id: 'sess_1',
      userId: 'user_1',
      label: 'primary',
      username: 'alice',
      cookieEnc: 'v1:SHOULD_NOT_LEAK',
      status: 'active',
      lastUsedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });
    assert.equal(pub.id, 'sess_1');
    assert.equal(pub.username, 'alice');
    assert.equal('cookieEnc' in pub, false);
    assert.equal(JSON.stringify(pub).includes('SHOULD_NOT_LEAK'), false);
  });
});

describe('operationService whitelist (contract)', () => {
  it('includes Phase A job types from design', async () => {
    // Read source of truth from shipped module text without loading Prisma
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const src = fs.readFileSync(
      path.join(root, 'api/services/operationService.js'),
      'utf8',
    );
    for (const t of OPERATION_TYPES) {
      assert.ok(src.includes(`'${t}'`), `operationService.js missing type ${t}`);
    }
  });
});
