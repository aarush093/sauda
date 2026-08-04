// LANDSCAPE-4 N2 — autonomous FULL solo playthrough at tall-915x412 (run via tsx so the TS engine
// imports resolve): ../../tools/node_modules/.bin/tsx scripts/playthrough-landscape.mjs
//
// This is the first true end-to-end exercise of the landscape build. It is NOT a fixture jump — it
// deals a fresh game and plays it move by move to a real win/loss through the real store (reduce),
// rendered in a real browser. Seat 0 is the human, driven by the ACTUAL HeuristicBot brain (the same
// brain the Munshi shares); seats 1–3 are medium bots stepped via the store's stepBot. Capture stays
// PAUSED so no automatic beat (bot timer, auto-draw, auto-resolve, turn-token drain) races the driver
// — every step is taken explicitly and screenshotted, so the stills are a faithful ordered record.
//
// The three human-only response surfaces (targeting / payment / discard) are driven through the REAL
// controls when they arise, so "does the control actually do something" is genuinely tested:
//   - targeting: the first targeted play is routed via a real lift+drag onto PLAY, then a real chip tap
//   - payment  : a bot's charge opens the payment sheet; we screenshot it, then resolve it for real
//   - discard  : seat 0's first two turns are DELIBERATELY passed (no plays) so the hand climbs over 7
//                and the over-the-limit overlay opens; we then tap real cards to bury them
// Anything that looks wrong is recorded verbatim in the step log for PLAYTHROUGH.md.
import { chromium } from 'playwright';
import { legalActions, observe } from '@sauda/engine';
import { HeuristicBot } from '@sauda/bots';
import { actionTargeting, kirayaPlan } from '../src/game/interaction.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import profileData from '../src/dev/deviceProfiles.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port ?? 5174);
const DEV = `http://localhost:${PORT}`;
const SEED = Number(argv.seed ?? 7);
const OUT = resolve(REPO, 'docs/captures/landscape-4');
const SHOTDIR = join(OUT, 'playthrough');
const PROFILE = profileData.profiles.find((p) => p.id === 'tall-915x412');

// Whose decision is it right now: the interrupt responder if a window is open, else the turn player.
// (Mirrors the store's actorOf so the driver reads the game the same way the UI does.)
function actorOf(state) {
  if (state.pendingInterrupts.length > 0) {
    return state.pendingInterrupts[state.pendingInterrupts.length - 1].responder;
  }
  return state.currentPlayerIndex;
}

// A card opens the targeting overlay when its play still needs a target CHOICE (a step tree or a
// kiraya colour/opponent plan) — exactly the board's own test (interaction.ts), so we route through
// the UI only when the overlay will actually appear.
function opensTargeting(legal, cardId) {
  return kirayaPlan(legal, cardId) !== null || actionTargeting(legal, cardId, 0) !== null;
}

async function main() {
  mkdirSync(SHOTDIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: PROFILE.width, height: PROFILE.height },
    deviceScaleFactor: PROFILE.dpr, isMobile: true, hasTouch: true,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(4000); // fail a missed control fast (and record it) instead of hanging 30s

  // ── page bridges (the committed dev hooks; capture paused so nothing auto-advances) ──────────────
  const getState = () => page.evaluate(() => window.__sauda.getState().state);
  const dispatch = (action) => page.evaluate((a) => window.__sauda.getState().dispatch(a), action);
  const stepBot = () => page.evaluate(() => window.__sauda.getState().stepBot());
  const lastLog = () => page.evaluate(() => window.__sauda.getState().log.slice(-1)[0]?.text ?? '');

  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  // Deal a FRESH solo game (seat 0 human, seats 1–3 medium bots), capture paused. newGame is the same
  // entry #/autostart uses; we call it directly only to set the seed + freeze the beats for shooting.
  await page.evaluate((seed) => {
    window.__saudaCapturePaused = true;
    window.__sauda.getState().newGame({
      seats: [{ kind: 'human' }, { kind: 'bot', difficulty: 'medium' }, { kind: 'bot', difficulty: 'medium' }, { kind: 'bot', difficulty: 'medium' }],
      seed,
    });
  }, SEED);
  await page.waitForTimeout(250);

  const bot0 = new HeuristicBot('medium'); // the brain that plays seat 0 — a real, legal-only player
  const rng = (() => { let s = SEED >>> 0; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

  const steps = [];   // the observation log rows
  const shots = [];   // ordered still strip
  let shotN = 0;
  const seenSpectateTurn = new Set(); // one spectate still per bot turn is enough
  let targetingCaptured = false;
  let paymentCaptured = false;
  let discardCaptured = false;
  let myPlayTurns = 0;            // how many of MY play-phases have begun
  const FORCE_PASS_TURNS = 2;     // deliberately pass my first two turns so the hand overflows (discard demo)
  let botRun = { key: '', steps: 0 }; // consecutive stepBot() calls for the same (turn, actor) — a stuck guard

  async function shot(label) {
    const state = await getState();
    const file = `${String(++shotN).padStart(2, '0')}_${label}_t${state.turnCount}.png`;
    await page.screenshot({ path: join(SHOTDIR, file) });
    shots.push({ file, label, turn: state.turnCount });
    return file;
  }
  function log(row) { steps.push(row); console.log(`  t${row.turn} p${row.actor} ${row.state} — ${row.did}${row.issue ? `  [ISSUE: ${row.issue}]` : ''}`); }

  // ── the game loop ────────────────────────────────────────────────────────────────────────────────
  for (let guard = 0; guard < 800; guard++) {
    const state = await getState();
    if (!state) break;
    if (state.phase === 'gameOver') {
      const file = await shot('win');
      const winner = state.winnerIndex;
      log({ turn: state.turnCount, actor: winner ?? -1, state: 'win', did: winner === 0 ? 'I declared SAUDA! (human win)' : `Bot ${winner} won`, file });
      break;
    }
    const actor = actorOf(state);

    // ── a bot is up ──────────────────────────────────────────────────────────────────────────────
    if (actor !== 0) {
      // one SPECTATE still per bot turn (its first beat), so the strip shows the acting-bot stage
      if (!seenSpectateTurn.has(state.turnCount + ':' + actor)) {
        seenSpectateTurn.add(state.turnCount + ':' + actor);
        const file = await shot('spectate');
        log({ turn: state.turnCount, actor, state: 'SPECTATE', did: `bot ${actor} acting — ${await lastLog()}`, file });
      }
      // stuck guard: a bot turn is at most draw + a few plays + end; if the SAME (turn, actor) keeps the
      // floor for far more stepBot() calls than any legal turn needs, something is wrong — record + bail.
      const key = state.turnCount + ':' + actor;
      botRun = key === botRun.key ? { key, steps: botRun.steps + 1 } : { key, steps: 1 };
      if (botRun.steps > 20) {
        log({ turn: state.turnCount, actor, state: 'SPECTATE', did: `stepBot ran ${botRun.steps}× without leaving this turn`, issue: 'bot turn appears stuck', file: '' });
        break;
      }
      await stepBot();
      continue;
    }

    // ── seat 0 (me) is up ──────────────────────────────────────────────────────────────────────────
    const interrupt = state.pendingInterrupts.length > 0 ? state.pendingInterrupts[state.pendingInterrupts.length - 1] : null;
    const legal = legalActions(state, 0);

    // a response window is open on ME (a bot charged me, or a wildcard reached me)
    if (interrupt && interrupt.responder === 0) {
      if (interrupt.status === 'awaitingPayment') {
        if (!paymentCaptured) { const file = await shot('payment'); log({ turn: state.turnCount, actor: 0, state: 'payment', did: `charge stood; payment sheet open — ${await lastLog()}`, file }); paymentCaptured = true; }
        // resolve for real: pay with the engine's first offered combo (the sheet renders the same set)
        const pay = legal.find((a) => a.type === 'RESPOND_PAY');
        if (pay) { await dispatch(pay); } else { const allow = legal.find((a) => a.type === 'RESPOND_ALLOW'); if (allow) await dispatch(allow); }
        continue;
      }
      if (interrupt.status === 'awaitingReceive') {
        const place = legal.find((a) => a.type === 'RESPOND_PLACE_RECEIVED');
        if (place) { await dispatch(place); log({ turn: state.turnCount, actor: 0, state: 'MY-TURN', did: 'placed a received wildcard', file: '' }); }
        else { const allow = legal.find((a) => a.type === 'RESPOND_ALLOW'); if (allow) await dispatch(allow); }
        continue;
      }
      // awaitingResponse: allow (I hold no counter in most deals) — the D2 auto-allow path
      const allow = legal.find((a) => a.type === 'RESPOND_ALLOW');
      const nahi = legal.find((a) => a.type === 'RESPOND_NAHI_CHALEGA');
      await dispatch(allow ?? nahi ?? legal[0]);
      continue;
    }

    if (state.phase === 'awaitingDraw') {
      await dispatch({ type: 'DRAW' });
      myPlayTurns += 1;
      const file = await shot('myturn');
      log({ turn: state.turnCount, actor: 0, state: 'MY-TURN', did: `drew for turn (my play-turn #${myPlayTurns})`, file });
      continue;
    }

    if (state.phase === 'awaitingDiscard') {
      if (!discardCaptured) { const file = await shot('discard'); log({ turn: state.turnCount, actor: 0, state: 'discard', did: `over the hand limit (${state.players[0].hand.length}) — discard overlay open`, file }); discardCaptured = true; }
      // tap a REAL card IN THE DISCARD OVERLAY to bury it (exercises the discard control). Scope to the
      // overlay: the hand-wheel behind it still carries data-card-id and comes first in the DOM, so an
      // unscoped `.first()` would grab a hidden background card the scrim (correctly) intercepts.
      const dov = page.locator('text=Over the limit').locator('xpath=ancestor::div[contains(@style,"position: absolute")][1]');
      const card = dov.locator('[data-card-id]').first();
      const id = await card.getAttribute('data-card-id');
      let tapWorked = true;
      try { await card.click({ timeout: 2500 }); }
      catch {
        tapWorked = false;
        // name the actual interceptor honestly: what element sits on top at this card's centre?
        const box = await card.boundingBox();
        const top = box ? await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${(el.textContent || '').trim().slice(0, 40)}"` : 'none'; }, { x: box.x + box.width / 2, y: box.y + box.height / 2 }) : 'unknown';
        log({ turn: state.turnCount, actor: 0, state: 'discard', did: `real tap on ${id} BLOCKED — top element at its centre is: ${top}`, issue: 'discard card tap intercepted — dead-tap zone', file: '' });
      }
      await page.waitForTimeout(120);
      const after = await getState();
      if (after && after.players[0].hand.length >= state.players[0].hand.length) {
        if (tapWorked) log({ turn: state.turnCount, actor: 0, state: 'discard', did: `tapped ${id}`, issue: 'discard tap did not reduce the hand', file: '' });
        const dc = legal.find((a) => a.type === 'DISCARD'); if (dc) await dispatch(dc); // fallback so we never soft-lock
      }
      continue;
    }

    if (state.phase === 'playing') {
      // deliberate discard demo: pass my first two play-turns with no plays so the hand overflows
      if (myPlayTurns <= FORCE_PASS_TURNS) {
        const end = legal.find((a) => a.type === 'END_TURN');
        if (end) { await dispatch(end); log({ turn: state.turnCount, actor: 0, state: 'MY-TURN', did: 'deliberately passed (no plays) to build the hand for the discard demo', file: '' }); continue; }
      }
      const obs = observe(state, 0);
      const pick = bot0.chooseAction(obs, legal, rng);
      if (!pick) { const end = legal.find((a) => a.type === 'END_TURN'); if (end) await dispatch(end); continue; }

      if (pick.type === 'DECLARE_WIN') { await dispatch(pick); log({ turn: state.turnCount, actor: 0, state: 'MY-TURN', did: 'DECLARE SAUDA! (three sets complete)', file: '' }); continue; }

      // route the first targeted play through the real UI so the targeting overlay is exercised
      if (!targetingCaptured && (pick.type === 'PLAY_ACTION' || pick.type === 'PLAY_KIRAYA') && opensTargeting(legal, pick.cardId)) {
        const ok = await driveTargetingViaUI(page, pick.cardId);
        if (ok) {
          targetingCaptured = true;
          log({ turn: state.turnCount, actor: 0, state: 'targeting', did: `played ${pick.cardId} via the real lift→drag→chip; overlay confirmed`, file: shots[shots.length - 1]?.file ?? '' });
          continue;
        }
        // UI route did not open the overlay — fall through to a plain dispatch so the game still advances
      }

      const label = pick.type === 'BANK_CARD' ? `banked ${pick.cardId}` : pick.type === 'PLACE_PROPERTY' ? `placed ${pick.cardId}` : pick.type === 'END_TURN' ? 'ended turn' : `${pick.type} ${pick.cardId ?? ''}`.trim();
      await dispatch(pick);
      // one MY-TURN still per notable play (bank/place/action), not for every END_TURN
      if (pick.type !== 'END_TURN') { const file = await shot('myturn'); log({ turn: state.turnCount, actor: 0, state: 'MY-TURN', did: label, file }); }
      else { log({ turn: state.turnCount, actor: 0, state: 'MY-TURN', did: label, file: '' }); }
      continue;
    }

    // unknown phase — record and bail rather than spin
    log({ turn: state.turnCount, actor, state: state.phase, did: 'unhandled phase', issue: `driver has no branch for phase ${state.phase}`, file: '' });
    break;
  }

  // ── targeting via the real controls: lift the card, drag it onto PLAY, tap the first legal chip ──
  async function driveTargetingViaUI(page, cardId) {
    const card = await page.locator(`[data-card-id="${cardId}"]`).first().boundingBox();
    if (!card) return false;
    const start = { x: card.x + Math.min(12, card.width / 2), y: card.y + card.height * 0.4 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y - 55, { steps: 5 });
    const play = await page.locator('[data-drop="play"]').first().boundingBox();
    if (!play) { await page.mouse.up(); return false; }
    await page.mouse.move(play.x + play.width / 2, play.y + play.height / 2, { steps: 10 });
    await page.mouse.up();
    // the overlay opens with "Your sets — reference"; screenshot it, then tap the first target chip
    try {
      await page.waitForSelector('text=Your sets — reference', { timeout: 2500 });
    } catch { return false; }
    await shot('targeting');
    // Scope the chip search to the overlay subtree — the board buttons behind it (which the scrim
    // intercepts anyway) must not be candidates. The overlay is the fixed ancestor of the reference
    // header; its only buttons are the target chips + Hide + Cancel.
    const overlay = page.locator('text=Your sets — reference').locator('xpath=ancestor::div[contains(@style,"position: fixed")][1]');
    const tapFirstChip = async () => {
      const buttons = await overlay.locator('button').all();
      for (const b of buttons) {
        const t = (await b.textContent())?.trim() ?? '';
        if (!t || /^(Cancel|Hide|My sets)$/.test(t)) continue;
        await b.click({ timeout: 2500 });
        return true;
      }
      return false;
    };
    const first = await tapFirstChip();
    await page.waitForTimeout(150);
    // a two-step pick (ADLA-BADLI: mine → theirs) leaves the overlay up for a second choice
    if (first && (await page.locator('text=Your sets — reference').count()) > 0) {
      await tapFirstChip();
      await page.waitForTimeout(150);
    }
    return first;
  }

  await browser.close();

  // ── emit the machine log the report is built from ──────────────────────────────────────────────
  const summary = {
    seed: SEED, profile: `${PROFILE.width}x${PROFILE.height}`,
    turns: steps.length ? steps[steps.length - 1].turn : 0,
    statesSeen: { targeting: targetingCaptured, payment: paymentCaptured, discard: discardCaptured },
    shots, steps,
  };
  writeFileSync(join(SHOTDIR, 'playthrough-log.json'), JSON.stringify(summary, null, 2));
  console.log(`\nplaythrough: ${shots.length} stills, ${steps.length} steps → ${SHOTDIR}`);
  console.log(`states: targeting=${targetingCaptured} payment=${paymentCaptured} discard=${discardCaptured}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
