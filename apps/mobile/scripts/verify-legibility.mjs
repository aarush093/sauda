// @ts-check
/** T2: re-measure the spread's legibility at both landscape profiles — the TRUE rendered card width
 * and the on-screen device-px of the banner title + value badge (font-size × scale × dpr, the same
 * model badgeFloor.ts uses for the H3 floor). Prints the before(wheel)/after(spread) table. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs/captures/hand-info-1'); mkdirSync(OUT, { recursive: true });
const PROFILES = [{ id: '915x412', w: 915, h: 412 }, { id: '740x360', w: 740, h: 360 }];
const DPR = 2, FULL = 132, BANNER_FONT = 9, BADGE_FONT = 7; // from CardFace.tsx (title fontSize 9, badge 7)
const b = await chromium.launch();
const rows = [];
for (const p of PROFILES) {
  const page = await (await b.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: DPR })).newPage();
  await page.goto('http://localhost:5174/#/dev/wheel/11', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const cardW = await page.evaluate(() => { const el = document.querySelector('[data-card-id]'); return el ? Math.round(el.getBoundingClientRect().width) : null; });
  const scale = cardW / FULL;
  rows.push({ profile: p.id, restCardPx: cardW, bannerDevicePx: +(BANNER_FONT * scale * DPR).toFixed(1), badgeDevicePx: +(BADGE_FONT * scale * DPR).toFixed(1) });
}
await b.close();
// The retired wheel rest card measured ~69 px (badgeFloor.ts records ~7.3 device-px), the before column.
const wheel = { restCardPx: 69, bannerDevicePx: +(BANNER_FONT * (69 / FULL) * DPR).toFixed(1), badgeDevicePx: +(BADGE_FONT * (69 / FULL) * DPR).toFixed(1) };
const report = { model: 'device-px = faceFont × (cardWidth/132) × dpr(2)  — same as badgeFloor.ts (H3 floor = 10)', wheelBefore: wheel, spreadAfter: rows };
writeFileSync(join(OUT, 'verify-legibility.json'), JSON.stringify(report, null, 2));
console.log('BEFORE (retired wheel):', JSON.stringify(wheel));
for (const r of rows) console.log(`AFTER  (spread ${r.profile}):`, JSON.stringify(r));
console.log('\nH3 badge floor = 10 device-px. 915 badge =', rows[0].badgeDevicePx, rows[0].badgeDevicePx >= 10 ? '≥ floor (clears with badgeFloor toggle OFF)' : '< floor');
