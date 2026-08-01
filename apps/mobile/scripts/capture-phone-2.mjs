// @ts-check
/**
 * pnpm capture:phone2 — PHONE-2 Q1 MOTION PROOF.
 *
 * PHONE-1 flag 1: a pass about FEEL cannot be evidenced by stills. This reuses the excellence-pass
 * recorder's pipeline (Playwright + the committed `window.__replay` / `__saudaCapturePaused` hooks)
 * but renders on the real PHONE device profiles — the tall 412x915 (plus one 360x740) instead of the
 * 360x740 lab frame — so the clips show the feel layer at the size the owner actually plays.
 *
 * Each scene is a webm CLIP (never a still): a money card FLINGING into the inflated bank strip and
 * committing · a MAKAAN thumb-drop onto a complete set via the drop band · a wheel scrub showing the
 * parting wave + magnify · a release that MISSES everything (pulse + ticker hint) · the SAME bot turn
 * recorded motion-on and with prefers-reduced-motion forced · Home -> setup -> deal-in.
 *
 * If a clip genuinely cannot render, the INDEX records the error — we never substitute a still.
 *
 * Reuses a dev server already running (default port 5174 — matches `pnpm dev:lan`); never starts one.
 *   node scripts/capture-phone-2.mjs [--only=<name,name>] [--port=5174]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import profileData from '../src/dev/deviceProfiles.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port ?? 5174);
const DEV_URL = `http://localhost:${PORT}`;
const OUT = resolve(REPO, 'docs/captures/phone-2');
const VIDEO_DIR = join(OUT, '_video_tmp');
const ONLY = argv.only ? String(argv.only).split(',') : null;
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const base = (id) => ({ seed: fixture.states[id].seed, actions: fixture.states[id].actions });

// The device profiles this pass renders on — read from the ONE shared testbed file so a clip can
// never claim a size the rest of the pipeline doesn't test.
const PROFILE = Object.fromEntries(profileData.profiles.map((p) => [p.id, p]));
const TALL = PROFILE['tall-412x915'];
const LEGACY = PROFILE['legacy-360x740'];
const REDUCED = PROFILE['reduced-412x915'];

async function frames(page, ms) { await page.waitForTimeout(ms); }

// Press a hand card's exposed LEFT strip and lift it past the band threshold into a real drag.
async function liftCard(page, cardSel) {
  const card = await page.locator(cardSel).first().boundingBox();
  if (!card) throw new Error(`no card ${cardSel}`);
  const start = { x: card.x + Math.min(12, card.width / 2), y: card.y + card.height * 0.4 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y - 55, { steps: 5 }); // lift out of the wheel into a drag
  return start;
}

// Carry to a zone and release ON its centre — a hot-zone commit (the card is already there).
async function dropOnZone(page, zoneSel, holdMs) {
  const zone = await page.locator(zoneSel).first().boundingBox();
  if (!zone) throw new Error(`no zone ${zoneSel}`);
  await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2, { steps: 10 });
  if (holdMs) await frames(page, holdMs); // let the hot glow paint on film
  await page.mouse.up();
  await frames(page, 600); // the commit + re-spacing glide settle
}

// A FLING: flick fast toward the bank and release just ABOVE it (outside the rect). With bank the only
// eligible zone, the near-miss/fling path flies the card into the strip and commits — the arc reads as
// a fling on film, and is robust (it commits whether the velocity estimate or the near-miss catches it).
async function flingToBank(page) {
  await liftCard(page, '[data-card-id*="money_"]');
  const bank = await page.locator('[data-drop="bank"]').first().boundingBox();
  if (!bank) throw new Error('no bank strip in the drop band');
  const aim = { x: bank.x + bank.width / 2, y: bank.y - 18 }; // just above the strip: outside, but near
  await page.mouse.move(aim.x, aim.y + 60, { steps: 2 }); // wind up
  await page.mouse.move(aim.x, aim.y, { steps: 2 }); // fast flick up toward the bank — high velocity
  await page.mouse.up(); // release outside the rect → fling / near-miss flight → commit
  await frames(page, 900); // the flight arc + bank count settle
}

// scrub the wheel left->right->left with real pointer moves — shows the parting wave + magnify (P5).
async function scrubWheel(page) {
  const cards = await page.locator('[data-card-id]').all();
  const boxes = [];
  for (const c of cards) { const b = await c.boundingBox(); if (b) boxes.push(b); }
  boxes.sort((a, b) => a.x - b.x);
  if (boxes.length === 0) return;
  const y = boxes[0].y + boxes[0].height * 0.35;
  await page.mouse.move(boxes[0].x + 6, y);
  await page.mouse.down();
  await frames(page, 140);
  for (const b of boxes) { await page.mouse.move(b.x + b.width * 0.5, y, { steps: 3 }); await frames(page, 150); }
  for (let i = boxes.length - 1; i >= 0; i--) { const b = boxes[i]; await page.mouse.move(b.x + b.width * 0.5, y, { steps: 3 }); await frames(page, 100); }
  await page.mouse.up();
  await frames(page, 300);
}

// ---------------------------------------------------------------------------
// The scenes. Each is a webm clip on a named device profile. `base` lands a recorded state (then the
// recorder unfreezes so real motion plays); `home` drives the front-door flow instead.
// ---------------------------------------------------------------------------
const SCENES = [
  {
    file: 'fling_money_to_bank', profile: TALL, base: base('S9_adla_badli'),
    what: 'A money card FLUNG from the wheel into the inflated bank strip — it flies in and the bank total commits.',
    act: async (page) => { await frames(page, 400); await flingToBank(page); },
  },
  {
    // A MAKAAN is an ACTION: its eligible target is the centre-stage PLAY zone (the property drop band
    // carries SET slots only for property placement). With exactly one complete set (Chennai) it builds
    // there directly — no picker. The play zone glows hot under the thumb, and release builds the MAKAAN.
    file: 'makaan_build_on_chennai', profile: TALL, base: base('S6_makaan'),
    what: 'A MAKAAN thumb-dropped onto the glowing centre-stage play target — with the complete Chennai set the only build site, release builds the MAKAAN onto Chennai.',
    act: async (page) => {
      await frames(page, 400);
      await liftCard(page, '[data-card-id*="makaan"]');
      await dropOnZone(page, '[data-drop="play"]', 350); // the centre-stage build target, glowing hot
    },
  },
  {
    // The one 360x740 clip (the flag's "plus one 360x740") — the tightest width is the hardest test of
    // the wheel spread, so the parting wave + magnify are proved where they're most under pressure.
    file: 'wheel_scrub_spread', profile: LEGACY, base: base('S10_eleven_cards'),
    what: 'An 11-card wheel scrubbed end to end at 360px — the cards PART around the pointer (the wave) and the one under it magnifies, at the tightest width.',
    act: async (page) => { await frames(page, 300); await scrubWheel(page); },
  },
  {
    file: 'near_miss_pulse', profile: TALL, base: base('S9_adla_badli'),
    what: 'A release that MISSES every zone — the card springs home and the board explains itself: the eligible zones pulse and a ticker hint appears (no silent mystery).',
    act: async (page) => {
      await frames(page, 400);
      await liftCard(page, '[data-card-id*="money_"]');
      await page.mouse.move(206, 130, { steps: 8 }); // carry up over the opponents band — far from any zone
      await frames(page, 120);
      await page.mouse.up(); // released over nothing → onMiss → pulse + hint
      await frames(page, 1700); // hold so the pulse + the ticker hint paint (auto-clears at 1600ms)
    },
  },
  {
    file: 'bot_turn_motion_on', profile: TALL, base: base('S6_haveli'),
    what: 'A full bot turn with MOTION ON — I end mine, control passes, the bot draws and plays with the travel/reveal animations and paced beats.',
    act: botTurn,
  },
  {
    file: 'bot_turn_reduced_motion', profile: REDUCED, base: base('S6_haveli'),
    what: 'The SAME bot turn with prefers-reduced-motion FORCED — the slides/scales are gone but the comprehension holds and turn beats remain, so it is still followable. Pair this with bot_turn_motion_on.',
    act: botTurn,
  },
  {
    file: 'home_setup_dealin', profile: TALL, home: true,
    what: 'The front door in motion — HOME, KHELO opens the setup card, DEAL deals the game in.',
    act: async (page) => {
      await frames(page, 500); // hold on HOME
      await page.getByText('KHELO').click();
      await frames(page, 700); // the setup card
      await page.getByText('DEAL').click();
      await frames(page, 1800); // the deal-in
    },
  },
];

async function botTurn(page) {
  const end = page.locator('button', { hasText: 'End turn' }).first();
  if (await end.count()) await end.click();
  await frames(page, 5200); // control passes; the bot draws + plays its paced beats
}

// PHONE-2 Q2 — the rebuilt Munshi advice card is a STATIC surface (only the medallion floats), so its
// layout proof is a still, one per phone width, checking the medallion · sentence · card row never
// overlaps AND that the card clears the board's pinned badges (the owner-flagged break). Reduced motion
// is forced so the medallion sits still for a clean frame.
const STILLS = [
  {
    file: 'MUNSHI_advice_360', width: 360, height: 740, reduced: true, base: base('S6_makaan'),
    what: 'The rebuilt advice card at 360px — medallion · sentence · recommended card, nothing overlapping, above the board badges.',
    prep: (page) => page.locator('button', { hasText: 'Munshi' }).first().click(),
  },
  {
    file: 'MUNSHI_advice_412', width: 412, height: 915, reduced: true, base: base('S6_makaan'),
    what: 'The rebuilt advice card at 412px — same three-column layout holds at the tall profile.',
    prep: (page) => page.locator('button', { hasText: 'Munshi' }).first().click(),
  },
  {
    // Q3: the dev HUD's reduced-motion line as an unmissable filled-red banner. ?hud=1 lives before the
    // hash (URLSearchParams reads window.location.search), and the context forces reduced motion.
    file: 'HUD_reduced_motion_on', width: 412, height: 915, reduced: true, url: `${DEV_URL}/?hud=1#/autostart`,
    what: 'Q3: the dev HUD shows reduced-motion ON as a red banner — the state the owner could not see on his first phone game.',
  },
  {
    // Q3: the quiet permanent pause-sheet disclosure, only present under reduced motion. Deal a game,
    // then open the pause sheet via the home glyph.
    file: 'PAUSE_reduced_motion_note', width: 412, height: 915, reduced: true, home: true,
    what: 'Q3: the in-game pause sheet carries one quiet permanent line disclosing that reduced motion is active.',
    prep: async (page) => {
      await page.getByText('KHELO').click(); await frames(page, 150);
      await page.getByText('DEAL').click(); await frames(page, 500);
      await page.getByLabel('Pause — game menu').click(); await frames(page, 300);
    },
  },
];

async function shootStill(browser, scene) {
  const context = await browser.newContext({ viewport: { width: scene.width, height: scene.height }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: scene.reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  if (scene.home) {
    await page.goto(`${DEV_URL}/#/`, { waitUntil: 'load' });
  } else {
    await page.goto(scene.url ?? `${DEV_URL}/#/autostart`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
    if (scene.base) { await page.evaluate((b) => window.__replay(b.seed, b.actions), scene.base); await frames(page, 250); }
  }
  if (scene.prep) await scene.prep(page);
  await frames(page, 300);
  await page.screenshot({ path: join(OUT, `${scene.file}.png`) });
  await context.close();
}

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

async function shootClip(browser, scene) {
  const profile = scene.profile;
  const scale = Math.min(profile.dpr, 2); // 2x is plenty crisp; the full DPR would make huge webms
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    isMobile: true,
    hasTouch: true,
    reducedMotion: profile.reducedMotion ? 'reduce' : 'no-preference',
    recordVideo: { dir: VIDEO_DIR, size: { width: Math.round(profile.width * scale), height: Math.round(profile.height * scale) } },
  });
  const page = await context.newPage();
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });

  if (scene.home) {
    await page.goto(`${DEV_URL}/#/`, { waitUntil: 'load' });
  } else {
    await page.goto(`${DEV_URL}/#/autostart`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
    await page.evaluate((b) => window.__replay(b.seed, b.actions), scene.base);
    await page.evaluate(() => { window.__saudaCapturePaused = false; }); // let the real motion play
    await frames(page, 200);
  }
  await scene.act(page);
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
  if (!(await reachable(DEV_URL))) {
    console.error(`capture:phone2: no dev server at ${DEV_URL} — start one (pnpm dev:lan) first.`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(VIDEO_DIR, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const scene of SCENES) {
      if (ONLY && !ONLY.includes(scene.file)) continue;
      try {
        const r = await shootClip(browser, scene);
        results.push({ ...scene, ok: true, warnings: r.warnings });
        console.log(`  ${scene.file.padEnd(28)} ${scene.profile.id.padEnd(16)} ok${r.warnings.length ? `  (${r.warnings.length} console warns)` : ''}`);
      } catch (e) {
        results.push({ ...scene, ok: false, error: String(e).split('\n')[0] });
        console.log(`  ${scene.file.padEnd(28)} ${scene.profile.id.padEnd(16)} FAIL  ${String(e).split('\n')[0]}`);
      }
    }
    if (!ONLY) {
      for (const still of STILLS) {
        try {
          await shootStill(browser, still);
          console.log(`  ${still.file.padEnd(28)} ${`${still.width}x${still.height}`.padEnd(16)} still ok`);
        } catch (e) {
          console.log(`  ${still.file.padEnd(28)} still FAIL  ${String(e).split('\n')[0]}`);
        }
      }
    }
  } finally {
    await browser.close();
    try { rmSync(VIDEO_DIR, { recursive: true, force: true }); } catch { /* temp video dir may already be gone */ }
  }
  writeIndex(results);
  console.log(`\ncapture:phone2: ${results.filter((r) => r.ok).length}/${results.length} clips → ${OUT}`);
}

function writeIndex(results) {
  const lines = [
    '# PHONE-2 motion-proof capture pack — INDEX', '',
    'PHONE-1 flag 1: feel cannot be shown with stills. Every entry here is a webm CLIP, rendered on the',
    'real phone device profiles (deviceProfiles.json) via the committed `window.__replay` hook, then',
    'UNFROZEN so real motion plays. The two bot-turn clips are the reduced-motion evidence: the same',
    'turn with motion on and with prefers-reduced-motion forced, side by side.', '',
    'Rerun: `pnpm dev:lan` in one shell, then `pnpm capture:phone2`.', '',
    '| Clip | Profile | What it proves |', '|------|---------|----------------|',
  ];
  for (const r of results) {
    const cell = r.ok ? r.what : `**DID NOT RENDER** — ${r.error}`;
    lines.push(`| \`${r.file}.webm\` | ${r.profile.width}×${r.profile.height}${r.profile.reducedMotion ? ' · reduced' : ''} | ${cell} |`);
  }
  lines.push('',
    '## Static-surface stills (Q2 Munshi layout · Q3 reduced-motion disclosure)',
    '',
    'The rebuilt Munshi advice card is static (only the medallion floats), so its layout is a still at',
    'each width — BEFORE: `docs/captures/phone-1/interaction/MUNSHI_open.png`. The Q3 stills show the',
    'two reduced-motion disclosures (the paired bot-turn clips above are the comprehension evidence).', '',
    '| Still | Size | What it proves |', '|-------|------|----------------|');
  for (const s of STILLS) {
    lines.push(`| \`${s.file}.png\` | ${s.width}×${s.height}${s.reduced ? ' · reduced' : ''} | ${s.what} |`);
  }
  lines.push('');
  writeFileSync(join(OUT, 'INDEX.md'), lines.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
