// Structural verification of docs/saas-backend-agent.md (SaaS backend agent design)
// Uses Node built-in test runner (node --test) so it runs without vitest install.
// Asserts design exists, covers acceptance themes, and references real repo artifacts.
// by nichxbt

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const designPath = path.join(root, 'docs/saas-backend-agent.md');

function readDesign() {
  return fs.readFileSync(designPath, 'utf8');
}

function repoExists(rel) {
  return fs.existsSync(path.join(root, rel));
}

describe('docs/saas-backend-agent.md — SaaS backend AI design', () => {
  it('exists and is non-trivial', () => {
    assert.equal(fs.existsSync(designPath), true);
    const text = readDesign();
    assert.ok(text.length > 4000, `design too short: ${text.length}`);
  });

  it('documents backend-central architecture and AI 100% loop', () => {
    const text = readDesign();
    assert.match(text, /backend/i);
    assert.match(text, /Agent service|agent chat|\/api\/agent\/chat/i);
    assert.match(text, /Operation/);
    assert.match(text, /queue|Bull|jobQueue/i);
    assert.match(text, /tool/i);
    assert.match(text, /client → API → agent → worker|client.*API.*agent.*worker/i);
  });

  it('locks single-operator / 1 user first scope', () => {
    const text = readDesign();
    assert.match(text, /1 user|single.?operator|single primary|nuôi 1 user/i);
    assert.match(text, /NOT v1|Không phải v1|Hoãn|Explicitly NOT/i);
  });

  it('requires cookie encrypt at rest and revoke/wipe', () => {
    const text = readDesign();
    assert.match(text, /encrypt|AES|mã hóa/i);
    assert.match(text, /revoke|wipe|DELETE \/api\/sessions/i);
    assert.match(text, /plaintext|không log|No plaintext/i);
  });

  it('makes Operation/queue the source of truth (not local DOM default)', () => {
    const text = readDesign();
    assert.match(text, /Source of truth|source of truth/i);
    assert.match(text, /Operation/);
    assert.match(text, /không.*DOM|not.*DOM|content script|local/i);
    assert.match(text, /CLI.*optional|không.*CLI|Advanced.*optional|legacy/i);
  });

  it('lists v1 API surface for sessions, operations, agent chat', () => {
    const text = readDesign();
    assert.match(text, /\/api\/sessions/);
    assert.match(text, /\/api\/operations/);
    assert.match(text, /\/api\/agent\/chat/);
  });

  it('references real repo artifacts that exist on disk', () => {
    const text = readDesign();
    const requiredPaths = [
      'prisma/schema.prisma',
      'api/services/browserAutomation.js',
      'api/services/jobQueue.js',
      'api/routes/agent.js',
      'api/routes/operations.js',
      'api/server.js',
    ];
    for (const rel of requiredPaths) {
      assert.equal(repoExists(rel), true, `missing file ${rel}`);
      const base = path.basename(rel);
      const mentioned =
        text.includes(rel) ||
        text.includes(base) ||
        (rel.includes('browserAutomation') && text.includes('browserAutomation')) ||
        (rel.includes('jobQueue') && text.includes('jobQueue'));
      assert.equal(mentioned, true, `design should reference ${rel}`);
    }
  });

  it('distinguishes legacy thought-leader agent.js from chat assistant path', () => {
    const text = readDesign();
    assert.match(text, /thought.?leader|Legacy growth|in-process/i);
    assert.match(text, /\/api\/agent\/chat/);
  });

  it('includes implement phases', () => {
    const text = readDesign();
    assert.match(text, /Phase A|Phases implement|Nền/i);
    assert.match(text, /Agent backend|Phase B/i);
  });
});
