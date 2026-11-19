#!/usr/bin/env node
/*
 * mapcheck — `psss-engine/README.md` is the code map, and a map is only worth reading if it is COMPLETE and
 * names nothing that is gone.
 *
 * ## What it asserts
 *
 *   §A every file in scope is named in the map EXACTLY ONCE, under the section of its own directory;
 *   §B every name in the map exists, as a file (or, for a name ending in `/`, as a directory);
 *   §C every map section names a directory that exists;
 *   §S the audit can fail: five seeded defects, each of which must make §A–§C report a failure.
 *
 * ## How the map is read
 *
 * A section is a markdown heading whose first backticked span ends in `/` — `## \`src/\``, `### \`src/core/\``.
 * `psss-engine/` itself is the top level. Below a heading, every table row whose FIRST cell starts with a
 * backticked name contributes the backticked names in that first cell, relative to the section's directory.
 * Prose, other cells and rows in other shapes are ignored, so a description may mention any file freely.
 *
 * ## Scope
 *
 *   - the files and directories at the top level of `psss-engine/`, except what the build or an install creates;
 *   - every file under `src/`, `checks/`, `scripts/`, `tests/` and `public/`, recursively;
 *   - the top level of `screensaver/` — its build output folders excepted, its `probe/` as one directory row.
 *
 * Files whose name starts with `_tmp` are scratch and outside the scope.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAP = join(ROOT, 'README.md');

/** Created by an install or a build, never source. */
const GENERATED_TOP = new Set(['node_modules', 'dist', '.playwright', 'test-results', 'playwright-report']);
const GENERATED_SCREENSAVER = new Set(['bin', 'obj', 'Payload']);
const RECURSIVE = ['src', 'checks', 'scripts', 'tests', 'public'];

const isScratch = (name) => name.startsWith('_tmp');

/** Every path the map must name, relative to `psss-engine/`; a directory row ends in `/`. */
function scopeFrom(root) {
  const out = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (isScratch(e.name) || GENERATED_TOP.has(e.name)) continue;
    out.push(e.isDirectory() ? `${e.name}/` : e.name);
  }
  const walk = (rel) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      if (isScratch(e.name)) continue;
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  for (const d of RECURSIVE) if (existsSync(join(root, d))) walk(d);
  const ss = join(root, 'screensaver');
  if (existsSync(ss)) {
    for (const e of readdirSync(ss, { withFileTypes: true })) {
      if (isScratch(e.name) || GENERATED_SCREENSAVER.has(e.name)) continue;
      out.push(e.isDirectory() ? `screensaver/${e.name}/` : `screensaver/${e.name}`);
    }
  }
  return out;
}

/** The map's sections and the names under each: `{ sections: [{dir, line}], entries: [{path, line}] }`. */
function parseMap(text) {
  const sections = [];
  const entries = [];
  let dir = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const h = /^#{1,6}\s+.*?`([^`]+)`/.exec(line);
    if (/^#{1,6}\s/.test(line)) {
      if (h && h[1].endsWith('/')) {
        dir = h[1] === 'psss-engine/' ? '' : h[1];
        sections.push({ dir, line: i + 1 });
      }
      return;
    }
    if (dir === null) return;
    const row = /^\|\s*(`[^|]*)\|/.exec(line);
    if (!row) return;
    for (const m of row[1].matchAll(/`([^`]+)`/g)) entries.push({ path: dir + m[1], line: i + 1 });
  });
  return { sections, entries };
}

/** The audit as a pure function of the map text, the scope, and an existence test. Returns failure lines. */
function audit(text, scope, exists) {
  const fails = [];
  const { sections, entries } = parseMap(text);
  const count = new Map();
  for (const e of entries) count.set(e.path, (count.get(e.path) ?? 0) + 1);
  for (const p of scope) {
    const n = count.get(p) ?? 0;
    if (n !== 1) fails.push(`§A ${p} is named ${n} times in the map (must be exactly once)`);
  }
  for (const e of entries) {
    if (!exists(e.path)) fails.push(`§B README.md:${e.line} names ${e.path}, which does not exist`);
  }
  for (const s of sections) {
    if (s.dir !== '' && !exists(s.dir)) fails.push(`§C README.md:${s.line} is a section for ${s.dir}, which does not exist`);
  }
  return fails;
}

const existsReal = (p) => {
  const full = join(ROOT, p);
  if (!existsSync(full)) return false;
  return p.endsWith('/') ? statSync(full).isDirectory() : statSync(full).isFile();
};

const text = readFileSync(MAP, 'utf8');
const scope = scopeFrom(ROOT);
const { sections, entries } = parseMap(text);
const fails = audit(text, scope, existsReal);

// ── §S the audit must be able to fail ─────────────────────────────────────────────────────────────
// Each seed is one way the map goes stale. A seed that the audit does NOT report means the audit is blind
// to that defect, which fails this checker just as a real defect would.
const firstRow = entries.find((e) => e.path.startsWith('src/core/'));
const lines = text.split(/\r?\n/);
const seeds = [
  { what: 'a row deleted (a file left unmapped)',
    text: lines.filter((_, i) => i + 1 !== firstRow.line).join('\n'), scope, exists: existsReal },
  { what: 'a row naming a file that does not exist',
    text: text.replace(firstRow.path.slice('src/core/'.length) + '`', firstRow.path.slice('src/core/'.length) + '` `gone-file.ts`'),
    scope, exists: existsReal },
  { what: 'a file named twice',
    text: lines.map((l, i) => (i + 1 === firstRow.line ? `${l}\n${l}` : l)).join('\n'), scope, exists: existsReal },
  { what: 'a new source file with no row',
    text, scope: [...scope, 'src/core/new-module.ts'],
    exists: (p) => p === 'src/core/new-module.ts' || existsReal(p) },
  { what: 'a section for a directory that does not exist',
    text: `${text}\n\n### \`src/vanished/\`\n`, scope, exists: existsReal },
];
const blind = seeds.filter((s) => audit(s.text, s.scope, s.exists).length === 0);
for (const s of blind) fails.push(`§S the audit did not catch the seeded defect: ${s.what}`);

console.log(`[mapcheck] map: ${sections.length} sections, ${entries.length} names; scope: ${scope.length} paths; `
  + `seeds caught: ${seeds.length - blind.length}/${seeds.length}`);
if (fails.length) {
  for (const f of fails) console.error(`[mapcheck] FAIL ${f}`);
  console.error(`[mapcheck] ${fails.length} failure(s)`);
  process.exit(1);
}
console.log('[mapcheck] ok — every file in scope is named exactly once, and every name exists');
