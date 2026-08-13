// @ts-check
/**
 * Motion clips for the S-PASS proof pack (companion to capture-hand-info-1.mjs). Records .webm via
 * Playwright recordVideo, driving the committed dev hooks / real pointer gestures — the shipped app is
 * unchanged. A clip that will not render is reported with its exact error, never substituted.
 */
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const DEV = 'http://localhost:5174';
const OUT = resolve(REPO, 'docs/captures/hand-info-1');
const VID = join(OUT, '_vid');
mkdirSync(VID, { recursive: true });

async function saveVideo(page, ctx, name) {
  const v = page.video();
  await ctx.close();
  if (!v) { console.log('  ✗', name, 'no video'); return; }
  const p = await v.path();
  renameSync(p, join(OUT, name));
  console.log('  ✓', name);
}

// Clip 1 — the press-slide scrub across the spread (dev lab, reliable).
async function scrubClip(browser) {
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, recordVideo: { dir: VID, size: { width: 915, height: 412 } } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${DEV}/#/dev/wheel/8`, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    const cards = await page.$$eval('[data-card-id]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { cx: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.7) }; }));
    if (cards.length === 0) throw new Error('no cards');
    const y = cards[0].y;
    await page.mouse.move(cards[0].cx, y);
    await page.mouse.down();
    await page.waitForTimeout(200);
    // scrub left→right: each card presses up as the pointer passes
    for (const c of cards) { await page.mouse.move(c.cx, y, { steps: 6 }); await page.waitForTimeout(180); }
    // and back right→left
    for (const c of [...cards].reverse()) { await page.mouse.move(c.cx, y, { steps: 6 }); await page.waitForTimeout(140); }
    await page.mouse.up();
    await page.waitForTimeout(400);
    await saveVideo(page, ctx, 'spread_scrub_915x412.webm');
  } catch (e) { console.log('  ✗ scrub', String(e).split('\n')[0]); await ctx.close(); }
}

// Clip 2 — press then DRAG a hand card up into a drop zone, in the real game.
async function dragClip(browser) {
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, recordVideo: { dir: VID, size: { width: 915, height: 412 } } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
    // A fresh turn-2 'playing' state with a placeable property in hand (seed 7, my turn).
    const info = await page.evaluate(() => {
      const g = () => window.__sauda.getState();
      window.__replay(7, []);
      for (let i = 0; i < 30; i++) { const st = g().state; const a = st.pendingInterrupts.length ? st.pendingInterrupts.at(-1).responder : st.currentPlayerIndex; if (a === 0 && st.phase === 'awaitingDraw') { g().dispatch({ type: 'DRAW' }); break; } if (a === 0) break; g().stepBot(); }
      const st = g().state;
      return { phase: st.phase, hand: st.players[0].hand.length };
    });
    await page.waitForTimeout(500);
    const card = await page.$$eval('[data-card-id]', (els) => { const e = els[Math.floor(els.length / 2)]; if (!e) return null; const r = e.getBoundingClientRect(); return { cx: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.7), top: Math.round(r.top) }; });
    const drop = await page.$$eval('[data-drop]', (els) => { const e = els[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) }; });
    if (!card) throw new Error('no hand card found (phase ' + info.phase + ')');
    await page.mouse.move(card.cx, card.y);
    await page.mouse.down();
    await page.waitForTimeout(180);
    // lift > 40px above the band top → becomes a drag
    await page.mouse.move(card.cx, card.top - 70, { steps: 8 });
    await page.waitForTimeout(150);
    if (drop) { await page.mouse.move(drop.cx, drop.cy, { steps: 12 }); await page.waitForTimeout(300); await page.mouse.up(); }
    else { await page.mouse.move(card.cx, card.top - 120, { steps: 8 }); await page.mouse.up(); }
    await page.waitForTimeout(500);
    await saveVideo(page, ctx, 'spread_drag_915x412.webm');
    console.log('    drag info:', JSON.stringify({ ...info, hadDrop: !!drop }));
  } catch (e) { console.log('  ✗ drag', String(e).split('\n')[0]); await ctx.close(); }
}

const browser = await chromium.launch();
console.log('CLIPS…');
await scrubClip(browser);
await dragClip(browser);
await browser.close();
