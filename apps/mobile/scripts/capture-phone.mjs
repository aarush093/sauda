// @ts-check
/**
 * pnpm capture:phone — the REAL-DEVICE capture pipeline (PHONE-1, owner phone test 1 Aug).
 *
 * WHY it exists: the old `pnpm capture` shot one 360x740 desktop frame, and the owner's first real
 * phone game broke assumptions that frame never tested — a void, cards under slabs, page scroll
 * under the URL bar. This script drives the SAME dev `#/autostart` UI across the whole device
 * testbed (deviceProfiles.json): four live Android sizes at their real DPRs plus a reduced-motion
 * variant. Every proof in this pass is a still or measurement from HERE, not from a lab frame.
 *
 * WHAT it shoots per profile:
 *   - REST_<profile>.png            — the rest state (proves: no void, no clipping, no scroll).
 *   - a scroll assertion            — document height must equal the viewport (page cannot scroll).
 *   - the live zone heights         — read from [data-zone] rects, written into INDEX.md.
 * Optional --scenario runs a named composite recipe from capture.mjs's vocabulary later; for now
 * the rest state at every size is the P1 proof the owner asked for.
 *
 * Playwright is a devDependency and this file lives outside src/, so the production bundle is
 * unaffected (same guarantee as capture.mjs).
 *
 * Usage:  pnpm capture:phone [--out=docs/captures/phone-1] [--port=5173] [--only=<profileId>]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import profileData from '../src/dev/deviceProfiles.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/mobile/scripts
const REPO = resolve(HERE, '..', '..', '..'); // repo root

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const OUT_DIR = resolve(REPO, String(argv.out ?? 'docs/captures/phone-1'));
const PORT = Number(argv.port ?? 5173);
const DEV_URL = `http://localhost:${PORT}`;
const AUTOSTART = `${DEV_URL}/#/autostart`;
const ONLY = argv.only ? String(argv.only) : null;

const PROFILES = profileData.profiles.filter((p) => !ONLY || p.id === ONLY);

// ---------------------------------------------------------------------------
// Dev-server lifecycle (reuse a running Vite, else start + stop it) — mirrors capture.mjs.
// ---------------------------------------------------------------------------
async function reachable(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
async function startDevServer() {
  const proc = spawn('pnpm --filter @sauda/mobile dev', { cwd: REPO, shell: true, stdio: 'ignore' });
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if (await reachable(DEV_URL)) return proc;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('capture:phone: Vite dev server did not become reachable in 40 s');
}
function stopDevServer(proc) {
  if (!proc || proc.pid === undefined) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill('SIGTERM');
  }
}

// ---------------------------------------------------------------------------
// Shoot one profile: rest state, scroll assertion, zone heights.
// ---------------------------------------------------------------------------
async function shootProfile(browser, profile) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    reducedMotion: profile.reducedMotion ? 'reduce' : 'no-preference',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const warnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text());
  });
  await page.goto(AUTOSTART, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10_000 });
  await page.waitForTimeout(180); // let the deal + layout settle

  await page.screenshot({ path: join(OUT_DIR, `REST_${profile.id}.png`) });

  // The scroll proof (P1): with a fixed 100dvh shell the document can NOT be taller than the
  // viewport. We read both and also try to scroll — a correct shell leaves scrollTop at 0.
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    window.scrollTo(0, 9999); // attempt a scroll
    const scrolled = window.scrollY || root.scrollTop || 0;
    const zones = Array.from(document.querySelectorAll('[data-zone]')).map((el) => ({
      name: el.getAttribute('data-zone'),
      height: Math.round(el.getBoundingClientRect().height),
    }));
    return {
      docHeight: root.scrollHeight,
      viewport: window.innerHeight,
      scrolled,
      zones,
    };
  });

  await context.close();
  const canScroll = metrics.docHeight > metrics.viewport + 1 || metrics.scrolled > 1;
  return { profile, ...metrics, canScroll, warnings };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const haveServer = await reachable(DEV_URL);
  const server = haveServer ? null : await startDevServer();
  console.log(haveServer ? `capture:phone: reusing dev server at ${DEV_URL}` : `capture:phone: started dev server at ${DEV_URL}`);

  const browser = await chromium.launch();
  const results = [];
  try {
    for (const profile of PROFILES) {
      const r = await shootProfile(browser, profile);
      results.push(r);
      const verdict = r.canScroll ? 'SCROLLS ✗' : 'no-scroll ✓';
      console.log(`  ${profile.id.padEnd(18)} ${profile.width}x${profile.height}@${profile.dpr}  doc ${r.docHeight}/${r.viewport}  ${verdict}`);
    }
  } finally {
    await browser.close();
    stopDevServer(server);
  }

  writeIndex(results);
  const scrollers = results.filter((r) => r.canScroll);
  console.log(`\ncapture:phone: wrote ${results.length} profile frames to ${OUT_DIR}` + (scrollers.length ? `  (${scrollers.length} SCROLLED — P1 regression)` : '  (none scrolled)'));
}

function writeIndex(results) {
  const lines = [];
  lines.push('# PHONE-1 device-profile capture pack — INDEX', '');
  lines.push('Generated by `pnpm capture:phone`. Each frame is the REAL play UI at `#/autostart`,');
  lines.push('emulated at a real portrait device profile (deviceProfiles.json) with touch + real DPR.');
  lines.push('The scroll column is the P1 proof: a correct 100dvh fixed shell means the document is');
  lines.push('never taller than the viewport AND a scroll attempt leaves scrollTop at 0.', '');
  lines.push('| Profile | Size @ DPR | Doc / Viewport | Scroll | Zone heights |');
  lines.push('|---------|-----------|----------------|--------|--------------|');
  for (const r of results) {
    const zones = r.zones.map((z) => `${z.name} ${z.height}`).join(' · ');
    const scroll = r.canScroll ? '**SCROLLS ✗**' : 'no-scroll ✓';
    lines.push(`| \`REST_${r.profile.id}.png\` | ${r.profile.width}×${r.profile.height} @ ${r.profile.dpr} | ${r.docHeight}/${r.viewport} | ${scroll} | ${zones} |`);
  }
  const anyWarn = [...new Set(results.flatMap((r) => r.warnings ?? []))];
  lines.push('', '## Console during capture', '');
  if (anyWarn.length === 0) lines.push('No warnings — in particular the real-viewport scroll guard stayed silent.');
  else for (const w of anyWarn) lines.push(`- ${w}`);
  lines.push('', '_Rerun:_ `pnpm capture:phone`', '');
  writeFileSync(join(OUT_DIR, 'INDEX.md'), lines.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
