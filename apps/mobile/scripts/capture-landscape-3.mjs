// @ts-check
/**
 * pnpm capture:landscape3 — LANDSCAPE-3 close-out evidence (owner landscape directive, final polish).
 *
 * Stages (--stage, default: all), all writing to docs/captures/landscape-3:
 *   --stage=munshi    M1 stills: the Munshi advice card with the owner's REAL lithograph in the round
 *                     medallion (not the silhouette fallback), at tall-915x412 and legacy-740x360.
 *   --stage=chip      M2 stills: the targeting split at the shortest 740x360 profile — the many-target
 *                     chip row vs the dimmed hand fan. --tag=before|after names the file so the same
 *                     scene can be shot on either side of the collision fix.
 *
 * Reuses the committed dev hooks (window.__replay / __sauda) exactly like the R / landscape-2 captures,
 * so nothing about the shipped app changes. Reuses a dev server already running (default 5174 — matches
 * `pnpm dev:lan`); never starts one.
 *   node scripts/capture-landscape-3.mjs [--stage=munshi|chip|all] [--tag=before|after] [--port=5174]
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
const STAGE = String(argv.stage ?? 'all');
const TAG = argv.tag ? String(argv.tag) : null;
const OUT = resolve(REPO, 'docs/captures/landscape-3');
const RESULTS = join(OUT, 'results.json');
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const P = Object.fromEntries(profileData.profiles.map((p) => [p.id, p]));

// ── shared driving helpers (same shapes the R / landscape-2 captures use) ──────────────────────────
async function frames(page, ms) { await page.waitForTimeout(ms); }

async function bootReplay(page, sid) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  const s = fixture.states[sid];
  await page.evaluate((x) => window.__replay(x.seed, x.actions), { seed: s.seed, actions: s.actions });
  await frames(page, 250);
}

// Land player 0 on their second turn holding HAATH KI SAFAI with stealable single properties around the
// table — the deterministic route to a many-target targeting split (verbatim from the landscape-2 pack).
async function landHaathKiSafaiTurn(page) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  return page.evaluate(() => {
    const g = () => window.__sauda.getState();
    window.__replay(15, []);
    g().dispatch({ type: 'DRAW' });
    g().dispatch({ type: 'END_TURN' });
    for (let i = 0; i < 40; i++) {
      const st = g().state;
      if (st.currentPlayerIndex === 0) break;
      g().stepBot();
    }
    if (g().state.currentPlayerIndex === 0 && g().state.phase === 'awaitingDraw') {
      g().dispatch({ type: 'DRAW' });
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

async function ctx(browser, profile) {
  return browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr, isMobile: true, hasTouch: true,
    reducedMotion: profile.reducedMotion ? 'reduce' : 'no-preference',
  });
}

function loadResults() { try { return JSON.parse(readFileSync(RESULTS, 'utf8')); } catch { return {}; } }
function saveResult(store, file, entry) { store[file] = entry; writeFileSync(RESULTS, JSON.stringify(store, null, 2)); }

// ── M1: the Munshi advice card with the real portrait ──────────────────────────────────────────────
async function stageMunshi(browser, store) {
  for (const id of ['tall-915x412', 'legacy-740x360']) {
    const profile = P[id];
    const tag = `${profile.width}x${profile.height}`;
    const c = await ctx(browser, profile);
    const page = await c.newPage();
    let ok = false; let note = '';
    try {
      await bootReplay(page, 'S6_makaan'); // my play turn — the advisor chip is offered
      await frames(page, 300);
      // Open the read-only advice card (spends one of the three consults). The chip carries an
      // aria-label starting "Munshi advisor"; the card then shows "Munshi ki Salah".
      await page.locator('button[aria-label^="Munshi advisor"]').first().click();
      await page.waitForSelector('text=Munshi ki Salah', { timeout: 4000 });
      await frames(page, 500); // let the medallion settle (the float easing)
      // Prove it is the real portrait, not the code silhouette: the medallion holds an <img>.
      ok = await page.locator('.munshi-medallion img').count() > 0;
      if (!ok) note = 'medallion shows the silhouette fallback, not the portrait <img>';
    } catch (e) { note = String(e).split('\n')[0]; }
    const file = `m1_advice_portrait_${tag}.png`;
    await page.screenshot({ path: join(OUT, file) });
    saveResult(store, file, { ok, what: `M1 Munshi advice card with the real lithograph medallion @ ${tag}`, note });
    console.log(`  ${ok ? 'ok  ' : 'MISS'} ${file}  ${note}`);
    await c.close();
  }
}

// ── M2: the targeting split at the shortest profile (chip row vs the dimmed hand) ──────────────────
async function stageChip(browser, store) {
  const profile = P['legacy-740x360'];
  const tag = `${profile.width}x${profile.height}`;
  const c = await ctx(browser, profile);
  const page = await c.newPage();
  let ok = false; let note = '';
  try {
    const landed = await landHaathKiSafaiTurn(page);
    if (!landed.ok || !landed.card) throw new Error('could not land a haathKiSafai play turn');
    await frames(page, 300);
    await liftCard(page, `[data-card-id="${landed.card}"]`);
    await dragToPlay(page, 200);
    await page.waitForSelector('text=Your sets — reference', { timeout: 4000 });
    await frames(page, 400);
    ok = true;
  } catch (e) { note = String(e).split('\n')[0]; }
  const suffix = TAG ? `_${TAG}` : '';
  const file = `m2_targeting_${tag}${suffix}.png`;
  await page.screenshot({ path: join(OUT, file) });
  saveResult(store, file, { ok, what: `M2 targeting split (many-target chips vs dimmed hand) @ ${tag}${TAG ? ` — ${TAG}` : ''}`, note });
  console.log(`  ${ok ? 'ok  ' : 'MISS'} ${file}  ${note}`);
  await c.close();
}

// ── INDEX ──────────────────────────────────────────────────────────────────────────────────────────
function writeIndex(store) {
  const rows = Object.entries(store).sort(([a], [b]) => a.localeCompare(b));
  const stills = rows.filter(([f]) => f.endsWith('.png'));
  const lines = [
    '# LANDSCAPE-3 — Munshi portrait + final polish INDEX', '',
    'Final close-out. M1 seats the owner\'s Munshi lithograph in the advice-card medallion through the',
    'real plate pipeline (600×870 plate, circular CSS mask); M2 clears the many-target chip graze at the',
    'shortest profile. All shot on the landscape device profiles (deviceProfiles.json) via the committed',
    '`window.__replay` hook — the shipped app is unchanged.', '',
    'Rerun: `pnpm dev:lan` in one shell, then `pnpm capture:landscape3` (or `--stage=munshi|chip`).', '',
    '## Stills', '', '| Still | Proves |', '|-------|--------|',
  ];
  for (const [file, r] of stills) {
    lines.push(`| \`${file}\` | ${r.ok ? r.what : `**MISSING** — ${r.note || r.what}`} |`);
  }
  lines.push('');
  writeFileSync(join(OUT, 'INDEX.md'), lines.join('\n') + '\n');
}

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

async function main() {
  if (!(await reachable(DEV))) {
    console.error(`capture:landscape3: no dev server at ${DEV} — start one (pnpm dev:lan) first.`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  const store = loadResults();
  const browser = await chromium.launch();
  try {
    if (STAGE === 'all' || STAGE === 'munshi') { console.log('M1 — Munshi advice portrait'); await stageMunshi(browser, store); }
    if (STAGE === 'all' || STAGE === 'chip') { console.log('M2 — targeting chip collision'); await stageChip(browser, store); }
  } finally {
    await browser.close();
  }
  writeIndex(store);
  const all = Object.values(store);
  console.log(`\ncapture:landscape3 [${STAGE}]: ${all.filter((r) => r.ok).length}/${all.length} artifacts ok → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
