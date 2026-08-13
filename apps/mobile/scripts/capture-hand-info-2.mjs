// @ts-check
/**
 * pnpm --filter @sauda/mobile capture:handinfo2 — S3 targeting proof (real cards, not text pills) +
 * the assisted-pick hint. Reuses a dev server on 5174; drives the committed __replay/__sauda hooks and
 * real pointer gestures. A capture that will not render is recorded with its exact error.
 *   node scripts/capture-hand-info-2.mjs [--port=5174]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const DEV = `http://localhost:${Number(argv.port ?? 5174)}`;
const OUT = resolve(REPO, 'docs/captures/hand-info-1');
const VID = join(OUT, '_vid');
mkdirSync(VID, { recursive: true });
const PROFILES = [{ id: '915x412', w: 915, h: 412 }, { id: '740x360', w: 740, h: 360 }];
const results = [];

const frames = (p, ms) => p.waitForTimeout(ms);

async function landHaath(page) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  return page.evaluate(() => {
    const g = () => window.__sauda.getState();
    window.__replay(15, []);
    g().dispatch({ type: 'DRAW' }); g().dispatch({ type: 'END_TURN' });
    for (let i = 0; i < 40; i++) { if (g().state.currentPlayerIndex === 0) break; g().stepBot(); }
    if (g().state.currentPlayerIndex === 0 && g().state.phase === 'awaitingDraw') g().dispatch({ type: 'DRAW' });
    const st = g().state;
    return { ok: st.currentPlayerIndex === 0 && st.phase === 'playing', card: st.players[0].hand.find((c) => c.includes('haathKiSafai')) ?? null };
  });
}

async function openTargeting(page) {
  const card = await page.locator('[data-card-id*="haathKiSafai"]').first().boundingBox();
  if (!card) throw new Error('no haathKiSafai card in hand');
  const sx = card.x + Math.min(14, card.width / 2), sy = card.y + card.height * 0.4;
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.mouse.move(sx, sy - 60, { steps: 6 });
  const play = await page.locator('[data-drop="play"]').first().boundingBox();
  if (!play) throw new Error('no play zone');
  await page.mouse.move(play.x + play.width / 2, play.y + play.height / 2, { steps: 10 });
  await frames(page, 150); await page.mouse.up(); await frames(page, 500);
}

async function still(browser, profile) {
  const ctx = await browser.newContext({ viewport: { width: profile.w, height: profile.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  try {
    const landed = await landHaath(page);
    if (!landed.ok || !landed.card) throw new Error('could not land haath turn (ok=' + landed.ok + ')');
    await openTargeting(page);
    const file = `s3_haath_targeting_${profile.id}.png`;
    await page.screenshot({ path: join(OUT, file) });
    results.push({ file, ok: true, note: 'HAATH KI SAFAI targets as REAL property cards (was text pills)' });
    console.log('  ✓', file);
  } catch (e) {
    results.push({ file: `s3_haath_targeting_${profile.id}.png`, ok: false, error: String(e).split('\n')[0] });
    console.log('  ✗', profile.id, String(e).split('\n')[0]);
  } finally { await ctx.close(); }
}

// Land a haathKiSafai play turn on a table of the given bot difficulty (drives the store directly so
// the seats — hence the assist-hint gating — are exactly `difficulty`). Freezes the auto-beats first.
async function landHaathWithDifficulty(page, difficulty) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  return page.evaluate((diff) => {
    const g = () => window.__sauda.getState();
    window.__saudaCapturePaused = true; // stop the Table's auto bot beats while we drive by hand
    g().newGame({ seats: [{ kind: 'human' }, { kind: 'bot', difficulty: diff }, { kind: 'bot', difficulty: diff }, { kind: 'bot', difficulty: diff }], seed: 15 });
    g().dispatch({ type: 'DRAW' }); g().dispatch({ type: 'END_TURN' });
    for (let i = 0; i < 40; i++) { if (g().state.currentPlayerIndex === 0) break; g().stepBot(); }
    if (g().state.currentPlayerIndex === 0 && g().state.phase === 'awaitingDraw') g().dispatch({ type: 'DRAW' });
    const st = g().state;
    return { ok: st.currentPlayerIndex === 0 && st.phase === 'playing', card: st.players[0].hand.find((c) => c.includes('haathKiSafai')) ?? null };
  }, difficulty);
}

// The assist hint: a still (brighter ring) + a bounce clip on MEDIUM, and a still proving HARD shows none.
async function hintEvidence(browser) {
  const profile = PROFILES[0];
  // MEDIUM — the best target gets [data-hint] (brighter ring + bounce). Still + clip.
  {
    const ctx = await browser.newContext({ viewport: { width: profile.w, height: profile.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: VID, size: { width: profile.w, height: profile.h } } });
    const page = await ctx.newPage();
    try {
      const landed = await landHaathWithDifficulty(page, 'medium');
      if (!landed.ok) throw new Error('medium: could not land haath');
      await openTargeting(page);
      const hintCount = await page.locator('[data-hint]').count();
      await page.screenshot({ path: join(OUT, 's3_hint_medium_915x412.png') });
      await frames(page, 1600); // let the bounce play for the clip
      results.push({ file: 's3_hint_medium_915x412.png', ok: hintCount > 0, note: `medium hint tiles: ${hintCount}` });
      console.log(hintCount > 0 ? '  ✓ s3_hint_medium (hint present)' : '  ✗ s3_hint_medium (NO hint on medium!)');
      const v = page.video(); await ctx.close();
      if (v) { renameSync(await v.path(), join(OUT, 's3_hint_bounce_medium.webm')); console.log('  ✓ s3_hint_bounce_medium.webm'); }
    } catch (e) { results.push({ file: 's3_hint_medium', ok: false, error: String(e).split('\n')[0] }); await ctx.close(); }
  }
  // HARD — no hint. Still.
  {
    const ctx = await browser.newContext({ viewport: { width: profile.w, height: profile.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      const landed = await landHaathWithDifficulty(page, 'hard');
      if (!landed.ok) throw new Error('hard: could not land haath');
      await openTargeting(page);
      const hintCount = await page.locator('[data-hint]').count();
      await page.screenshot({ path: join(OUT, 's3_no_hint_hard_915x412.png') });
      results.push({ file: 's3_no_hint_hard_915x412.png', ok: hintCount === 0, note: `hard hint tiles: ${hintCount} (must be 0)` });
      console.log(hintCount === 0 ? '  ✓ s3_no_hint_hard (no hint, correct)' : '  ✗ s3_no_hint_hard (hint LEAKED on hard!)');
    } finally { await ctx.close(); }
  }
}

const browser = await chromium.launch();
console.log('S3 targeting stills…');
for (const p of PROFILES) await still(browser, p);
console.log('S3 assist-hint evidence…');
await hintEvidence(browser);
await browser.close();
writeFileSync(join(OUT, 'results-s3.json'), JSON.stringify({ results }, null, 2));
console.log(`${results.filter((r) => r.ok).length} ok, ${results.filter((r) => !r.ok).length} failed`);
