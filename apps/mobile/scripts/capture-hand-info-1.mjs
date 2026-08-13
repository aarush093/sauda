// @ts-check
/**
 * pnpm --filter @sauda/mobile capture:handinfo1 — the S-PASS visual proof pack.
 *
 * Proves what Part 1 landed (nobody has SEEN it yet): the SPREAD (S1) at n=5/8/11 on both landscape
 * profiles with the measured legibility numbers, and the CASH REDACTION (S2) — bot rail note-counts,
 * an opponent zoom as card BACKS + count, the "banked a note" ticker, and MY bank still showing my
 * real total + faces (the asymmetry). Reuses a dev server already running on 5174 (never starts one).
 * Every game state is driven through the committed window.__sauda / __replay dev hooks — the shipped
 * app is unchanged. A capture that will not render is recorded in results.json with its EXACT error;
 * a still is never substituted for a motion claim.
 *
 *   node scripts/capture-hand-info-1.mjs [--port=5174]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
// S6_haveli (seed 7): a rich late-game landing on MY turn with the bots holding banked cards
// (banks [5,4,1,4]) — the exact shape the redaction stills need (opponent note-stacks + my own bank).
const FIXTURE = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const REDACTION_STATE = FIXTURE.states['S6_haveli'];
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port ?? 5174);
const DEV = `http://localhost:${PORT}`;
const OUT = resolve(REPO, 'docs/captures/hand-info-1');
mkdirSync(OUT, { recursive: true });

const PROFILES = [
  { id: '915x412', w: 915, h: 412 },
  { id: '740x360', w: 740, h: 360 },
];
const results = [];

async function shot(page, file, note) {
  const path = join(OUT, file);
  await page.screenshot({ path });
  results.push({ file, note, ok: true });
  console.log('  ✓', file);
}

async function newPage(browser, profile) {
  const ctx = await browser.newContext({ viewport: { width: profile.w, height: profile.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return { page, ctx, errors };
}

// ── SPREAD stills + measured legibility ──────────────────────────────────────────────────────────
async function spreadStills(browser) {
  const legibility = [];
  for (const profile of PROFILES) {
    for (const n of [5, 8, 11]) {
      const { page, ctx, errors } = await newPage(browser, profile);
      try {
        await page.goto(`${DEV}/#/dev/wheel/${n}`, { waitUntil: 'load' });
        await page.waitForTimeout(900);
        await shot(page, `spread_n${n}_${profile.id}.png`, `spread at n=${n}, ${profile.id}`);
        if (n === 11) {
          // Measure the true rendered rest card width at the busiest hand → the legibility numbers.
          const cardW = await page.evaluate(() => {
            const el = document.querySelector('[data-card-id]');
            return el ? Math.round(el.getBoundingClientRect().width) : null;
          });
          const dpr = 2;
          if (cardW) {
            legibility.push({
              profile: profile.id,
              cardWidthPx: cardW,
              bannerDevicePx: +(9 * (cardW / 132) * dpr).toFixed(1),
              badgeDevicePx: +(7 * (cardW / 132) * dpr).toFixed(1),
            });
          }
        }
        if (errors.length) results.push({ file: `spread_n${n}_${profile.id}`, ok: false, consoleErrors: errors.slice(0, 3) });
      } catch (e) {
        results.push({ file: `spread_n${n}_${profile.id}.png`, ok: false, error: String(e) });
        console.log('  ✗ spread', n, profile.id, String(e).split('\n')[0]);
      } finally {
        await ctx.close();
      }
    }
  }
  return legibility;
}

// Land the rich S6_haveli state (my turn, bots holding banked cards) via the committed __replay hook.
async function driveBankedMidGame(page) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  return page.evaluate((state) => {
    window.__replay(state.seed, state.actions);
    const st = window.__sauda.getState().state;
    return {
      phase: st.phase,
      actor: st.currentPlayerIndex,
      botBanks: st.players.map((p, i) => ({ seat: i, bank: p.bank.length })),
      recentLog: window.__sauda.getState().log.slice(-8).map((l) => l.text),
    };
  }, REDACTION_STATE);
}

// ── REDACTION stills (S2) ────────────────────────────────────────────────────────────────────────
async function redactionStills(browser) {
  const profile = PROFILES[0]; // 915x412
  const { page, ctx, errors } = await newPage(browser, profile);
  try {
    const summary = await driveBankedMidGame(page);
    results.push({ file: 'redaction_state', note: 'mid-game driven for redaction', ok: true, summary });
    console.log('  driven:', JSON.stringify(summary));
    await page.waitForTimeout(600);
    // 1. The MY-TURN board: the bot rail shows note-stack counts (no ₹ total); ticker shows "banked a note".
    await shot(page, 'redaction_rail_915x412.png', 'bot rail note-counts + ticker "banked a note"');

    // 2. An opponent zoom — bank as card BACKS + count, never faces/total.
    const chip = page.locator('button[title^="Bot "]').first();
    if (await chip.count()) {
      await chip.click();
      await page.waitForTimeout(700);
      await shot(page, 'redaction_opponent_zoom_915x412.png', 'opponent zoom — bank = card backs + count');
      // close the zoom (tap the felt backdrop, top-left corner is safe)
      await page.mouse.click(5, 5);
      await page.waitForTimeout(400);
    } else {
      results.push({ file: 'redaction_opponent_zoom_915x412.png', ok: false, error: 'no bot rail chip found' });
    }

    // 3. MY OWN bank — real faces + total (the asymmetry).
    const bank = page.locator('div[title="Tap to inspect your bank"]');
    if (await bank.count()) {
      await bank.first().click();
      await page.waitForTimeout(700);
      await shot(page, 'redaction_my_bank_915x412.png', 'MY bank — real faces + total (asymmetry)');
    } else {
      results.push({ file: 'redaction_my_bank_915x412.png', ok: false, error: 'bank tray not found' });
    }
    if (errors.length) results.push({ file: 'redaction_console', ok: false, consoleErrors: errors.slice(0, 5) });
  } catch (e) {
    results.push({ file: 'redaction', ok: false, error: String(e) });
    console.log('  ✗ redaction', String(e).split('\n')[0]);
  } finally {
    await ctx.close();
  }
}

// A SPECTATE still where a bot just banked — the ticker + stage caption read "banked a note".
async function bankedNoteStill(browser) {
  const profile = PROFILES[0];
  const { page, ctx, errors } = await newPage(browser, profile);
  try {
    await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
    const info = await page.evaluate(() => {
      const g = () => window.__sauda.getState();
      window.__replay(7, []);
      for (let i = 0; i < 40; i++) {
        const st = g().state;
        const actor = st.pendingInterrupts.length ? st.pendingInterrupts.at(-1).responder : st.currentPlayerIndex;
        if (actor === 0) { if (st.phase === 'awaitingDraw') g().dispatch({ type: 'DRAW' }); else if (st.phase === 'awaitingDiscard') break; else g().dispatch({ type: 'END_TURN' }); }
        else g().stepBot();
        const line = g().log.map((l) => l.text).slice(-4).find((t) => t.includes('banked a note'));
        if (line) return { line, step: i };
      }
      return { line: null };
    });
    await page.waitForTimeout(500);
    if (info.line) {
      await shot(page, 'redaction_banked_a_note_915x412.png', `SPECTATE — "${info.line}" in ticker + caption`);
    } else {
      results.push({ file: 'redaction_banked_a_note_915x412.png', ok: false, error: 'no banked-a-note line surfaced' });
    }
    if (errors.length) results.push({ file: 'banked_note_console', ok: false, consoleErrors: errors.slice(0, 3) });
  } catch (e) {
    results.push({ file: 'redaction_banked_a_note_915x412.png', ok: false, error: String(e) });
  } finally {
    await ctx.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  console.log('SPREAD stills…');
  const legibility = await spreadStills(browser);
  console.log('REDACTION stills…');
  await redactionStills(browser);
  await bankedNoteStill(browser);
  await browser.close();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ legibility, results }, null, 2));
  console.log('\nLegibility:', JSON.stringify(legibility, null, 2));
  const failed = results.filter((r) => r.ok === false);
  console.log(`\n${results.filter((r) => r.ok).length} ok, ${failed.length} failed/notes`);
}

main();
