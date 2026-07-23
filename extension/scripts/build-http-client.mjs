// Bundles the shared Twitter HTTP scraper into a single IIFE for the
// extension service worker (importScripts).
// by nichxbt

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(ROOT, 'agent/http-client-entry.js')],
  bundle: true,
  outfile: path.join(ROOT, 'agent/http-client.bundle.js'),
  format: 'iife',
  target: 'chrome110',
  platform: 'browser',
  sourcemap: false,
  minify: !watch,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('👁  Watching http-client bundle for changes…');
} else {
  await esbuild.build(options);
  console.log('✅ HTTP client bundle built');
}
