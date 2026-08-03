// @ts-check
/**
 * pnpm capture:landscape4 — LANDSCAPE-4 N1 motion-proof pack (the "prove it MOVES" pass).
 *
 * LANDSCAPE-2 already committed the six motion clips on tall-915x412 (plus one legacy transition).
 * N1 asks for the same six proofs rendered FRESH at HEAD and on BOTH landscape profiles the owner
 * will actually hand out — tall-915x412 AND legacy-740x360 — so the tightest short edge (360px) is
 * proven to move, not just sampled as a still. This script re-runs the exact L2 driving harness (the
 * committed window.__replay / __sauda / __saudaCapturePaused dev hooks — nothing about the shipped app
 * changes) once per profile and writes to docs/captures/landscape-4.
 *
 * HARD RULE (N1): a clip that will not render is recorded in INDEX with its EXACT error. A still is
 * NEVER substituted for a motion claim — a missing .webm is an open gap, stated as such.
 *
 * Reuses a dev server already running (default port 5174 — matches `pnpm dev:lan`); never starts one.
 *   node scripts/capture-landscape-4.mjs [--port=5174] [--only=<scene-file-substring>]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import profileData from '../src/dev/deviceProfiles.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port ?? 5174);
const DEV = `http://localhost:${PORT}`;
const ONLY = argv.only ? String(argv.only) : null;
const OUT = resolve(REPO, 'docs/captures/landscape-4');
const VIDEO_DIR = join(OUT, '_video_tmp');
const RESULTS = join(OUT, 'results.json');
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const P = Object.fromEntries(profileData.profiles.map((p) => [p.id, p]));

// The two profiles the owner will actually hand a friend: the widest and the tightest short edge.
const PROFILE_IDS = ['tall-915x412', 'legacy-740x360'];

// ── shared driving helpers (verbatim from the L2 capture — same dev hooks, same shapes) ─────────────
async function frames(page, ms) { await page.waitForTimeout(ms); }

async function bootReplay(page, sid) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  const s = fixture.states[sid];
  await page.evaluate((x) => window.__replay(x.seed, x.actions), { seed: s.seed, actions: s.actions });
  await frames(page, 250);
}

// Land player 0 on their SECOND turn holding HAATH KI SAFAI, with opponents holding stealable
// (not-complete-set) single properties — see L2 capture: seed 15 opens with all three haathKiSafai.
async function landHaathKiSafaiTurn(page) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  return page.evaluate(() => {
    const g = () => window.__sauda.getState();
    window.__replay(15, []); // deal seed 15, no actions — player 0 to draw, holding haathKiSafai
    g().dispatch({ type: 'DRAW' });
    g().dispatch({ type: 'END_TURN' }); // pass turn 1 without playing it
    for (let i = 0; i < 40; i++) {
      const st = g().state;
      if (st.currentPlayerIndex === 0) break; // control has come back round to me
      g().stepBot(); // each bot plays its full legal turn (placing properties)
    }
    if (g().state.currentPlayerIndex === 0 && g().state.phase === 'awaitingDraw') {
      g().dispatch({ type: 'DRAW' }); // turn 2 draw → phase 'playing', haathKiSafai still in hand
    }
    const st = g().state;
    return { ok: st.currentPlayerIndex === 0 && st.phase === 'playing', card: st.players[0].hand.find((c) => c.includes('haathKiSafai')) ?? null };
  });
}

async function liftCard(page, cardSel) {
  const card = await page.locator(cardSel).first().boundingBox();
  if (!card) throw new Error(`no card ${cardSel}`);
  const start = { x: card.x + Math.min(12, card.width / 2), y: card.y + card.height * 0.4 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y - 55, { steps: 5 });
  return start;
}

async function dragToPlay(page, holdMs) {
  const play = await page.locator('[data-drop="play"]').first().boundingBox();
  if (!play) throw new Error('no play zone');
  await page.mouse.move(play.x + play.width / 2, play.y + play.height / 2, { steps: 10 });
  if (holdMs) await frames(page, holdMs);
  await page.mouse.up();
  await frames(page, 500);
}

// A FLING: flick fast toward the bank and release just above it — the fling / near-miss path flies the
// card into the strip and commits (robust whether the velocity estimate or the near-miss catches it).
async function flingToBank(page) {
  await liftCard(page, '[data-card-id*="money_"]');
  const bank = await page.locator('[data-drop="bank"]').first().boundingBox();
  if (!bank) throw new Error('no bank drop zone');
  const aim = { x: bank.x + bank.width / 2, y: bank.y - 16 };
  await page.mouse.move(aim.x, aim.y + 55, { steps: 2 });
  await page.mouse.move(aim.x, aim.y, { steps: 2 });
  await page.mouse.up();
  await frames(page, 900);
}

// Scrub the wheel across its cards with real pointer moves — the parting wave + magnify.
async function scrubWheel(page) {
  const cards = await page.locator('[data-card-id]').all();
  const boxes = [];
  for (const c of cards) { const bb = await c.boundingBox(); if (bb) boxes.push(bb); }
  boxes.sort((a, b) => a.x - b.x);
  if (boxes.length === 0) throw new Error('no wheel cards');
  const y = boxes[0].y + boxes[0].height * 0.35;
  await page.mouse.move(boxes[0].x + 6, y);
  await page.mouse.down();
  await frames(page, 140);
  for (const bb of boxes) { await page.mouse.move(bb.x + bb.width * 0.5, y, { steps: 3 }); await frames(page, 140); }
  for (let i = boxes.length - 1; i >= 0; i--) { await page.mouse.move(boxes[i].x + boxes[i].width * 0.5, y, { steps: 3 }); await frames(page, 100); }
  await page.mouse.up();
  await frames(page, 300);
}

// ── results.json accumulation (keeps INDEX coherent across staged / --only runs) ────────────────────
function loadResults() { try { return JSON.parse(readFileSync(RESULTS, 'utf8')); } catch { return {}; } }
function saveResult(store, file, entry) { store[file] = entry; writeFileSync(RESULTS, JSON.stringify(store, null, 2)); }

// ── the six motion proofs (profile-agnostic run functions — same as L2) ─────────────────────────────
const SCENES = [
  {
    file: 'transition_myturn_to_spectate',
    what: 'MY-TURN -> SPECTATE: I end my turn and focus follows the turn to the acting bot (the split slides in).',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 600); // hold on MY-TURN
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' }));
      await frames(page, 2600); // the focus transition into SPECTATE + the bot's first beat
    },
  },
  {
    file: 'transition_spectate_to_myturn',
    what: 'SPECTATE -> MY-TURN: after the bots finish, focus returns to me and my world fills the screen.',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' })); // into spectate
      await page.evaluate(() => { window.__saudaCapturePaused = false; }); // let the bots auto-play round to me
      await frames(page, 9000); // the three bots take their turns; control returns to me (the return flip)
    },
  },
  {
    file: 'bot_turn_captioned',
    what: 'A full bot turn in SPECTATE — the "Bn · <place>" caption sits BESIDE the played card on stage, never occluded.',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' }));
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 6000); // the bot draws and plays; the caption paints beside its card
    },
  },
  {
    file: 'targeting_haath_ki_safai',
    what: 'HAATH KI SAFAI played on my turn — the targeting split opens with the "Your sets — reference" panel OPEN beside the glowing targets.',
    run: async (page) => {
      const landed = await landHaathKiSafaiTurn(page);
      if (!landed.ok || !landed.card) throw new Error('could not land a haathKiSafai play turn');
      await frames(page, 500);
      await liftCard(page, `[data-card-id="${landed.card}"]`);
      await dragToPlay(page, 300);
      await page.waitForSelector('text=Your sets — reference', { timeout: 4000 });
      await frames(page, 1500); // hold on the open reference + glowing targets
    },
  },
  {
    file: 'overpay_owe2_pay_banked3',
    what: 'I owe Rs2 (a bot plays SHAGUN) and pay with a BANKED Rs3 action card — the meter reads "no change given" (the overpay).',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      // Setup (fast, synchronous): bank an action card worth Rs3, then have bot p1 draw and play SHAGUN so
      // every opponent (me included) is charged Rs2. Shagun opens a NAHI window per target, so the charge
      // lands as awaitingResponse first; resolving the stack LIFO leaves the payment sheet open on me.
      const set = await page.evaluate(() => {
        const g = () => window.__sauda.getState();
        g().dispatch({ type: 'BANK_CARD', cardId: 'action_adlaBadli_1' }); // a banked Rs3 action card
        g().dispatch({ type: 'END_TURN' });
        g().dispatch({ type: 'DRAW' }); // bot p1 draws so it may play
        const shagun = g().state.players[1].hand.find((c) => c.includes('shagun'));
        if (!shagun) return { ok: false };
        g().dispatch({ type: 'PLAY_ACTION', cardId: shagun, params: { action: 'shagun' } });
        for (let guard = 0; guard < 30; guard++) {
          const stack = g().state.pendingInterrupts;
          if (stack.length === 0) break;
          const active = stack[stack.length - 1];
          if (active.responder === 0 && active.status === 'awaitingPayment') break; // my payment is up
          if (active.responder === 0) g().dispatch({ type: 'RESPOND_ALLOW' }); // I hold no NAHI — allow
          else g().stepBot(); // a bot responder allows/pays itself
        }
        const mine = g().state.pendingInterrupts.find((i) => i.responder === 0 && i.status === 'awaitingPayment');
        return { ok: Boolean(mine) };
      });
      if (!set.ok) throw new Error('could not stage the owe-Rs2 charge (no bot shagun)');
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await page.waitForSelector('[data-pay-card="action_adlaBadli_1"]', { timeout: 6000 });
      await frames(page, 700); // hold on the opened payment sheet (its money-first default)
      // Select ONLY the banked action card: turn off any other currently-selected pay card, turn it on.
      const others = await page.locator('[data-pay-card]').all();
      for (const el of others) {
        const id = await el.getAttribute('data-pay-card');
        if (id === 'action_adlaBadli_1') continue;
        const selected = await el.evaluate((n) => n.style.opacity === '1');
        if (selected) { await el.click(); await frames(page, 200); }
      }
      await page.locator('[data-pay-card="action_adlaBadli_1"]').click();
      await page.waitForSelector('text=no change given', { timeout: 3000 }); // self-verify the overpay rendered
      await frames(page, 1000); // hold on the "Rs3 / 2 Cr · no change given" meter
      await page.locator('button:has-text("Pay")').first().click();
      await frames(page, 900); // the overpay commits
    },
  },
  {
    file: 'wheel_scrub_landscape',
    what: 'An 11-card hand wheel scrubbed end to end at full landscape width — the cards PART around the pointer and the one under it MAGNIFIES.',
    run: async (page) => {
      await bootReplay(page, 'S10_eleven_cards');
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 400);
      await scrubWheel(page);
    },
  },
  {
    file: 'money_fling_to_bank',
    what: 'A money card FLUNG from the wheel into the bank tray — it flies in and the bank total commits.',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 400);
      await flingToBank(page);
    },
  },
];

async function shootClip(browser, scene, profile, store) {
  const scale = Math.min(profile.dpr, 2);
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr, isMobile: true, hasTouch: true,
    reducedMotion: profile.reducedMotion ? 'reduce' : 'no-preference',
    recordVideo: { dir: VIDEO_DIR, size: { width: Math.round(profile.width * scale), height: Math.round(profile.height * scale) } },
  });
  const page = await context.newPage();
  let error = null;
  try {
    await scene.run(page);
  } catch (e) {
    error = String(e).split('\n')[0];
  }
  await frames(page, 150);
  const video = page.video();
  await context.close(); // finalises the webm
  const tag = `${profile.width}x${profile.height}`;
  const file = `${scene.file}__${tag}.webm`;
  if (video && !error) {
    const src = await video.path();
    const dest = join(OUT, file);
    if (existsSync(dest)) rmSync(dest);
    renameSync(src, dest);
  }
  saveResult(store, file, { ok: !error, what: scene.what, profile: tag, note: error ?? '', duration: !error ? probeDuration(join(OUT, file)) : null });
  console.log(`  ${error ? 'FAIL' : 'ok  '} ${file}  ${error ?? ''}`);
}

// Read a clip's duration for the INDEX via the Playwright-bundled ffmpeg (no extra dependency). Best
// effort: if ffmpeg is not on the expected path, the INDEX simply shows "—" rather than failing.
function probeDuration(clipPath) {
  try {
    const ff = process.env.FFMPEG_PATH || resolve(process.env.LOCALAPPDATA ?? '', 'ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
    if (!existsSync(ff)) return null;
    const out = execFileSync(ff, ['-i', clipPath], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
    return (out.match(/Duration:\s*([0-9:.]+)/) ?? [])[1] ?? null;
  } catch (e) {
    // ffmpeg exits non-zero when given only -i (no output file); its stderr still carries the Duration.
    const out = String(e.stderr ?? '');
    return (out.match(/Duration:\s*([0-9:.]+)/) ?? [])[1] ?? null;
  }
}

// ── INDEX ────────────────────────────────────────────────────────────────────────────────────────
function writeIndex(store) {
  const rows = Object.entries(store).sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '# LANDSCAPE-4 — N1 motion-proof pack INDEX', '',
    'The "prove it MOVES" pass. Every entry is a real webm MOTION clip, rendered fresh at HEAD via the',
    'committed `window.__replay` dev hooks, on BOTH landscape profiles the owner hands out: the widest',
    '(915x412) and the tightest short edge (740x360). A clip that will not render is listed with its',
    'EXACT error — a still is NEVER substituted for a motion claim (N1 hard rule).', '',
    'Rerun: `pnpm dev:lan` in one shell, then `pnpm capture:landscape4` (or `--only=<scene>`).', '',
    '| Clip | Profile | Duration | What it proves |', '|------|---------|----------|----------------|',
  ];
  for (const [file, r] of rows) {
    if (!file.endsWith('.webm')) continue;
    const cell = r.ok ? r.what : `**DID NOT RENDER** — ${r.note || 'unknown error'}`;
    lines.push(`| \`${file}\` | ${r.profile ?? ''} | ${r.duration ?? '—'} | ${cell} |`);
  }
  lines.push('');
  writeFileSync(join(OUT, 'INDEX.md'), lines.join('\n') + '\n');
}

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

async function main() {
  if (!(await reachable(DEV))) {
    console.error(`capture:landscape4: no dev server at ${DEV} — start one (pnpm dev:lan) first.`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(VIDEO_DIR, { recursive: true });
  const store = loadResults();
  const browser = await chromium.launch();
  try {
    for (const id of PROFILE_IDS) {
      const profile = P[id];
      console.log(`\nprofile ${profile.width}x${profile.height}`);
      for (const scene of SCENES) {
        if (ONLY && !scene.file.includes(ONLY)) continue;
        await shootClip(browser, scene, profile, store);
      }
    }
  } finally {
    await browser.close();
    try { rmSync(VIDEO_DIR, { recursive: true, force: true }); } catch { /* temp dir may already be gone */ }
  }
  writeIndex(store);
  const all = Object.values(store);
  console.log(`\ncapture:landscape4: ${all.filter((r) => r.ok).length}/${all.length} clips ok → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
