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

// H1b: a found seed (tools/src/find-receive.ts) landing SEAT 0 in awaitingReceive — a wildcard
// (wild_newDelhi_junction_0) is theirs to place, sitting on centre stage with its two colour-sets
// (newDelhi · junction) glowing (matrix C7 / G6). The same stage surface serves a payment-received
// wildcard; here it arrives via a HAATH KI SAFAI steal of a wildcard, which the engine correctly
// opens as a placement CHOICE (a stolen wildcard can join either of its colours).
const RECEIVE = { seed: 1, actions: [{ type: 'DRAW' }, { type: 'PLACE_PROPERTY', cardId: 'prop_puraniDilli_0', set: 'puraniDilli' }, { type: 'PLACE_PROPERTY', cardId: 'prop_bangalore_2', set: 'bangalore' }, { type: 'PLACE_PROPERTY', cardId: 'prop_junction_2', set: 'junction' }, { type: 'END_TURN' }, { type: 'DRAW' }, { type: 'PLACE_PROPERTY', cardId: 'wild_jaipur_kolkata_0', set: 'jaipur' }, { type: 'PLACE_PROPERTY', cardId: 'prop_kashi_1', set: 'kashi' }, { type: 'PLACE_PROPERTY', cardId: 'wild_newDelhi_junction_0', set: 'newDelhi' }, { type: 'END_TURN' }, { type: 'DRAW' }, { type: 'PLACE_PROPERTY', cardId: 'wild_any_0', set: 'puraniDilli' }, { type: 'PLAY_ACTION', cardId: 'action_haathKiSafai_2', params: { action: 'haathKiSafai', target: 0, cardId: 'prop_puraniDilli_0' } }, { type: 'RESPOND_ALLOW' }, { type: 'PLACE_PROPERTY', cardId: 'prop_chennai_2', set: 'chennai' }, { type: 'END_TURN' }, { type: 'DRAW' }, { type: 'PLACE_PROPERTY', cardId: 'wild_mumbai_newDelhi_0', set: 'mumbai' }, { type: 'PLACE_PROPERTY', cardId: 'prop_jaipur_0', set: 'jaipur' }, { type: 'PLACE_PROPERTY', cardId: 'prop_bangalore_0', set: 'bangalore' }, { type: 'END_TURN' }, { type: 'DRAW' }, { type: 'PLAY_ACTION', cardId: 'action_haathKiSafai_1', params: { action: 'haathKiSafai', target: 1, cardId: 'wild_newDelhi_junction_0' } }, { type: 'RESPOND_ALLOW' }] };

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
  // ---- H1c a drag-to-bank (money → bank, hot glow, commit) ----
  {
    file: 'H1_drag_to_bank', kind: 'clip', spec: 'A10 L3 · H1c', base: base('S9_adla_badli'),
    what: 'A money card dragged from the wheel to the bank — the bank glows HOT, release banks it and the hand glides to re-space.',
    act: async (page) => { await scrubDragToZone(page, 'money_3_1', '[data-drop="bank"]', true); },
  },
  // ---- H1c the discard overlay end to end ----
  {
    file: 'H1_discard_overlay', kind: 'clip', spec: 'G3 · A8/A9 · H1c', base: base('S5_discard_mode'),
    what: 'The over-the-limit discard overlay end to end — real card faces spread; tapping buries each under the draw pile until the count hits 7 and it dismisses.',
    act: async (page) => {
      await frames(page, 500);
      for (let i = 0; i < 6; i++) {
        const cards = await page.locator('[data-card-id]').all();
        if (cards.length <= 7) break;
        const b = await cards[cards.length - 1].boundingBox();
        if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await frames(page, 450);
      }
      await frames(page, 500);
    },
  },
  // ---- H1c a full bot turn (paced beats) ----
  {
    file: 'H1_bot_turn', kind: 'clip', spec: 'I1 · H5 · H1c', base: base('S6_haveli'),
    what: 'A full bot turn — I end mine, control passes, the bot draws and plays with paced beats (H5), each card held to be seen.',
    act: async (page) => {
      const end = page.locator('button', { hasText: 'End turn' }).first();
      if (await end.count()) await end.click();
      await frames(page, 5200);
    },
  },
  // ---- H1b the received-card flow (still + clip) ----
  {
    file: 'H1_received_stage', kind: 'still', spec: 'H1b · G6 · C7', base: RECEIVE,
    what: 'A received wildcard on centre stage — "Drag it to a glowing set", its two colour-sets (newDelhi · junction) glowing below.',
  },
  {
    file: 'H1_received_flow', kind: 'clip', spec: 'H1b · G6 · C7', base: RECEIVE,
    what: 'The received-card flow — the wildcard sits on centre stage, legal sets glow, I drag it home to a set (RESPOND_PLACE_RECEIVED).',
    act: async (page) => {
      await frames(page, 700); // hold: the card on stage + the glowing destination sets
      const card = await page.locator('[data-card-id="wild_newDelhi_junction_0"]').first().boundingBox();
      const target = await page.locator('[data-drop="set:newDelhi"], [data-drop="set:junction"]').first().boundingBox();
      if (card && target) {
        await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await page.mouse.down();
        await page.mouse.move(card.x + card.width / 2 + 14, card.y + card.height / 2 + 14, { steps: 4 }); // past the slop
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
        await frames(page, 300); // hold over the glowing set
        await page.mouse.up();
      }
      await frames(page, 700);
    },
  },
  // ---- H2 the manual EARLY end (plays remain, button reachable) ----
  {
    file: 'H2_endturn_early', kind: 'clip', spec: 'H2a', base: base('S6_haveli'),
    what: 'On my own turn with plays STILL remaining, End turn is visible in the header and reachable — clicking it ends the turn early (never dead).',
    act: async (page) => {
      await frames(page, 1400); // hold on the board: "N plays left" + End turn both visible
      const end = page.locator('button', { hasText: 'End turn' }).first();
      if (await end.count()) await end.click();
      await frames(page, 1200);
    },
  },
  // ---- H3 glide vs drag interplay (commit mid-glide, drag during a glide) ----
  {
    file: 'H3_glide_vs_drag', kind: 'clip', spec: 'G2 · H3', url: '#/dev/wheel/8',
    what: 'Glide/drag interplay — a card leaves mid-glide and another is grabbed while the re-spacing is still in flight; no double animation, no hit-target drift.',
    act: async (page) => {
      await frames(page, 300);
      const tap = async (frac) => { const bs = (await bandBoxes(page)); const b = bs[Math.floor(bs.length * frac)]; if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.4); };
      await tap(0.5); await frames(page, 70); // commit while the previous glide is still easing
      await tap(0.3); await frames(page, 70);
      // start a scrub-drag during the glide
      const bs = await bandBoxes(page);
      if (bs.length) { const b = bs[Math.floor(bs.length / 2)]; const y = b.y + b.height * 0.35; await page.mouse.move(b.x + b.width / 2, y); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, y - 55, { steps: 5 }); await frames(page, 250); await page.mouse.move(5, 5); await page.mouse.up(); }
      await frames(page, 400);
    },
  },
];

async function bandBoxes(page) {
  const cards = await page.locator('[data-card-id]').all();
  const boxes = [];
  for (const c of cards) { const b = await c.boundingBox(); if (b) boxes.push(b); }
  boxes.sort((a, b) => a.x - b.x);
  return boxes;
}
// A scrub-drag: press at a card's exposed left strip, lift into a drag, carry to a zone, release.
async function scrubDragToZone(page, cardId, zoneSel, hold) {
  const card = await page.locator(`[data-card-id="${cardId}"]`).first().boundingBox();
  if (!card) throw new Error(`no card ${cardId}`);
  const start = { x: card.x + Math.min(12, card.width / 2), y: card.y + card.height * 0.4 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - 55, { steps: 5 }); // lift past the band into a drag
  const zone = await page.locator(zoneSel).first().boundingBox();
  if (zone) await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2, { steps: 10 });
  if (hold) await frames(page, 350); // hold so the hot glow paints on film
  await page.mouse.up();
  await frames(page, 500); // the commit + re-spacing glide settle
}

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
