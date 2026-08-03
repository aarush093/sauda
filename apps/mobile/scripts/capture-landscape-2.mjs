// @ts-check
/**
 * pnpm capture:landscape2 — LANDSCAPE-2 close-out evidence pack (owner landscape directive).
 *
 * Three stages, selectable with --stage (default: all), all writing to docs/captures/landscape-2:
 *   --stage=l4        L4 stills: the restored TABLE BAND (draw count + discard top) in MY-TURN and
 *                     SPECTATE, at two profiles.
 *   --stage=clips     L2 motion proof: webm CLIPS on tall-915x412 (+ one legacy-740x360) — the
 *                     MY-TURN<->SPECTATE transition both ways, a captioned bot turn, HAATH KI SAFAI
 *                     targeting with the My-Sets reference open, the owe-Rs2 / pay-banked-Rs3 overpay,
 *                     a landscape wheel scrub, and a money card flung into the bank.
 *   --stage=profiles  L3 stills: MY-TURN, SPECTATE and the targeting split on the three never-looked-at
 *                     profiles (compact-800x360, mid-832x384, reduced-915x412), for an eyeball audit.
 *
 * It reuses the committed dev hooks (window.__replay / __sauda / __saudaCapturePaused) exactly like the
 * R capture, so nothing about the shipped app changes. A per-run results.json accumulates outcomes so
 * INDEX.md stays coherent no matter which stage(s) ran. Any clip that will not render is recorded with
 * its exact error — a still is NEVER substituted for a clip (LANDSCAPE-2 L2 law).
 *
 * Reuses a dev server already running (default port 5174 — matches `pnpm dev:lan`); never starts one.
 *   node scripts/capture-landscape-2.mjs [--stage=l4|clips|profiles|all] [--port=5174]
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
const DEV = `http://localhost:${PORT}`;
const STAGE = String(argv.stage ?? 'all');
const OUT = resolve(REPO, 'docs/captures/landscape-2');
const VIDEO_DIR = join(OUT, '_video_tmp');
const RESULTS = join(OUT, 'results.json');
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const P = Object.fromEntries(profileData.profiles.map((p) => [p.id, p]));

const SPOTLIGHT = ['ActionPlayed', 'CardBanked', 'PropertyPlaced', 'BuildingPlaced', 'CardReceived'];

// ── shared driving helpers (same shapes the R / phone-2 captures use) ──────────────────────────────
async function frames(page, ms) { await page.waitForTimeout(ms); }

async function bootReplay(page, sid) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  const s = fixture.states[sid];
  await page.evaluate((x) => window.__replay(x.seed, x.actions), { seed: s.seed, actions: s.actions });
  await frames(page, 250);
}

// Drive a bot to a real play so SPECTATE renders with its R2 caption. Returns whether a play landed.
async function reachSpectate(page, sid = 'S9_adla_badli') {
  await bootReplay(page, sid);
  await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' }));
  let played = false;
  for (let i = 0; i < 6 && !played; i++) {
    await page.evaluate(() => window.__sauda.getState().stepBot());
    await frames(page, 140);
    played = await page.evaluate((PLAY) => {
      const g = window.__sauda.getState();
      const actor = g.state.currentPlayerIndex;
      return g.lastEvents.some((e) => e.player === actor && PLAY.includes(e.type));
    }, SPOTLIGHT);
  }
  await frames(page, 300);
  return played;
}

// Land player 0 on their SECOND turn holding HAATH KI SAFAI, with opponents now holding stealable
// (not-complete-set) single properties — the only deterministic route, since no committed fixture has
// haathKiSafai in a play-turn hand and turn 1 has no stealable targets. Seed 15's opening hand already
// holds all three haathKiSafai; we simply pass turn 1 (bots place properties) and draw into turn 2.
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

// Scrub the wheel across its cards with real pointer moves — the parting wave + magnify (P5).
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

// ── results.json accumulation (keeps INDEX coherent across staged runs) ────────────────────────────
function loadResults() { try { return JSON.parse(readFileSync(RESULTS, 'utf8')); } catch { return {}; } }
function saveResult(store, file, entry) { store[file] = entry; writeFileSync(RESULTS, JSON.stringify(store, null, 2)); }

// ── L4: table-band stills ──────────────────────────────────────────────────────────────────────────
async function ctx(browser, profile, opts = {}) {
  return browser.newContext({
    viewport: { width: opts.width ?? profile.width, height: opts.height ?? profile.height },
    deviceScaleFactor: profile.dpr, isMobile: true, hasTouch: true,
    reducedMotion: (opts.reduced ?? profile.reducedMotion) ? 'reduce' : 'no-preference',
  });
}

async function stageL4(browser, store) {
  for (const id of ['tall-915x412', 'legacy-740x360']) {
    const profile = P[id];
    const tag = `${profile.width}x${profile.height}`;
    // MY-TURN — the band pinned top-right of the centre stage.
    {
      const c = await ctx(browser, profile);
      const page = await c.newPage();
      await bootReplay(page, 'S6_makaan');
      await frames(page, 300);
      const has = await page.locator('[data-zone="tableBand"]').count();
      const file = `l4_band_myturn_${tag}.png`;
      await page.screenshot({ path: join(OUT, file) });
      saveResult(store, file, { ok: has > 0, what: `L4 table band (draw count + discard top) in MY-TURN @ ${tag}` });
      console.log(`  ${has > 0 ? 'ok  ' : 'MISS'} ${file}`);
      await c.close();
    }
    // SPECTATE — the band pinned bottom-right of the acting stage.
    {
      const c = await ctx(browser, profile);
      const page = await c.newPage();
      const played = await reachSpectate(page);
      const has = await page.locator('[data-zone="tableBand"]').count();
      const file = `l4_band_spectate_${tag}.png`;
      await page.screenshot({ path: join(OUT, file) });
      saveResult(store, file, { ok: has > 0 && played, what: `L4 table band in SPECTATE @ ${tag}`, note: played ? '' : 'bot did not reach a play' });
      console.log(`  ${has > 0 && played ? 'ok  ' : 'MISS'} ${file}`);
      await c.close();
    }
  }
}

// ── L2: motion-proof clips ───────────────────────────────────────────────────────────────────────
const CLIPS = [
  {
    file: 'transition_myturn_to_spectate', profile: 'tall-915x412',
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
    file: 'transition_spectate_to_myturn', profile: 'tall-915x412',
    what: 'SPECTATE -> MY-TURN: after the bots finish, focus returns to me and my world fills the screen.',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' })); // into spectate
      await page.evaluate(() => { window.__saudaCapturePaused = false; }); // let the bots auto-play round to me
      await frames(page, 9000); // the three bots take their turns; control returns to me (the return flip)
    },
  },
  {
    file: 'bot_turn_captioned', profile: 'tall-915x412',
    what: 'A full bot turn in SPECTATE — the "Bn · <place>" caption sits BESIDE the played card on stage, never occluded.',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' }));
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 6000); // the bot draws and plays; the caption paints beside its card
    },
  },
  {
    file: 'targeting_haath_ki_safai', profile: 'tall-915x412',
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
    file: 'overpay_owe2_pay_banked3', profile: 'tall-915x412',
    what: 'I owe Rs2 (a bot plays SHAGUN) and pay with a BANKED Rs3 action card — the meter reads "no change given" (the R4 overpay).',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      // Setup (fast, synchronous): bank an action card worth Rs3, then have bot p1 draw and play SHAGUN
      // so every opponent (me included) is charged Rs2. Shagun opens a NAHI window per target, so the
      // charge lands as `awaitingResponse` first; unpausing lets the bots auto-respond and — since I
      // hold no NAHI CHALEGA — auto-allows my charge (D2), leaving the payment sheet open on me.
      const set = await page.evaluate(() => {
        const g = () => window.__sauda.getState();
        g().dispatch({ type: 'BANK_CARD', cardId: 'action_adlaBadli_1' }); // a banked Rs3 action card
        g().dispatch({ type: 'END_TURN' });
        g().dispatch({ type: 'DRAW' }); // bot p1 draws so it may play
        const shagun = g().state.players[1].hand.find((c) => c.includes('shagun'));
        if (!shagun) return { ok: false };
        g().dispatch({ type: 'PLAY_ACTION', cardId: shagun, params: { action: 'shagun' } });
        // Shagun charges every opponent; the stack resolves LIFO, so the two BOT charges land on top of
        // mine. Resolve them synchronously (each bot allows + pays via its own brain) until my charge is
        // the active one, then allow it myself so the payment sheet opens on ME — no waiting on the
        // paced bot-beat timers (which would blow the clip's wait budget).
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
      // Self-verify the OVERPAY actually rendered — the meter must now disclose "no change given".
      await page.waitForSelector('text=no change given', { timeout: 3000 });
      await frames(page, 1000); // hold on the "Rs3 / 2 Cr · no change given" meter
      await page.locator('button:has-text("Pay")').first().click();
      await frames(page, 900); // the overpay commits
    },
  },
  {
    file: 'wheel_scrub_landscape', profile: 'tall-915x412',
    what: 'An 11-card hand wheel scrubbed end to end at full landscape width — the cards PART around the pointer and the one under it MAGNIFIES.',
    run: async (page) => {
      await bootReplay(page, 'S10_eleven_cards');
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 400);
      await scrubWheel(page);
    },
  },
  {
    file: 'money_fling_to_bank', profile: 'tall-915x412',
    what: 'A money card FLUNG from the wheel into the bank tray — it flies in and the bank total commits.',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 400);
      await flingToBank(page);
    },
  },
  {
    // the flag's "plus one legacy-740x360" — the transition at the tightest short edge.
    file: 'transition_myturn_to_spectate_legacy', profile: 'legacy-740x360',
    what: 'The MY-TURN -> SPECTATE transition at the tightest 740x360 profile — the focus flip still reads.',
    run: async (page) => {
      await bootReplay(page, 'S9_adla_badli');
      await page.evaluate(() => { window.__saudaCapturePaused = false; });
      await frames(page, 600);
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' }));
      await frames(page, 2600);
    },
  },
];

async function shootClip(browser, scene, store) {
  const profile = P[scene.profile];
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
  const file = `${scene.file}.webm`;
  if (video && !error) {
    const src = await video.path();
    const dest = join(OUT, file);
    if (existsSync(dest)) rmSync(dest);
    renameSync(src, dest);
  }
  saveResult(store, file, { ok: !error, what: scene.what, profile: `${profile.width}x${profile.height}`, note: error ?? '' });
  console.log(`  ${error ? 'FAIL' : 'ok  '} ${file}  ${error ?? ''}`);
}

async function stageClips(browser, store) {
  for (const scene of CLIPS) await shootClip(browser, scene, store);
}

// ── L3: the never-looked-at profiles (MY-TURN, SPECTATE, targeting split) ──────────────────────────
async function stageProfiles(browser, store) {
  for (const id of ['compact-800x360', 'mid-832x384', 'reduced-915x412']) {
    const profile = P[id];
    const tag = `${profile.width}x${profile.height}${profile.reducedMotion ? '_reduced' : ''}`;
    // MY-TURN
    {
      const c = await ctx(browser, profile);
      const page = await c.newPage();
      await bootReplay(page, 'S6_makaan');
      await frames(page, 300);
      const file = `l3_myturn_${tag}.png`;
      await page.screenshot({ path: join(OUT, file) });
      saveResult(store, file, { ok: true, what: `L3 MY-TURN @ ${tag}` });
      console.log(`  ok   ${file}`);
      await c.close();
    }
    // SPECTATE
    {
      const c = await ctx(browser, profile);
      const page = await c.newPage();
      const played = await reachSpectate(page);
      const file = `l3_spectate_${tag}.png`;
      await page.screenshot({ path: join(OUT, file) });
      saveResult(store, file, { ok: played, what: `L3 SPECTATE @ ${tag}`, note: played ? '' : 'bot did not reach a play' });
      console.log(`  ${played ? 'ok  ' : 'MISS'} ${file}`);
      await c.close();
    }
    // TARGETING split (HAATH KI SAFAI)
    {
      const c = await ctx(browser, profile);
      const page = await c.newPage();
      let ok = false; let note = '';
      try {
        const landed = await landHaathKiSafaiTurn(page);
        if (!landed.ok || !landed.card) throw new Error('no haathKiSafai play turn');
        await frames(page, 300);
        await liftCard(page, `[data-card-id="${landed.card}"]`);
        await dragToPlay(page, 200);
        await page.waitForSelector('text=Your sets — reference', { timeout: 4000 });
        ok = true;
      } catch (e) { note = String(e).split('\n')[0]; }
      const file = `l3_targeting_${tag}.png`;
      await page.screenshot({ path: join(OUT, file) });
      saveResult(store, file, { ok, what: `L3 targeting split (HAATH KI SAFAI + My-Sets reference) @ ${tag}`, note });
      console.log(`  ${ok ? 'ok  ' : 'MISS'} ${file}  ${note}`);
      await c.close();
    }
  }
}

// ── L6: orientation-shell verification (rotate gate · fullscreen lock · HUD) ───────────────────────
async function stageL6(browser, store) {
  const tall = P['tall-915x412'];
  // 1) PORTRAIT raises the rotate gate; the game is NOT laid out behind it.
  {
    const c = await ctx(browser, tall, { width: tall.height, height: tall.width }); // swapped → portrait
    const page = await c.newPage();
    await page.goto(`${DEV}/#/`, { waitUntil: 'load' });
    await frames(page, 500);
    const gate = await page.locator('[data-rotate-gate]').count();
    const btn = await page.locator('button:has-text("Go fullscreen")').count();
    const file = 'l6_rotate_gate_portrait.png';
    await page.screenshot({ path: join(OUT, file) });
    saveResult(store, file, { ok: gate > 0 && btn > 0, what: 'L6 portrait raises the rotate interstitial with the "Go fullscreen" affordance' });
    console.log(`  ${gate > 0 && btn > 0 ? 'ok  ' : 'MISS'} ${file}  (gate=${gate} button=${btn})`);
    // 2) The "Go fullscreen" affordance calls requestFullscreen + orientation.lock('landscape') and
    //    swallows failure. Spy on both, click, and assert it neither throws nor leaves an error.
    const spy = await page.evaluate(async () => {
      const calls = { fullscreen: false, lock: null, threw: false };
      const el = document.documentElement;
      // fullscreen RESOLVES so the lock path is reached; the lock then REJECTS (as it would on a
      // browser that refuses orientation.lock) to prove the failure is swallowed, not thrown.
      el.requestFullscreen = () => { calls.fullscreen = true; return Promise.resolve(); };
      const orient = window.screen.orientation;
      if (orient) orient.lock = (o) => { calls.lock = o; return Promise.reject(new Error('lock unsupported')); };
      try {
        const btnEl = [...document.querySelectorAll('button')].find((b) => /Go fullscreen/.test(b.textContent || ''));
        btnEl?.click();
        await new Promise((r) => setTimeout(r, 150));
      } catch { calls.threw = true; }
      return calls;
    });
    saveResult(store, 'l6_fullscreen_affordance', { ok: spy.fullscreen && !spy.threw, what: `L6 "Go fullscreen" calls requestFullscreen (lock='${spy.lock}') and fails gracefully (no throw)`, png: false });
    console.log(`  ${spy.fullscreen && !spy.threw ? 'ok  ' : 'MISS'} fullscreen affordance  (fullscreen=${spy.fullscreen} lock=${spy.lock} threw=${spy.threw})`);
    await c.close();
  }
  // 3) LANDSCAPE enters the game (no gate).
  {
    const c = await ctx(browser, tall);
    const page = await c.newPage();
    await bootReplay(page, 'S6_makaan');
    await frames(page, 300);
    const gate = await page.locator('[data-rotate-gate]').count();
    const file = 'l6_landscape_enters_game.png';
    await page.screenshot({ path: join(OUT, file) });
    saveResult(store, file, { ok: gate === 0, what: 'L6 landscape enters the game directly (no rotate gate)' });
    console.log(`  ${gate === 0 ? 'ok  ' : 'MISS'} ${file}  (gate=${gate})`);
    await c.close();
  }
  // 4) ?hud=1 shows orientation + reduced-motion; under forced reduced motion it reads ON.
  {
    const c = await ctx(browser, tall, { reduced: true });
    const page = await c.newPage();
    await page.goto(`${DEV}/?hud=1#/autostart`, { waitUntil: 'load' });
    await frames(page, 600);
    const text = await page.evaluate(() => document.body.innerText);
    const showsOrientation = /orientation:\s*landscape/.test(text);
    const showsReduced = /reduced-motion:\s*ON/.test(text);
    const file = 'l6_hud_orientation_reduced.png';
    await page.screenshot({ path: join(OUT, file) });
    saveResult(store, file, { ok: showsOrientation && showsReduced, what: 'L6 ?hud=1 shows orientation (landscape) + reduced-motion (ON, forced) — the battery-saver state the owner could not see' });
    console.log(`  ${showsOrientation && showsReduced ? 'ok  ' : 'MISS'} ${file}  (orientation=${showsOrientation} reducedON=${showsReduced})`);
    await c.close();
  }
}

// ── INDEX ────────────────────────────────────────────────────────────────────────────────────────
function writeIndex(store) {
  const rows = Object.entries(store).sort(([a], [b]) => a.localeCompare(b));
  const clips = rows.filter(([f]) => f.endsWith('.webm'));
  const stills = rows.filter(([f]) => f.endsWith('.png'));
  const checks = rows.filter(([f]) => !f.endsWith('.webm') && !f.endsWith('.png'));
  const lines = [
    '# LANDSCAPE-2 — close-out capture pack INDEX', '',
    'The verify/prove/clean pass. Clips are real webm MOTION (L2); stills are full frames for the',
    'eyeball audits (L3) and the restored table band (L4). All shot on the landscape device profiles',
    '(deviceProfiles.json) via the committed `window.__replay` hook. A clip that will not render is',
    'listed with its exact error — never replaced by a still.', '',
    'Rerun: `pnpm dev:lan` in one shell, then `pnpm capture:landscape2` (or `--stage=l4|clips|profiles`).', '',
    '## Clips (L2 — motion proof)', '',
    '| Clip | Profile | What it proves |', '|------|---------|----------------|',
  ];
  for (const [file, r] of clips) {
    const cell = r.ok ? r.what : `**DID NOT RENDER** — ${r.note || 'unknown error'}`;
    lines.push(`| \`${file}\` | ${r.profile ?? ''} | ${cell} |`);
  }
  lines.push('', '## Stills (L4 table band · L3 profile audit)', '',
    '| Still | Proves |', '|-------|--------|');
  for (const [file, r] of stills) {
    lines.push(`| \`${file}\` | ${r.ok ? r.what : `**MISSING** — ${r.note || r.what}`} |`);
  }
  if (checks.length > 0) {
    lines.push('', '## Non-image checks (L6 shell verification)', '', '| Check | Verdict |', '|-------|---------|');
    for (const [name, r] of checks) {
      lines.push(`| \`${name}\` | ${r.ok ? `PASS — ${r.what}` : `**FAIL** — ${r.what}`} |`);
    }
  }
  lines.push('');
  writeFileSync(join(OUT, 'INDEX.md'), lines.join('\n') + '\n');
}

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

async function main() {
  if (!(await reachable(DEV))) {
    console.error(`capture:landscape2: no dev server at ${DEV} — start one (pnpm dev:lan) first.`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(VIDEO_DIR, { recursive: true });
  const store = loadResults();
  const browser = await chromium.launch();
  try {
    if (STAGE === 'all' || STAGE === 'l4') { console.log('L4 — table band stills'); await stageL4(browser, store); }
    if (STAGE === 'all' || STAGE === 'clips') { console.log('L2 — motion clips'); await stageClips(browser, store); }
    if (STAGE === 'all' || STAGE === 'profiles') { console.log('L3 — profile stills'); await stageProfiles(browser, store); }
    if (STAGE === 'all' || STAGE === 'l6') { console.log('L6 — orientation shell'); await stageL6(browser, store); }
  } finally {
    await browser.close();
    try { rmSync(VIDEO_DIR, { recursive: true, force: true }); } catch { /* temp dir may already be gone */ }
  }
  writeIndex(store);
  const all = Object.values(store);
  console.log(`\ncapture:landscape2 [${STAGE}]: ${all.filter((r) => r.ok).length}/${all.length} artifacts ok → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
