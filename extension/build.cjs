// XActions Extension — build / package
// Vanilla MV3: no bundler. Validates JS + packages zip for load/distribute.
// by nichxbt

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const checkOnly = process.argv.includes('--check-only');

const INCLUDE = [
  'manifest.json',
  'README.md',
  'agent/catalog.js',
  'agent/tools.js',
  'agent/agent-core.js',
  'agent/llm.js',
  'agent/xai-oauth.js',
  'agent/strategist.js',
  'background/service-worker.js',
  'content/bridge.js',
  'content/injected.js',
  'popup/popup.html',
  'popup/popup.bundle.css',
  'popup/popup.bundle.js',
  'dashboard/dashboard.html',
  'dashboard/dashboard.bundle.css',
  'dashboard/dashboard.bundle.js',
  'sidepanel/sidepanel.html',
  'sidepanel/sidepanel.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

// popup.bundle.js + dashboard.bundle.js are esbuild outputs (minified IIFE) —
// skip node's --check, which chokes on some modern syntax esbuild lowers differently.
const JS_CHECK = INCLUDE.filter((f) => f.endsWith('.js') && f !== 'popup/popup.bundle.js' && f !== 'dashboard/dashboard.bundle.js');

function fail(msg) {
  console.error('❌', msg);
  process.exit(1);
}

function ok(msg) {
  console.log('✅', msg);
}

function readManifest() {
  const p = path.join(ROOT, 'manifest.json');
  if (!fs.existsSync(p)) fail('manifest.json missing');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`manifest.json invalid JSON: ${e.message}`);
  }
}

function checkFiles() {
  for (const f of INCLUDE) {
    if (!fs.existsSync(path.join(ROOT, f))) fail(`Missing required file: ${f}`);
  }
  ok(`All ${INCLUDE.length} package files present`);
}

function checkSyntax() {
  for (const f of JS_CHECK) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], {
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      fail(`Syntax error in ${f}:\n${r.stderr || r.stdout}`);
    }
  }
  ok(`Syntax OK (${JS_CHECK.length} JS files)`);
}

function checkManifest(manifest) {
  if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
  if (!manifest.background?.service_worker) fail('background.service_worker required');
  if (!manifest.action?.default_popup) fail('action.default_popup required');
  const perms = new Set(manifest.permissions || []);
  for (const p of ['storage', 'tabs', 'scripting', 'notifications']) {
    if (!perms.has(p)) fail(`Missing permission: ${p}`);
  }
  ok(`Manifest v${manifest.version} OK`);
}

function checkCatalogWiring() {
  const sw = fs.readFileSync(path.join(ROOT, 'background/service-worker.js'), 'utf8');
  if (!sw.includes('catalog.js')) fail('SW missing catalog.js import');
  if (!sw.includes('strategist.js')) fail('SW missing strategist.js import');
  if (!sw.includes('AGENT_RUN_STRATEGY')) fail('SW missing AGENT_RUN_STRATEGY');

  const ctx = { globalThis: null };
  ctx.globalThis = ctx;
  const vm = require('vm');
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'agent/catalog.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'agent/tools.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'agent/strategist.js'), 'utf8'), ctx);

  const n = ctx.XActionsCatalog?.count || 0;
  if (n < 100) fail(`Expected ≥100 tools, got ${n}`);
  if (!ctx.XActionsStrategist?.runStrategyPipeline) fail('Strategist not loaded');
  if (!ctx.XActionsStrategist?.PLAYBOOK_ALLOWLIST?.size) fail('Allowlist empty');

  const inj = fs.readFileSync(path.join(ROOT, 'content/injected.js'), 'utf8');
  const page = ctx.XActionsCatalog.TOOLS.filter((t) => t.kind === 'page').map((t) => t.name);
  const missing = page.filter((name) => !new RegExp("case ['\"]" + name + "['\"]").test(inj));
  if (missing.length) fail(`Page handlers missing: ${missing.join(', ')}`);

  ok(
    `Catalog ${n} tools · allowlist ${ctx.XActionsStrategist.PLAYBOOK_ALLOWLIST.size} · page handlers OK`,
  );
}

function packageZip(manifest) {
  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const ver = manifest.version || '0.0.0';
  const zipName = `xactions-extension-v${ver}.zip`;
  const zipPath = path.join(distDir, zipName);

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  // Prefer PowerShell Compress-Archive on Windows; zip on Unix
  const absFiles = INCLUDE.map((f) => path.join(ROOT, f));
  const isWin = process.platform === 'win32';

  if (isWin) {
    // Stage clean folder then zip (avoids parent path junk)
    const stage = path.join(distDir, `_stage_v${ver}`);
    fs.rmSync(stage, { recursive: true, force: true });
    for (const f of INCLUDE) {
      const dest = path.join(stage, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(ROOT, f), dest);
    }
    const ps = `
      Compress-Archive -Path '${stage.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force
    `;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
      stdio: 'inherit',
    });
    fs.rmSync(stage, { recursive: true, force: true });
  } else {
    const stage = path.join(distDir, `_stage_v${ver}`);
    fs.rmSync(stage, { recursive: true, force: true });
    for (const f of INCLUDE) {
      const dest = path.join(stage, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(ROOT, f), dest);
    }
    spawnSync('zip', ['-r', zipPath, '.'], { cwd: stage, stdio: 'inherit' });
    fs.rmSync(stage, { recursive: true, force: true });
  }

  if (!fs.existsSync(zipPath)) fail('Zip not created');
  const kb = Math.round(fs.statSync(zipPath).size / 1024);
  ok(`Packaged ${zipName} (${kb} KB)`);
  return zipPath;
}

function writeBuildInfo(manifest, zipPath) {
  const info = {
    name: manifest.name,
    version: manifest.version,
    builtAt: new Date().toISOString(),
    files: INCLUDE.length,
    zip: zipPath ? path.basename(zipPath) : null,
    loadUnpacked: ROOT,
  };
  const out = path.join(ROOT, 'dist', 'build-info.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(info, null, 2));
  ok(`Wrote dist/build-info.json`);
}

function buildPopup() {
  const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], { cwd: ROOT, encoding: 'utf8' });
  if (tsc.status !== 0) fail(`Popup type-check failed:\n${tsc.stdout || tsc.stderr}`);
  ok('Popup type-check passed');

  const esb = spawnSync('node', ['scripts/build-popup.mjs'], { cwd: ROOT, encoding: 'utf8' });
  if (esb.status !== 0) fail(`Popup bundle build failed:\n${esb.stdout || esb.stderr}`);
  ok('Popup bundle built (React + TypeScript + Base UI)');
}

function main() {
  console.log('\n🔧 XActions Extension build\n');
  buildPopup();
  const manifest = readManifest();
  checkFiles();
  checkSyntax();
  checkManifest(manifest);
  checkCatalogWiring();

  if (checkOnly) {
    console.log('\n✨ Check-only complete — load unpacked: extension/\n');
    return;
  }

  const zipPath = packageZip(manifest);
  writeBuildInfo(manifest, zipPath);
  console.log('\n✨ Build complete');
  console.log(`   Load unpacked: ${ROOT}`);
  console.log(`   Or zip:        ${zipPath}\n`);
}

main();
