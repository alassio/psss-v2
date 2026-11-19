#!/usr/bin/env node
/*
 * The Playwright suite in CHUNKS — `npm run verify:browser:chunks`.
 *
 * ⚠️ **WHY IT EXISTS (measured 2026-11-18, three times):** a vite dev server serving this suite grows to ~1.5 GB and
 * stalls within ~40–90 test page loads, whether it is a long-lived server or a fresh one, and every test after that is a
 * timeout that says nothing about the engine. So each group of spec files runs as its own `playwright test` call, and
 * each call starts — and stops — its own fresh server (`playwright.config.ts`, port `PSSS_TEST_PORT`, default 5176).
 * Groups are whole spec files, ≤ ~35 tests each. Extra arguments are passed to every call (e.g. `--reporter=line`).
 * Exit code: 0 only if every group passed. A summary of each group is printed at the end.
 */
import { spawnSync } from 'node:child_process';

const GROUPS = [
  ['00-', '01-', '02-', '03-'],
  ['04-', '05-'],
  ['06-'],
  ['07-', '08-', '09-'],
  ['10-', '11-', '12-'],
];
const extra = process.argv.slice(2);
const results = [];
for (const g of GROUPS) {
  console.log(`\n=== browser suite, chunk ${g.join(' ')} (fresh server) ===\n`);
  const r = spawnSync('npx', ['playwright', 'test', ...g, ...extra], { stdio: 'inherit', shell: true });
  results.push({ group: g.join(' '), code: r.status ?? 1 });
}
console.log('\n=== browser suite summary ===');
for (const r of results) console.log(`  ${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.group}`);
process.exit(results.every((r) => r.code === 0) ? 0 : 1);
