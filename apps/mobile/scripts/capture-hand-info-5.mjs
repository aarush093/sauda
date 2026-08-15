// @ts-check
/** pnpm --filter @sauda/mobile capture:handinfo5 — T3 closures: (1) the arrange nudge anchored to the
 * AFFECTED group, (2) ADLA-BADLI's SECOND pick hinted. Crafts states via __craft; drives the play. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs/captures/hand-info-1'); mkdirSync(OUT, { recursive: true });
const DEV = 'http://localhost:5174';
const results = [];
const frames = (p, ms) => p.waitForTimeout(ms);
const b = await chromium.launch();

// (1) arrange nudge anchored to the affected (jaipur) group.
{
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__craft === 'function', null, { timeout: 10000 });
    await page.evaluate(() => window.__craft({
      players: [{ properties: { jaipur: { cards: ['prop_jaipur_0', 'prop_jaipur_1'] }, kolkata: { cards: ['wild_jaipur_kolkata_0'] } }, hand: ['money_2_0'] }, {}, {}, {}],
      currentPlayerIndex: 0, phase: 'playing', playsRemaining: 2,
    }));
    await frames(page, 700);
    const geo = await page.evaluate(() => {
      const nudge = document.querySelector('button[aria-label^="Arrange"]');
      const group = document.querySelector('[data-myset="jaipur"]');
      const r = (e) => e ? { left: Math.round(e.getBoundingClientRect().left), top: Math.round(e.getBoundingClientRect().top) } : null;
      return { nudge: r(nudge), jaipurGroup: r(group) };
    });
    await page.screenshot({ path: join(OUT, 't3_arrange_anchor_915x412.png') });
    // anchored = the nudge sits near the jaipur group's left, NOT at the column-head fallback (left 52)
    const anchored = geo.nudge && geo.jaipurGroup && Math.abs(geo.nudge.left - geo.jaipurGroup.left) < 30 && geo.nudge.left !== 52;
    results.push({ file: 't3_arrange_anchor_915x412.png', ok: !!anchored, geo });
    console.log(anchored ? `  ✓ arrange anchored to jaipur group (nudge left ${geo.nudge.left} ≈ group left ${geo.jaipurGroup.left})` : `  ✗ arrange NOT anchored: ${JSON.stringify(geo)}`);
  } catch (e) { results.push({ file: 't3_arrange_anchor', ok: false, error: String(e).split('\n')[0] }); console.log('  ✗ arrange', String(e).split('\n')[0]); }
  await ctx.close();
}

// (2) ADLA-BADLI both-step hint: craft, play the card, screenshot step 1, advance, screenshot step 2.
{
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__craft === 'function', null, { timeout: 10000 });
    await page.evaluate(() => window.__craft({
      players: [
        { hand: ['action_adlaBadli_0'], properties: { jaipur: { cards: ['prop_jaipur_0'] }, kolkata: { cards: ['prop_kolkata_0'] } } },
        { properties: { mumbai: { cards: ['prop_mumbai_0'] }, chennai: { cards: ['prop_chennai_0'] } } }, {}, {},
      ],
      currentPlayerIndex: 0, phase: 'playing', playsRemaining: 2,
    }));
    await frames(page, 500);
    // drag the adlaBadli card up into the play zone → targeting opens
    const card = await page.locator('[data-card-id*="adlaBadli"]').first().boundingBox();
    const sx = card.x + Math.min(14, card.width / 2), sy = card.y + card.height * 0.4;
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 60, { steps: 6 });
    const play = await page.locator('[data-drop="play"]').first().boundingBox();
    await page.mouse.move(play.x + play.width / 2, play.y + play.height / 2, { steps: 10 }); await frames(page, 150); await page.mouse.up(); await frames(page, 500);
    const step1Hints = await page.locator('[data-hint]').count();
    await page.screenshot({ path: join(OUT, 't3_adla_step1_915x412.png') });
    // advance to step 2 by tapping the hinted mine tile
    await page.locator('[data-hint]').first().click({ force: true }); await frames(page, 400);
    const step2Hints = await page.locator('[data-hint]').count();
    await page.screenshot({ path: join(OUT, 't3_adla_step2_915x412.png') });
    const ok = step1Hints === 1 && step2Hints === 1;
    results.push({ file: 't3_adla_step2_915x412.png', ok, note: `step1 hints ${step1Hints}, step2 hints ${step2Hints}` });
    console.log(ok ? `  ✓ ADLA hint on BOTH steps (step1 ${step1Hints}, step2 ${step2Hints})` : `  ✗ ADLA hint step1 ${step1Hints} step2 ${step2Hints}`);
  } catch (e) { results.push({ file: 't3_adla', ok: false, error: String(e).split('\n')[0] }); console.log('  ✗ adla', String(e).split('\n')[0]); }
  await ctx.close();
}
await b.close();
writeFileSync(join(OUT, 'results-t3.json'), JSON.stringify({ results }, null, 2));
console.log(`${results.filter((r) => r.ok).length} ok, ${results.filter((r) => !r.ok).length} failed`);
