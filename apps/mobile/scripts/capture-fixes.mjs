// @ts-check
/**
 * Before/after capture for the M4b owner-playtest fix pass (F1..F7). Same headless Playwright +
 * window.__replay mechanism as capture.mjs, but focused on the finding states and writing
 * before/after pairs to docs/captures/playtest-fixes-1/.
 *
 * Usage:  node scripts/capture-fixes.mjs --phase=before|after [--only=F1,F3]
 *         (run via `pnpm --filter @sauda/mobile capture:fixes -- --phase=after`)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT_DIR = resolve(REPO, 'docs/captures/playtest-fixes-1');
const PORT = 5173;
const DEV_URL = `http://localhost:${PORT}`;
const AUTOSTART = `${DEV_URL}/#/autostart`;
const VIEWPORT = { width: 360, height: 740 };

const argv = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const phase = String(argv.phase ?? 'after');
const only = argv.only ? new Set(String(argv.only).split(',')) : null;

const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const base = (id) => ({ seed: fixture.states[id].seed, actions: fixture.states[id].actions });

// ---- pointer helpers (real input) ----
async function box(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no element for ${sel}`);
  return b;
}
// Peek a hand card: press its left strip, nudge within the band (no lift), so it rises.
async function peekCard(page, cardId) {
  const b = await box(page, `[data-card-id="${cardId}"]`);
  const x = b.x + Math.min(12, b.width / 2);
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 6, y, { steps: 2 }); // scrub a touch, stay in band → peek, not drag
  await page.waitForTimeout(90);
}
async function releaseDead(page) {
  await page.mouse.move(5, 5, { steps: 2 });
  await page.mouse.up();
}

// ---- the finding recipes ----
const FINDINGS = [
  { id: 'F1', file: 'F1_fan_11cards', base: base('S10_eleven_cards') },
  { id: 'F1', file: 'F1_discard', base: base('S5_discard_mode') },
  {
    id: 'F1', file: 'F1_peek', base: base('S9_kabza'),
    prep: async (page) => {
      // peek a middle-ish hand card so it lifts clear of its neighbours
      const hand = await page.evaluate(() => window.__sauda.getState().state.players[0].hand);
      const mid = hand[Math.floor(hand.length / 2)];
      await peekCard(page, mid);
    },
    post: releaseDead,
  },
];

// ---- dev-server lifecycle ----
async function reachable(url) {
  try {
    const res = await fetch(url);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
async function startServer() {
  const proc = spawn('pnpm --filter @sauda/mobile dev', { cwd: REPO, shell: true, stdio: 'ignore' });
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if (await reachable(DEV_URL)) return proc;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('capture-fixes: dev server did not start');
}
function stopServer(proc) {
  if (!proc?.pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill('SIGTERM');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const have = await reachable(DEV_URL);
  const server = have ? null : await startServer();
  console.log(have ? `reusing dev server` : `started dev server`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  try {
    for (const item of FINDINGS) {
      if (only && !only.has(item.id)) continue;
      const page = await context.newPage();
      await page.goto(AUTOSTART, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10_000 });
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      await page.evaluate((b) => window.__replay(b.seed, b.actions), item.base);
      await page.waitForTimeout(120);
      if (item.prep) await item.prep(page);
      await page.screenshot({ path: join(OUT_DIR, `${item.file}_${phase}.png`) });
      if (item.post) await item.post(page);
      await page.close();
      console.log(`  ${item.file}_${phase}`);
    }
  } finally {
    await browser.close();
    stopServer(server);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
