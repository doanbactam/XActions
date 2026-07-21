// Bundles the React/TypeScript popup + dashboard UI into bundle files.
// by nichxbt

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions[]} */
const builds = [
  {
    entryPoints: [path.join(ROOT, 'src/popup/index.tsx')],
    bundle: true,
    outfile: path.join(ROOT, 'popup/popup.bundle.js'),
    format: 'iife',
    target: 'chrome110',
    platform: 'browser',
    sourcemap: false,
    minify: !watch,
    logLevel: 'info',
  },
  {
    entryPoints: [path.join(ROOT, 'src/dashboard/index.tsx')],
    bundle: true,
    outfile: path.join(ROOT, 'dashboard/dashboard.bundle.js'),
    format: 'iife',
    target: 'chrome110',
    platform: 'browser',
    sourcemap: false,
    minify: !watch,
    logLevel: 'info',
  },
];

if (watch) {
  const ctxs = [];
  for (const options of builds) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    ctxs.push(ctx);
  }
  console.log('👁  Watching popup + dashboard bundles for changes…');
} else {
  for (const options of builds) {
    await esbuild.build(options);
  }
  console.log('✅ Popup + Dashboard bundles built');
}
