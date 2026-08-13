// @ts-check
/** pnpm --filter @sauda/mobile capture:handinfo3 — S4 wildcard assistant: the owner's pink-pink-dual
 * scenario resolving through the nudge → preview → Confirm. Crafts the exact board via the dev
 * __craft hook (engine testkit makeState), then films it. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', '..', 'docs/captures/hand-info-1');
const VID = join(OUT, '_vid'); mkdirSync(VID, { recursive: true });
const results = [];
// 2 jaipur placed + a jaipur/kolkata dual parked in kolkata, my play turn — moving the dual to jaipur
// completes it (the owner's pink-pink-dual). A stealable single kolkata prop keeps kolkata legal-empty.
const SPEC = {
  players: [
    { properties: { jaipur: { cards: ['prop_jaipur_0', 'prop_jaipur_1'] }, kolkata: { cards: ['wild_jaipur_kolkata_0'] } }, hand: ['money_2_0'] },
    {}, {}, {},
  ],
  currentPlayerIndex: 0,
  phase: 'playing',
  playsRemaining: 2,
};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: VID, size: { width: 915, height: 412 } } });
const page = await ctx.newPage();
try {
  await page.goto('http://localhost:5174/#/autostart', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__craft === 'function', null, { timeout: 10000 });
  await page.evaluate((spec) => window.__craft(spec), SPEC);
  await page.waitForTimeout(600);
  const nudge = page.locator('button[aria-label^="Arrange"]');
  const has = await nudge.count();
  await page.screenshot({ path: join(OUT, 's4_nudge_915x412.png') });
  results.push({ file: 's4_nudge_915x412.png', ok: has > 0, note: `arrange nudge count ${has}` });
  console.log(has > 0 ? '  ✓ s4_nudge (present)' : '  ✗ s4_nudge (NO nudge!)');
  if (has > 0) {
    await nudge.first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, 's4_preview_915x412.png') });
    const beforeComplete = await page.evaluate(() => window.__sauda.getState().state.players[0].properties.jaipur.some((g) => g.cards.length >= 3));
    await page.locator('button', { hasText: 'Confirm' }).first().click();
    await page.waitForTimeout(700);
    const afterComplete = await page.evaluate(() => window.__sauda.getState().state.players[0].properties.jaipur.some((g) => g.cards.length >= 3));
    results.push({ file: 's4_preview_915x412.png', ok: true, note: `jaipur complete before=${beforeComplete} after=${afterComplete}` });
    console.log(`  ✓ s4_preview + Confirm — jaipur complete before=${beforeComplete} after=${afterComplete}`);
  }
  const v = page.video(); await ctx.close();
  if (v) { renameSync(await v.path(), join(OUT, 's4_pink_scenario_915x412.webm')); console.log('  ✓ s4_pink_scenario_915x412.webm'); }
} catch (e) { results.push({ ok: false, error: String(e).split('\n')[0] }); console.log('  ✗', String(e).split('\n')[0]); await ctx.close(); }
await b.close();
writeFileSync(join(OUT, 'results-s4.json'), JSON.stringify({ results }, null, 2));
