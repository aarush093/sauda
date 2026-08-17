// @ts-check
/**
 * pnpm --filter @sauda/mobile capture:firstplayer — U1 proof pack (the first-player pass).
 *
 * The owner's sister (iPhone 12 Safari, landscape) had the hand cards CLIPPED at the bottom. U1 sizes
 * the play surface from the LIVE measured viewport (visualViewport + safe-area insets), not static
 * 100dvh/100vw. This script proves the fix on the two iOS Safari devices real testers hold — iPhone 12
 * landscape and iPhone SE landscape — WITH the reality Playwright doesn't render on its own:
 *   - browser chrome: the viewport is shrunk to the profile's USABLE height (height - chrome), i.e. what
 *     visualViewport reports once Safari's URL bar / tab strip take their share.
 *   - safe-area insets: fed to the app via window.__saudaInsets (dev-only), since Chromium cannot
 *     emulate env(safe-area-inset-*); in landscape the notch inset sits on the SIDE.
 *
 * Four stills per profile — rest, an 11-card hand, the targeting split, the payment sheet — each
 * self-verified: EVERY on-screen card's bounding box sits fully inside the measured viewport, and the
 * document never scrolls. A clip or a page scroll fails the entry (it is NOT silently passed).
 *
 * Reuses a dev server already running (pnpm dev:lan on 5174); never starts one.
 *   node scripts/capture-first-player.mjs [--port=5174]
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
const OUT = resolve(REPO, 'docs/captures/first-player-u');
mkdirSync(OUT, { recursive: true });
const P = Object.fromEntries(profileData.profiles.map((p) => [p.id, p]));
const IOS_PROFILES = ['iphone12-844x390', 'iphonese-667x375'];

// A crafted rest-state board: a couple of built colours, a mixed hand — a normal my-turn at rest.
const REST_SPEC = {
  players: [
    { hand: ['prop_mumbai_0', 'money_3_0', 'money_2_0', 'action_kabza_0', 'wild_any_0'], properties: { jaipur: { cards: ['prop_jaipur_0', 'prop_jaipur_1'] }, kolkata: { cards: ['prop_kolkata_0'] } } },
    { properties: { chennai: { cards: ['prop_chennai_0'] } } },
    { properties: { delhi: { cards: ['prop_delhi_0'] } } },
    {},
  ],
  currentPlayerIndex: 0, phase: 'playing', playsRemaining: 3,
};
// The 11-card hand — the worst case for the bottom edge (the spread at full width).
const HAND11 = ['prop_jaipur_0', 'prop_jaipur_1', 'prop_kolkata_0', 'money_1_0', 'money_2_0', 'money_3_0', 'money_5_0', 'action_vasooli_0', 'action_kabza_0', 'action_haathKiSafai_0', 'wild_any_0'];
const HAND11_SPEC = { players: [{ hand: HAND11, properties: { mumbai: { cards: ['prop_mumbai_0'] } } }, {}, {}, {}], currentPlayerIndex: 0, phase: 'playing', playsRemaining: 3 };
// A hand holding HAATH KI SAFAI, with opponents holding stealable single properties — drag it to play
// to open the targeting split.
const TARGET_SPEC = {
  players: [
    { hand: ['action_haathKiSafai_0', 'money_2_0', 'prop_mumbai_0'], properties: { mumbai: { cards: ['prop_mumbai_1'] } } },
    { properties: { jaipur: { cards: ['prop_jaipur_0'] } } },
    { properties: { kolkata: { cards: ['prop_kolkata_0'] } } },
    {},
  ],
  currentPlayerIndex: 0, phase: 'playing', playsRemaining: 3,
};
const FX = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));

async function newPage(browser, profile) {
  const safe = profile.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const usableHeight = profile.height - (profile.chrome ?? 0);
  const context = await browser.newContext({
    viewport: { width: profile.width, height: usableHeight }, // chrome already eaten (visualViewport)
    deviceScaleFactor: Math.min(profile.dpr, 3), isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  // Feed the notch insets before any app code runs (dev-only hook the viewport module reads).
  await page.addInitScript((insets) => { window.__saudaInsets = insets; }, safe);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { context, page, errors, box: { width: profile.width, height: usableHeight } };
}

async function boot(page) {
  await page.goto(`${DEV}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__craft === 'function' && typeof window.__replay === 'function', null, { timeout: 10000 });
  await page.evaluate(() => { window.__saudaCapturePaused = true; });
}

// The core check: NOTHING is clipped. Every rendered card's box sits inside the measured viewport, and
// the document does not scroll (a scroll means content is off the visible box).
async function nothingClipped(page, box) {
  return page.evaluate((vp) => {
    const scrolls = document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > window.innerWidth + 1;
    const cards = Array.from(document.querySelectorAll('[data-card-id]'));
    let clipped = 0;
    for (const el of cards) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // not laid out (e.g. parked hand) — skip
      if (r.left < -1 || r.top < -1 || r.right > vp.width + 1 || r.bottom > vp.height + 1) clipped += 1;
    }
    return { scrolls, clipped, cardCount: cards.length };
  }, box);
}

async function liftAndPlay(page, cardSel) {
  const card = await page.locator(cardSel).first().boundingBox();
  if (!card) throw new Error(`no card ${cardSel}`);
  const start = { x: card.x + Math.min(12, card.width / 2), y: card.y + card.height * 0.4 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y - 55, { steps: 5 });
  const play = await page.locator('[data-drop="play"]').first().boundingBox();
  if (!play) throw new Error('no play zone');
  await page.mouse.move(play.x + play.width / 2, play.y + play.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

const results = [];
async function shoot(page, box, file, note) {
  const check = await nothingClipped(page, box);
  const ok = !check.scrolls && check.clipped === 0;
  await page.screenshot({ path: join(OUT, file) });
  results.push({ file, ok, note: `${note} — cards ${check.cardCount}, clipped ${check.clipped}, pageScroll ${check.scrolls}` });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${file}  (${check.cardCount} cards, ${check.clipped} clipped, scroll ${check.scrolls})`);
}

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

async function main() {
  if (!(await reachable(DEV))) { console.error(`capture:firstplayer: no dev server at ${DEV} — run pnpm dev:lan first.`); process.exit(1); }
  const browser = await chromium.launch();
  try {
    for (const id of IOS_PROFILES) {
      const profile = P[id];
      const tag = `${profile.width}x${profile.height}`;
      console.log(`\nprofile ${profile.label}`);

      // 1. rest state
      { const { context, page, box } = await newPage(browser, profile); try { await boot(page); await page.evaluate((s) => window.__craft(s), REST_SPEC); await page.waitForTimeout(500); await shoot(page, box, `rest__${tag}.png`, 'rest state'); } finally { await context.close(); } }
      // 2. 11-card hand (the bottom-edge worst case)
      { const { context, page, box } = await newPage(browser, profile); try { await boot(page); await page.evaluate((s) => window.__craft(s), HAND11_SPEC); await page.waitForTimeout(500); await shoot(page, box, `hand11__${tag}.png`, '11-card hand'); } finally { await context.close(); } }
      // 3. targeting split (drag HAATH KI SAFAI to play)
      { const { context, page, box } = await newPage(browser, profile); try { await boot(page); await page.evaluate((s) => window.__craft(s), TARGET_SPEC); await page.waitForTimeout(400); await liftAndPlay(page, '[data-card-id="action_haathKiSafai_0"]'); await shoot(page, box, `targeting__${tag}.png`, 'targeting split'); } finally { await context.close(); } }
      // 4. payment sheet (a charge lands on me; my bank can pay)
      { const { context, page, box } = await newPage(browser, profile); try { await boot(page); const s = FX.states['S3_pay_from_bank']; await page.evaluate((x) => window.__replay(x.seed, x.actions), s); await page.evaluate(() => { window.__saudaCapturePaused = false; }); await page.waitForTimeout(900); await shoot(page, box, `payment__${tag}.png`, 'payment sheet'); } finally { await context.close(); } }
    }
  } finally { await browser.close(); }
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ results }, null, 2));
  const ok = results.filter((r) => r.ok).length;
  console.log(`\ncapture:firstplayer: ${ok}/${results.length} stills clean → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
