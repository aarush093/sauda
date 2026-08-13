// @ts-check
/** pnpm --filter @sauda/mobile verify:profile — T2: the PROFILE harness re-run at BOTH landscape
 * profiles (the S pass grew the rest card), same methodology as excellence-measure profile mode
 * (4x CPU throttle, rAF inter-frame deltas, S6_haveli). Reports p95 / worst-frame per interaction. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'docs/captures/hand-info-1'); mkdirSync(OUT, { recursive: true });
const FX = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const S6 = FX.states['S6_haveli'];
const PROFILES = [{ id: '915x412', w: 915, h: 412 }, { id: '740x360', w: 740, h: 360 }];
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0;

const browser = await chromium.launch();
const out = { throttle: '4x CPU', board: 'S6_haveli', budget: { targetMs: 16.7, ceilingMs: 33 }, profiles: {} };
for (const p of PROFILES) {
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await page.goto('http://localhost:5174/#/autostart', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  await page.evaluate((x) => window.__replay(x.seed, x.actions), S6);
  await page.evaluate(() => { window.__saudaCapturePaused = false; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__frames = []; window.__rec = false; const tick = (t) => { if (window.__rec) window.__frames.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const measure = async (fn) => {
    await page.evaluate(() => { window.__frames = []; window.__rec = true; });
    await fn();
    const frames = await page.evaluate(() => { window.__rec = false; return window.__frames; });
    const d = []; for (let i = 1; i < frames.length; i++) d.push(frames[i] - frames[i - 1]); d.sort((a, b) => a - b);
    return { frames: d.length, p50: +pct(d, 50).toFixed(1), p95: +pct(d, 95).toFixed(1), max: +(d.length ? d[d.length - 1] : 0).toFixed(1) };
  };
  const band = async () => { const cs = await page.locator('[data-card-id]').all(); const bs = []; for (const x of cs) { const bb = await x.boundingBox(); if (bb) bs.push(bb); } bs.sort((a, b) => a.x - b.x); return bs; };
  // (a) spread scrub + drag: press the leftmost card, scrub across, lift into a drag.
  const drag = await measure(async () => {
    const bs = await band(); if (!bs.length) return;
    const y = bs[0].y + bs[0].height * 0.4;
    await page.mouse.move(bs[0].x + 8, y); await page.mouse.down();
    for (const bb of bs) await page.mouse.move(bb.x + bb.width / 2, y, { steps: 3 });
    await page.mouse.move(bs[0].x + 8, y - 80, { steps: 8 });
    await page.mouse.move(bs[Math.floor(bs.length / 2)].x, y - 100, { steps: 8 });
    await page.mouse.up(); await page.waitForTimeout(300);
  });
  // (b) TableView open/close (a bot rail chip) — the large-cascade repaint, unchanged baseline.
  const tv = await measure(async () => {
    const chip = page.locator('button[title^="Bot "]').first();
    if (await chip.count()) { await chip.click(); await page.waitForTimeout(400); await page.mouse.click(4, 4); await page.waitForTimeout(400); }
  });
  out.profiles[p.id] = { spreadScrubDrag: drag, tableViewOpenClose: tv };
  console.log(`${p.id}: scrub+drag p95 ${drag.p95} max ${drag.max} | tableView p95 ${tv.p95} max ${tv.max}`);
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, 'verify-profile-landscape.json'), JSON.stringify(out, null, 2));
console.log('\nlast recorded (wheel era, 360x740): all interactions p95 ~16.7-16.8, budget target 16.7 / ceiling 33');
