// @ts-check
/**
 * pnpm capture:landscape — the LANDSCAPE REBUILD (R) evidence pack (owner landscape directive, 2 Aug).
 *
 * SAUDA is landscape-only now, so this harness is re-parameterised onto the LANDSCAPE device profiles
 * (deviceProfiles.json, rotated: 740x360 / 800x360 / 832x384 / 915x412 + a reduced-motion variant).
 * It shoots the pass's stills — the rotate gate, the MY TURN view, the SPECTATE split with its R2
 * caption, the R5 targeting split, the R3 bank inspect, the R6 advice card, and the R7 shell — and
 * writes docs/captures/landscape-1/INDEX.md. It reuses the committed dev hooks (window.__replay /
 * __sauda / __saudaCapturePaused), so nothing about the shipped app changes.
 *
 * Reuses a dev server already running (default port 5174 — matches `pnpm dev:lan`); never starts one.
 *   node scripts/capture-landscape.mjs [--port=5174]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import profileData from '../src/dev/deviceProfiles.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port ?? 5174);
const DEV = `http://localhost:${PORT}`;
const OUT = resolve(REPO, 'docs/captures/landscape-1');
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const PROFILES = profileData.profiles;
const byId = Object.fromEntries(PROFILES.map((p) => [p.id, p]));

const SPOTLIGHT = ['ActionPlayed', 'CardBanked', 'PropertyPlaced', 'BuildingPlaced', 'CardReceived'];
const results = [];

async function context(browser, profile, opts = {}) {
  return browser.newContext({
    viewport: { width: opts.width ?? profile.width, height: opts.height ?? profile.height },
    deviceScaleFactor: opts.dpr ?? profile.dpr,
    isMobile: true,
    hasTouch: true,
    reducedMotion: opts.reduced ?? profile.reducedMotion ? 'reduce' : 'no-preference',
  });
}

async function bootReplay(page, sid) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  const s = fixture.states[sid];
  await page.evaluate((x) => window.__replay(x.seed, x.actions), { seed: s.seed, actions: s.actions });
  await page.waitForTimeout(250);
}

async function record(file, what, ok, note) {
  results.push({ file, what, ok, note });
  console.log(`  ${ok ? 'ok  ' : 'MISS'} ${file}${note ? `  (${note})` : ''}`);
}

// MY TURN + the R7 shell + the rotate gate — deterministic, shot at every profile.
async function shootDeterministic(browser) {
  for (const profile of PROFILES.filter((p) => !p.reducedMotion)) {
    const tag = `${profile.width}x${profile.height}`;
    // rotate gate: the profile SWAPPED into portrait raises it.
    {
      const ctx = await context(browser, profile, { width: profile.height, height: profile.width });
      const page = await ctx.newPage();
      await page.goto(`${DEV}/#/`, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      const gate = await page.locator('[data-rotate-gate]').count();
      await page.screenshot({ path: join(OUT, `r0_rotate_${profile.height}x${profile.width}.png`) });
      await record(`r0_rotate_${profile.height}x${profile.width}.png`, 'R0 rotate gate (portrait raises it)', gate > 0);
      await ctx.close();
    }
    for (const [hash, name, label] of [
      ['#/autostart', `r1_myturn_${tag}`, 'R1 MY TURN view'],
      ['#/', `r7_home_${tag}`, 'R7 Home two-pane'],
      ['#/niyam?chapter=3', `r7_book_${tag}`, 'R7 Book two-pane'],
    ]) {
      const ctx = await context(browser, profile);
      const page = await ctx.newPage();
      await page.goto(`${DEV}/${hash}`, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(OUT, `${name}.png`) });
      await record(`${name}.png`, `${label} @ ${tag}`, true);
      await ctx.close();
    }
  }
}

// SPECTATE + caption (R1b/R2) — drive a bot to a real play so the caption composes; shot at 740 + 915.
async function shootSpectate(browser) {
  for (const id of ['tall-915x412', 'legacy-740x360']) {
    const profile = byId[id];
    const ctx = await context(browser, profile);
    const page = await ctx.newPage();
    await bootReplay(page, 'S9_adla_badli');
    await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' }));
    let played = null;
    for (let i = 0; i < 6 && !played; i++) {
      await page.evaluate(() => window.__sauda.getState().stepBot());
      await page.waitForTimeout(120);
      played = await page.evaluate((PLAY) => {
        const g = window.__sauda.getState();
        const actor = g.state.currentPlayerIndex;
        return g.lastEvents.some((e) => e.player === actor && PLAY.includes(e.type));
      }, SPOTLIGHT);
    }
    await page.waitForTimeout(300);
    const file = `r2_spectate_caption_${profile.width}x${profile.height}.png`;
    await page.screenshot({ path: join(OUT, file) });
    await record(file, 'R1b spectate split + R2 stage caption', !!played, played ? '' : 'bot did not reach a play');
    await ctx.close();
  }
}

// R5 targeting split — scan scenarios for a human targeted play, drop it on the play zone.
async function shootTargeting(browser) {
  const profile = byId['tall-915x412'];
  for (const sid of Object.keys(fixture.states)) {
    const ctx = await context(browser, profile);
    const page = await ctx.newPage();
    await bootReplay(page, sid);
    const targetCard = await page.evaluate(() => {
      const st = window.__sauda.getState().state;
      if (st.currentPlayerIndex !== 0) return null;
      return st.players[0].hand.find((id) => /kabza|haathKiSafai|adlaBadli|kiraya/.test(id)) || null;
    });
    if (targetCard) {
      const card = await page.locator(`[data-card-id="${targetCard}"]`).first().boundingBox();
      if (card) {
        await page.mouse.move(card.x + Math.min(12, card.width / 2), card.y + card.height * 0.4);
        await page.mouse.down();
        await page.mouse.move(card.x + 6, card.y - 60, { steps: 6 });
        const play = await page.locator('[data-drop="play"]').first().boundingBox();
        if (play) await page.mouse.move(play.x + play.width / 2, play.y + play.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        if (await page.locator('text=Your sets — reference').count()) {
          await page.screenshot({ path: join(OUT, 'r5_targeting_split_915x412.png') });
          await record('r5_targeting_split_915x412.png', 'R5 targeting split (targets + My Sets reference)', true, sid);
          await ctx.close();
          return;
        }
      }
    }
    await ctx.close();
  }
  await record('r5_targeting_split_915x412.png', 'R5 targeting split', false, 'no scenario yielded a targeted play');
}

// R3 bank inspect (mine, after banking a card) + R6 advice card.
async function shootBankAndAdvice(browser) {
  const profile = byId['tall-915x412'];
  {
    const ctx = await context(browser, profile);
    const page = await ctx.newPage();
    await bootReplay(page, 'S9_adla_badli');
    await page.evaluate(() => {
      const g = window.__sauda.getState();
      const me = g.state.currentPlayerIndex;
      const money = g.state.players[me].hand.find((id) => id.startsWith('money_'));
      if (money) g.dispatch({ type: 'BANK_CARD', cardId: money });
    });
    await page.waitForTimeout(200);
    await page.locator('[data-drop="bank"]').first().click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    const ok = (await page.locator('text=/— bank/').count()) > 0;
    await page.screenshot({ path: join(OUT, 'r3_my_bank_915x412.png') });
    await record('r3_my_bank_915x412.png', 'R3 bank inspect (real faces + gold total)', ok);
    await ctx.close();
  }
  {
    const ctx = await context(browser, profile, { reduced: true });
    const page = await ctx.newPage();
    await bootReplay(page, 'S6_makaan');
    const ok = await page.evaluate(() => {
      const st = window.__sauda.getState().state;
      return st.currentPlayerIndex === 0 && st.phase === 'playing';
    });
    if (ok) {
      await page.locator('button:has-text("Munshi")').first().click().catch(() => {});
      await page.waitForTimeout(400);
    }
    const shown = (await page.locator('text=Munshi ki Salah').count()) > 0;
    await page.screenshot({ path: join(OUT, 'r6_advice_915x412.png') });
    await record('r6_advice_915x412.png', 'R6 nuanced advice card (medallion · sentence · card)', shown);
    await ctx.close();
  }
}

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

function writeIndex() {
  const lines = [
    '# LANDSCAPE REBUILD (R) — capture pack INDEX', '',
    'SAUDA is landscape-only (owner landscape directive, 2 Aug). Every still here is shot on the',
    'LANDSCAPE device profiles (deviceProfiles.json, rotated) via the committed dev hooks. Rerun:',
    '`pnpm dev:lan` in one shell, then `pnpm capture:landscape`.', '',
    '| Still | Proves |', '|-------|--------|',
  ];
  for (const r of results) {
    lines.push(`| \`${r.file}\` | ${r.ok ? r.what : `**DID NOT RENDER** — ${r.note || r.what}`} |`);
  }
  lines.push('', '## Clips (recorded separately, see the pass report)', '',
    'Feel cannot be shown with stills — the my-turn↔spectate transition, a full bot turn with captions,',
    'a HAATH KI SAFAI pick with the reference panel, the ₹3-banked-action overpay, and a wheel scrub at',
    'landscape width are recorded as webm clips in the pass report.', '');
  writeFileSync(join(OUT, 'INDEX.md'), lines.join('\n') + '\n');
}

async function main() {
  if (!(await reachable(DEV))) {
    console.error(`capture:landscape: no dev server at ${DEV} — start one (pnpm dev:lan) first.`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    await shootDeterministic(browser);
    await shootSpectate(browser);
    await shootTargeting(browser);
    await shootBankAndAdvice(browser);
  } finally {
    await browser.close();
  }
  writeIndex();
  console.log(`\ncapture:landscape: ${results.filter((r) => r.ok).length}/${results.length} stills → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
