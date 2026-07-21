// Bundles the React/TypeScript popup UI into popup/popup.bundle.js + popup.css.
// by nichxbt

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: [path.join(ROOT, 'src/popup/index.tsx')],
  bundle: true,
  outfile: path.join(ROOT, 'popup/popup.bundle.js'),
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
  console.log('👁  Watching popup bundle for changes…');
} else {
  await esbuild.build(options);
  console.log('✅ Popup bundle built');
}
