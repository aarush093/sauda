// @ts-check
/**
 * M4B Excellence Pass — the RECORDING pipeline (dev-only, not shipped; Playwright is a devDep).
 *
 * H0: this pass proves anything that MOVES with a committed webm CLIP (not a still). Clips record
 * at a 360×740 viewport, deviceScaleFactor 2, one scene per clip, trimmed to just that scene; static
 * states are shot as PNG STILLS. Output → docs/captures/excellence-pass/ with an INDEX.md mapping
 * clip → scene → commit.
 *
 * It reuses the dev server already running in this session (default port 5174) and NEVER starts
 * another. States are driven through the committed `window.__replay(seed, actions)` hook; clips then
 * UNFREEZE (`__saudaCapturePaused=false`) so real motion (the 175ms glide, drags, bot beats) plays.
 *
 *   node scripts/capture-excellence.mjs [--only=<name,name>] [--port=5174]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port ?? 5174);
const DEV_URL = `http://localhost:${PORT}`;
const OUT = resolve(REPO, 'docs/captures/excellence-pass');
const VIDEO_DIR = join(OUT, '_video_tmp');
const ONLY = argv.only ? String(argv.only).split(',') : null;
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const base = (id) => ({ seed: fixture.states[id].seed, actions: fixture.states[id].actions });

const KILL_MOTION = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

// ---- gesture helpers (real pointer input) ---------------------------------
async function boxLeft(page, sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error(`no ${sel}`); return { x: b.x + Math.min(12, b.width / 2), y: b.y + b.height / 2 }; }
async function boxCenter(page, sel) { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error(`no ${sel}`); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function frames(page, ms) { await page.waitForTimeout(ms); }

// ---------------------------------------------------------------------------
// The scenes. kind:'still' = one PNG (frozen, reduced-motion). kind:'clip' = a webm (motion on).
// `base` lands the state; for clips `act(page)` performs the motion after unfreezing.
// ---------------------------------------------------------------------------
const SCENES = [
  // ---- H3 legibility n-series (dev wheel lab) ----
  ...[2, 5, 7, 9, 11].map((n) => ({
    file: `H3_wheel_n${n}`, kind: 'still', spec: 'H3', url: `#/dev/wheel/${n}`,
    what: `The hand wheel at n=${n} — one card size, readable strips inside the frame.`,
  })),
  // ---- H3 the re-spacing glide (tap a card → remaining cards glide to new spacing) ----
  {
    file: 'H3_wheel_glide', kind: 'clip', spec: 'G2 · H3', url: '#/dev/wheel/8',
    what: 'The seamless re-spacing glide — a card leaves the hand and the rest glide (175ms) to new even spacing.',
    act: async (page) => {
      const band = await page.locator('[data-card-id]').first();
      await frames(page, 400);
      for (let i = 0; i < 4; i++) { const b = await band.boundingBox(); if (b) { await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.4); } await frames(page, 500); }
      await frames(page, 400);
    },
  },
  // ---- H3 scrub under 4x CPU throttle ----
  {
    file: 'H3_wheel_scrub_throttle', kind: 'clip', spec: 'G2 · H3', base: base('S10_eleven_cards'), throttle: 4,
    what: 'Scrubbing an 11-card wheel under 4× CPU throttle — the peek re-targets card by card, no flicker.',
    act: async (page) => { await scrubWheel(page); },
  },
  // ---- H2 End turn relocated to the header (real board, 11-card wheel) ----
  {
    file: 'H2_endturn_header', kind: 'still', spec: 'H2b', base: base('S10_eleven_cards'),
    what: 'End turn now sits in the my-area header by the bank — the 11-card wheel below spans full width, no card overlapped.',
  },
  // ---- H1a opponent expand (tap an opponent row → their TableView) ----
  {
    file: 'H1_opponent_expanded', kind: 'still', spec: 'H1a · G4', base: base('S6_haveli'),
    what: "An opponent's full board expanded — their sets as large real cards + bank total (tap a row to open).",
    prep: async (page) => {
      await page.locator('[data-expand^="opponent"]').first().click();
      await frames(page, 250);
    },
  },
  // ---- H1c the 11-card wheel scrub ----
  {
    file: 'H1_wheel_scrub_11', kind: 'clip', spec: 'A13 G2 · H1c', base: base('S10_eleven_cards'),
    what: 'The 11-card wheel scrubbed end to end — a finger glides across, each card peeks up under the pointer.',
    act: async (page) => { await scrubWheel(page); },
  },
];

// scrub the wheel left→right→left with real pointer moves (used by two clips)
async function scrubWheel(page) {
  const cards = await page.locator('[data-card-id]').all();
  if (cards.length === 0) return;
  const boxes = [];
  for (const c of cards) { const b = await c.boundingBox(); if (b) boxes.push(b); }
  boxes.sort((a, b) => a.x - b.x);
  const y = boxes[0].y + boxes[0].height * 0.35;
  await page.mouse.move(boxes[0].x + 6, y);
  await page.mouse.down();
  await frames(page, 120);
  for (const b of boxes) { await page.mouse.move(b.x + b.width * 0.5, y, { steps: 3 }); await frames(page, 140); }
  for (let i = boxes.length - 1; i >= 0; i--) { const b = boxes[i]; await page.mouse.move(b.x + b.width * 0.5, y, { steps: 3 }); await frames(page, 90); }
  await page.mouse.up();
  await frames(page, 200);
}

// ---------------------------------------------------------------------------
async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

async function shootStill(browser, scene) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  await page.goto(`${DEV_URL}/${scene.url ?? '#/autostart'}`, { waitUntil: 'load' });
  if (!scene.url) await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  await page.addStyleTag({ content: KILL_MOTION });
  if (scene.base) { await page.evaluate((b) => window.__replay(b.seed, b.actions), scene.base); await frames(page, 150); }
  if (scene.prep) await scene.prep(page);
  await frames(page, 120);
  await page.screenshot({ path: join(OUT, `${scene.file}.png`) });
  await context.close();
  return { warnings };
}

async function shootClip(browser, scene) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, recordVideo: { dir: VIDEO_DIR, size: { width: 720, height: 1480 } } });
  const page = await context.newPage();
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  if (scene.throttle) { const client = await context.newCDPSession(page); await client.send('Emulation.setCPUThrottlingRate', { rate: scene.throttle }); }
  await page.goto(`${DEV_URL}/${scene.url ?? '#/autostart'}`, { waitUntil: 'load' });
  if (!scene.url) await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  if (scene.base) {
    await page.evaluate((b) => window.__replay(b.seed, b.actions), scene.base);
    await page.evaluate(() => { window.__saudaCapturePaused = false; }); // let real motion play
    await frames(page, 200);
  }
  if (scene.act) await scene.act(page);
  await frames(page, 150);
  const video = page.video();
  await context.close(); // finalises the webm
  if (video) {
    const src = await video.path();
    const dest = join(OUT, `${scene.file}.webm`);
    if (existsSync(dest)) rmSync(dest);
    renameSync(src, dest);
  }
  return { warnings };
}

async function main() {
  if (!(await reachable(DEV_URL))) { console.error(`capture-excellence: no dev server at ${DEV_URL} — start one (pnpm --filter @sauda/mobile dev) first.`); process.exit(1); }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(VIDEO_DIR, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const scene of SCENES) {
      if (ONLY && !ONLY.includes(scene.file)) continue;
      try {
        const r = scene.kind === 'clip' ? await shootClip(browser, scene) : await shootStill(browser, scene);
        results.push({ ...scene, ok: true, warnings: r.warnings });
        console.log(`  ${scene.kind.padEnd(5)} ${scene.file.padEnd(28)} ok${r.warnings.length ? `  (${r.warnings.length} console warns)` : ''}`);
      } catch (e) {
        results.push({ ...scene, ok: false, error: String(e).split('\n')[0] });
        console.log(`  ${scene.kind.padEnd(5)} ${scene.file.padEnd(28)} FAIL  ${String(e).split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
    try { rmSync(VIDEO_DIR, { recursive: true, force: true }); } catch {}
  }
  writeIndex(results);
  console.log(`\ncapture-excellence: ${results.filter((r) => r.ok).length}/${results.length} scenes → ${OUT}`);
}

function writeIndex(results) {
  const done = ONLY ? tryReadIndexScenes() : [];
  const lines = ['# M4B Excellence Pass — capture INDEX', '',
    'Every MOVING thing is a committed `.webm` CLIP (H0); static states are `.png` stills. All at a',
    '360×740 viewport, deviceScaleFactor 2, driven through the committed `window.__replay` hook.',
    'Clips unfreeze the table so real motion (the 175ms glide, drags, bot beats) plays. Rerun:',
    '`node apps/mobile/scripts/capture-excellence.mjs`.', '',
    '| File | Kind | Scene | Spec | Commit |', '|------|------|-------|------|--------|'];
  const rows = new Map();
  for (const d of done) rows.set(d.file, d);
  for (const r of results) rows.set(r.file, { file: r.file, kind: r.kind, what: r.what, spec: r.spec, ok: r.ok });
  for (const r of [...rows.values()]) {
    const ext = r.kind === 'clip' ? 'webm' : 'png';
    lines.push(`| \`${r.file}.${ext}\` | ${r.kind} | ${r.what ?? ''} | ${r.spec ?? ''} | _pending_ |`);
  }
  writeFileSync(join(OUT, 'INDEX.md'), lines.join('\n') + '\n');
}
function tryReadIndexScenes() { return []; }

main().catch((e) => { console.error(e); process.exit(1); });
