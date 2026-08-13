// @ts-check
/** pnpm --filter @sauda/mobile capture:handinfo4 — S5 blast-radius sweep. Verifies the spread's
 * bigger cards don't collide with the turn token / bank tray / discard overlay / spectate panel, at
 * both profiles. Crafts a full 11-card hand via __craft; lands discard + spectate via __replay. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'docs/captures/hand-info-1'); mkdirSync(OUT, { recursive: true });
const FX = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const PROFILES = [{ id: '915x412', w: 915, h: 412 }, { id: '740x360', w: 740, h: 360 }];
const results = [];
const HAND11 = ['prop_jaipur_0', 'prop_jaipur_1', 'prop_kolkata_0', 'money_1_0', 'money_2_0', 'money_3_0', 'money_5_0', 'action_vasooli_0', 'action_kabza_0', 'action_haathKiSafai_0', 'wild_any_0'];
const SPEC11 = { players: [{ hand: HAND11, properties: { mumbai: { cards: ['prop_mumbai_0'] } } }, {}, {}, {}], currentPlayerIndex: 0, phase: 'playing', playsRemaining: 3 };

async function page(browser, p) {
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  return { ctx, pg, errs };
}
async function boot(pg) { await pg.goto('http://localhost:5174/#/autostart', { waitUntil: 'load' }); await pg.waitForFunction(() => typeof window.__craft === 'function', null, { timeout: 10000 }); }

const b = await chromium.launch();
for (const p of PROFILES) {
  // 1. full 11-card hand — the worst case for turn token / bank tray collision with the spread.
  { const { ctx, pg, errs } = await page(b, p); try { await boot(pg); await pg.evaluate((s) => window.__craft(s), SPEC11); await pg.waitForTimeout(600);
      const cards = await pg.locator('[data-card-id]').count();
      await pg.screenshot({ path: join(OUT, `s5_hand11_${p.id}.png`) });
      results.push({ file: `s5_hand11_${p.id}.png`, ok: cards === 11 && errs.length === 0, note: `spread cards ${cards}, errors ${errs.length}` });
      console.log(`  ${cards === 11 ? '✓' : '✗'} s5_hand11_${p.id} (${cards} cards)`);
    } catch (e) { results.push({ file: `s5_hand11_${p.id}`, ok: false, error: String(e).split('\n')[0] }); } finally { await ctx.close(); } }
  // 2. discard overlay entry (over the hand limit).
  { const { ctx, pg } = await page(b, p); try { await boot(pg); const s = FX.states['S5_discard_mode']; await pg.evaluate((x) => window.__replay(x.seed, x.actions), s); await pg.waitForTimeout(600);
      await pg.screenshot({ path: join(OUT, `s5_discard_${p.id}.png`) });
      results.push({ file: `s5_discard_${p.id}.png`, ok: true }); console.log(`  ✓ s5_discard_${p.id}`);
    } catch (e) { results.push({ file: `s5_discard_${p.id}`, ok: false, error: String(e).split('\n')[0] }); } finally { await ctx.close(); } }
  // 3. SPECTATE my-panel (a bot is acting).
  { const { ctx, pg } = await page(b, p); try { await boot(pg); const s = FX.states['S3_pay_from_bank']; await pg.evaluate((x) => window.__replay(x.seed, x.actions), s); await pg.waitForTimeout(600);
      await pg.screenshot({ path: join(OUT, `s5_spectate_${p.id}.png`) });
      results.push({ file: `s5_spectate_${p.id}.png`, ok: true }); console.log(`  ✓ s5_spectate_${p.id}`);
    } catch (e) { results.push({ file: `s5_spectate_${p.id}`, ok: false, error: String(e).split('\n')[0] }); } finally { await ctx.close(); } }
}
await b.close();
writeFileSync(join(OUT, 'results-s5.json'), JSON.stringify({ results }, null, 2));
console.log(`${results.filter((r) => r.ok).length} ok, ${results.filter((r) => !r.ok).length} failed`);
