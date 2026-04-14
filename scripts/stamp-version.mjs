#!/usr/bin/env node
/**
 * stamp-version.mjs — stamp js/version.js and index.html with a fresh
 * build identifier. Run before every deploy / push to main.
 *
 * Build ID format: <gitShortHash>-<random4hex>
 *   - gitShortHash proves which commit the deployed bundle came from
 *   - random4hex forces cache invalidation even when you re-deploy the
 *     same commit (e.g. re-uploading after a CDN purge)
 *
 * What it rewrites:
 *   - js/version.js  →  export const BUILD = '<stamp>';
 *   - index.html     →  js/app.js?v=<stamp>
 *
 * Exits non-zero if either file can't be updated so a pre-push hook
 * blocks bad pushes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const gitShort = execSync('git rev-parse --short=8 HEAD', { cwd: root })
  .toString().trim();
const nonce = randomBytes(2).toString('hex');
const build = `${gitShort}-${nonce}`;

const versionPath = resolve(root, 'js/version.js');
const versionSrc = readFileSync(versionPath, 'utf8');
const nextVersion = versionSrc.replace(
  /export const BUILD = '[^']*';/,
  `export const BUILD = '${build}';`,
);
if (nextVersion === versionSrc) {
  console.error('[stamp] js/version.js BUILD line not found — refusing to stamp');
  process.exit(1);
}
writeFileSync(versionPath, nextVersion);

const indexPath = resolve(root, 'index.html');
const indexSrc = readFileSync(indexPath, 'utf8');
const nextIndex = indexSrc.replace(
  /js\/app\.js\?v=[^'"]*/,
  `js/app.js?v=${build}`,
);
if (nextIndex === indexSrc) {
  console.error('[stamp] index.html cache-buster not found — refusing to stamp');
  process.exit(1);
}
writeFileSync(indexPath, nextIndex);

const version = (versionSrc.match(/export const VERSION = '([^']+)'/) || [])[1] || '?';
console.log(`[stamp] ${version}+${build}`);
console.log('[stamp]   js/version.js  ✓');
console.log('[stamp]   index.html     ✓');
