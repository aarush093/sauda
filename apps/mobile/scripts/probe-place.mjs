// Focused probe: can a property be PLACED by a real drag onto its set zone? Deals seed 7, draws, and
// for each placeable property in hand tries a careful lift (grab the card's exposed TOP-CENTRE, not a
// guessed sliver), reads the set zone that appears mid-drag, drops on its centre, and reports whether
// the hand shrank. Prints the data-drop ids present mid-drag so a miss is explained, not guessed.
import { chromium } from 'playwright';
import { legalActions } from '@sauda/engine';
import profileData from '../src/dev/deviceProfiles.json' with { type: 'json' };
const P = profileData.profiles.find((p) => p.id === 'tall-915x412');
const DEV = 'http://localhost:5174';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: P.width, height: P.height }, deviceScaleFactor: P.dpr, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(4000);
const getState = () => page.evaluate(() => window.__sauda.getState().state);
const drops = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-drop]')).map((e) => e.getAttribute('data-drop')));

await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__replay === 'function');
await page.evaluate(() => { window.__saudaCapturePaused = true; window.__sauda.getState().newGame({ seats:[{kind:'human'},{kind:'bot',difficulty:'medium'},{kind:'bot',difficulty:'medium'},{kind:'bot',difficulty:'medium'}], seed: 7 }); window.__sauda.getState().dispatch({ type:'DRAW' }); });
await page.waitForTimeout(250);

const state = await getState();
const legal = legalActions(state, 0);
const placeCards = [...new Set(legal.filter((a) => a.type === 'PLACE_PROPERTY').map((a) => a.cardId))];
console.log('placeable properties in hand:', placeCards.join(', '));
console.log('drops at REST:', (await drops()).join(', '));

async function tryPlace(cardId, grabDesc, gx, gy) {
  const setId = legal.find((a) => a.type === 'PLACE_PROPERTY' && a.cardId === cardId).set;
  const before = (await getState()).players[0].hand.length;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx, gy - 60, { steps: 6 });
  await page.waitForTimeout(140);
  const mid = await drops();
  let zone = null;
  try { zone = await page.locator(`[data-drop="set:${setId}"]`).first().boundingBox(); } catch { /* zone absent mid-drag */ }
  if (!zone) { await page.mouse.up(); await page.waitForTimeout(80); return { cardId, grabDesc, ok: false, mid, note: `set:${setId} absent mid-drag` }; }
  await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(220);
  const after = (await getState()).players[0].hand.length;
  return { cardId, grabDesc, ok: after < before, mid, note: after < before ? 'COMMITTED' : 'homed (no commit)' };
}

for (const cardId of placeCards) {
  // grab the card's exposed TOP-CENTRE — in the wheel fan every card's upper edge is uncovered
  const box = await page.locator(`[data-card-id="${cardId}"]`).first().boundingBox();
  if (!box) { console.log(`  ${cardId}: no DOM box`); continue; }
  const r1 = await tryPlace(cardId, 'top-centre', box.x + box.width / 2, box.y + 8);
  console.log(`  ${cardId} [${r1.grabDesc}] ok=${r1.ok} — ${r1.note}  | mid-drag drops: ${r1.mid.join(',')}`);
  // re-deal between attempts so each card starts from the same fresh hand
  await page.evaluate(() => { window.__sauda.getState().newGame({ seats:[{kind:'human'},{kind:'bot',difficulty:'medium'},{kind:'bot',difficulty:'medium'},{kind:'bot',difficulty:'medium'}], seed: 7 }); window.__sauda.getState().dispatch({ type:'DRAW' }); });
  await page.waitForTimeout(200);
}
await browser.close();
