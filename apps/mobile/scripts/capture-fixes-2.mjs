// @ts-check
/**
 * Before/after capture for owner playtest 2 (G1..G7 · "real cards, real wheel"). Same headless
 * Playwright + window.__replay mechanism as capture-fixes.mjs, writing before/after pairs to
 * docs/captures/playtest-fixes-2/. Two kinds of frame:
 *   - dev-card frames (#/dev/card/<id>): a single CardFace scaled 3× — used for the G5 finished
 *     faces and the "unchanged" property/action/money proof.
 *   - game-state frames (#/autostart + __replay): the real play UI driven onto a scenario, with an
 *     optional prep gesture (tap a card, click an opponent row, declare the win).
 *
 * The BEFORE run reverts just the app source to the pre-pass commit while keeping THIS script:
 *   git checkout f6adb03 -- apps/mobile/src && pnpm --filter @sauda/mobile capture:fixes2 -- --phase=before && git restore --source=HEAD apps/mobile/src
 * The AFTER run is plain:  pnpm --filter @sauda/mobile capture:fixes2 -- --phase=after
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT_DIR = resolve(REPO, 'docs/captures/playtest-fixes-2');
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
// Tap a hand card in the wheel band → release without lifting → it rises to INSPECT (G1).
async function tapCard(page, cardId) {
  const b = await box(page, `[data-card-id="${cardId}"]`);
  const x = b.x + Math.min(14, b.width / 2);
  const y = b.y + b.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

// ---- the frames ----
// dev-card frames: a single finished/unchanged face, scaled 3× on the felt.
const CARD_FRAMES = [
  { id: 'G5_wild_dual', card: 'wild_mumbai_newDelhi_0' },
  { id: 'G5_wild_any', card: 'wild_any_0' },
  { id: 'G5_lagaan_paired', card: 'kiraya_jaipur_kolkata_0' },
  { id: 'G5_lagaan_wild', card: 'kiraya_any_0' },
  { id: 'unchanged_property', card: 'prop_mumbai_0' },
  { id: 'unchanged_action', card: 'action_kabza_0' },
  { id: 'unchanged_money', card: 'money_10_0' },
];

// game-state frames.
const GAME_FRAMES = [
  { id: 'G2_wheel', base: base('S9_kabza') }, // rest on my turn: the wheel + real-card cascades
  { id: 'G2_wheel_11', base: base('S10_eleven_cards') }, // the 11-card wheel
  {
    id: 'G1_inspect', base: base('S9_kabza'),
    prep: async (page) => {
      const hand = await page.evaluate(() => window.__sauda.getState().state.players[0].hand);
      await tapCard(page, hand[Math.floor(hand.length / 2)]);
      await page.waitForTimeout(120);
    },
  },
  { id: 'G3_discard', base: base('S5_discard_mode') }, // the full-screen discard overlay
  { id: 'G4_payment_realcards', base: base('S3_pay_from_bank') }, // real cards + the G7 Munshi seal (F4 fix)
  {
    id: 'G4_tableview_opponent', base: base('S6_haveli'), // turn 29 — opponents hold sets
    prep: async (page) => {
      // click the first opponent's group strip → their full table view (G4)
      const row = await page.$('[title*="tap to expand"]');
      if (row) {
        await row.click();
        await page.waitForTimeout(120);
      }
    },
  },
  { id: 'G4_stage_play', base: base('S7_wild_lagaan') }, // ends on a human place → the stage beat
  {
    id: 'G4_end_cascades', base: base('S11_declare_win'),
    prep: async (page) => {
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'DECLARE_WIN' }));
      await page.waitForTimeout(150);
    },
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
  throw new Error('capture-fixes-2: dev server did not start');
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
  console.log(have ? 'reusing dev server' : 'started dev server');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const noMotion = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
  try {
    // dev-card frames
    for (const item of CARD_FRAMES) {
      if (only && !only.has(item.id)) continue;
      const page = await context.newPage();
      await page.goto(`${DEV_URL}/#/dev/card/${item.card}`, { waitUntil: 'load' });
      await page.addStyleTag({ content: noMotion });
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(OUT_DIR, `${item.id}_${phase}.png`) });
      await page.close();
      console.log(`  ${item.id}_${phase}`);
    }
    // game-state frames
    for (const item of GAME_FRAMES) {
      if (only && !only.has(item.id)) continue;
      const page = await context.newPage();
      const warnings = [];
      page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
      await page.goto(AUTOSTART, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10_000 });
      await page.addStyleTag({ content: noMotion });
      await page.evaluate((b) => window.__replay(b.seed, b.actions), item.base);
      await page.waitForTimeout(150);
      if (item.prep) {
        try { await item.prep(page); } catch (e) { console.log(`    (prep skipped: ${e.message})`); }
      }
      await page.screenshot({ path: join(OUT_DIR, `${item.id}_${phase}.png`) });
      await page.close();
      const scroll = warnings.find((w) => w.includes('scrolls'));
      console.log(`  ${item.id}_${phase}${scroll ? `  ⚠ ${scroll}` : ''}`);
    }
  } finally {
    await browser.close();
    stopServer(server);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
