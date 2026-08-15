// @ts-check
/** pnpm --filter @sauda/mobile capture:handinfo6 — T4: the owner's first path. Home -> KHELO -> setup
 * (difficulty lines + expected-win-share, S6e) -> DEAL -> #/play, at both landscape profiles. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs/captures/hand-info-1'); mkdirSync(OUT, { recursive: true });
const DEV = 'http://localhost:5174';
const PROFILES = [{ id: '915x412', w: 915, h: 412 }, { id: '740x360', w: 740, h: 360 }];
const results = [];
const b = await chromium.launch();
for (const p of PROFILES) {
  const ctx = await b.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  try {
    await page.goto(`${DEV}/#/`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, `t4_home_${p.id}.png`) });
    // open the setup card
    await page.locator('button', { hasText: 'KHELO' }).first().click();
    await page.waitForTimeout(300);
    // pick Easy so the S6e blurb + win-share reflect it
    await page.locator('button', { hasText: /^Easy$/ }).first().click();
    await page.waitForTimeout(200);
    const share = await page.evaluate(() => document.body.innerText);
    const hasBlurb = /forgiving game to learn on/i.test(share);
    const hasShare = /you win about/i.test(share) && /fair share is/i.test(share);
    await page.screenshot({ path: join(OUT, `t4_setup_easy_${p.id}.png`) });
    // deal in
    await page.locator('button', { hasText: /^DEAL$/ }).first().click();
    await page.waitForTimeout(700);
    const dealt = await page.evaluate(() => ({ hash: location.hash, hasGame: !!(window.__sauda && window.__sauda.getState().state) }));
    await page.screenshot({ path: join(OUT, `t4_dealt_${p.id}.png`) });
    const ok = hasBlurb && hasShare && dealt.hash.includes('/play') && dealt.hasGame && errs.length === 0;
    results.push({ profile: p.id, ok, hasBlurb, hasShare, dealt, errors: errs.slice(0, 3) });
    console.log(`  ${ok ? '✓' : '✗'} ${p.id}: blurb=${hasBlurb} share=${hasShare} -> ${dealt.hash} game=${dealt.hasGame}`);
  } catch (e) { results.push({ profile: p.id, ok: false, error: String(e).split('\n')[0] }); console.log('  ✗', p.id, String(e).split('\n')[0]); }
  await ctx.close();
}
await b.close();
writeFileSync(join(OUT, 'results-t4.json'), JSON.stringify({ results }, null, 2));
console.log(`${results.filter((r) => r.ok).length}/${results.length} profiles OK`);
