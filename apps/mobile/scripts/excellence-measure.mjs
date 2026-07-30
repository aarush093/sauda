// @ts-check
/**
 * M4B Excellence Pass — MEASUREMENT harness (dev-only, not shipped).
 *
 * Produces the NUMBERS the excellence pass is judged on, from the REAL UI at 360×740 /
 * deviceScaleFactor 2, driven to fixture states through the committed `window.__replay` hook:
 *
 *   --mode=legibility  H3: wheel rest card width; rendered px of the banner (set name) + value
 *                       badge numerals; per-card visible outer-strip % at n=2,5,7,9,11,12.
 *   --mode=overlap      H2b: the End-turn button rect vs every wheel card's rect at the live n
 *                       (and the analytic worst case n=11/12) — does any card intersect the slot?
 *   --mode=profile      H4: p95 frame time under 4× CPU throttle during a wheel glide, an active
 *                       drag, a bot turn, and TableView open/close; plus CardFace/Board render
 *                       counts during a drag (needs the dev render tally).
 *
 * It NEVER starts a dev server — it reuses the one already running (default port 5174), so the
 * session's live Vite is used and no extra process is spawned. Output: JSON on stdout + a written
 * copy under docs/captures/excellence-pass/measurements/<mode>.json.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const MODE = String(argv.mode ?? 'legibility');
const PORT = Number(argv.port ?? 5174);
const DEV_URL = `http://localhost:${PORT}`;
const OUT_DIR = resolve(REPO, 'docs/captures/excellence-pass/measurements');
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const base = (id) => ({ seed: fixture.states[id].seed, actions: fixture.states[id].actions });

// Pure re-derivation of wheelLayout geometry so the script can reason about every n without a
// fixture per hand size (card size is n-independent; only the tilt/visible-strip varies with n).
// MUST mirror apps/mobile/src/game/wheelLayout.ts — kept in lock-step by the browser cross-check.
const WHEEL = { SPAN_MAX: 120, STEP: 12, PAD: 8, HUB_RATIO: 0.34, MINW: 58, MAXW: 78, RATIO: 1.45, WIDTH_FRAC: 0.21, STRIP: 0.28 };
function wheelLayoutJS(count, containerWidth, cfg = WHEEL) {
  const cardWidth = Math.max(cfg.MINW, Math.min(cfg.MAXW, Math.round(containerWidth * cfg.WIDTH_FRAC)));
  const cardHeight = Math.round(cardWidth * cfg.RATIO);
  const hubRadius = Math.round(cardHeight * cfg.HUB_RATIO);
  const outerRadius = hubRadius + cardHeight;
  const cx = containerWidth / 2;
  const cy = outerRadius + cfg.PAD;
  const span = count <= 1 ? 0 : Math.min(cfg.SPAN_MAX, (count - 1) * cfg.STEP);
  const slots = [];
  for (let i = 0; i < count; i++) {
    const angleDeg = count <= 1 ? 0 : -span / 2 + (span * i) / (count - 1);
    const t = (angleDeg * Math.PI) / 180;
    const bcx = cx + hubRadius * Math.sin(t);
    const bcy = cy - hubRadius * Math.cos(t);
    slots.push({ x: bcx - cardWidth / 2, y: bcy - cardHeight, angleDeg });
  }
  return { cardWidth, cardHeight, height: cy, slots };
}
// The four rotated corners of a card (pivot = bottom-centre), optionally only its top strip.
function corners(slot, cw, ch, topFraction = 1) {
  const r = (slot.angleDeg * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  const px = slot.x + cw / 2, py = slot.y + ch;
  const top = -ch, bot = -ch * (1 - topFraction);
  return [[-cw / 2, bot], [cw / 2, bot], [-cw / 2, top], [cw / 2, top]].map(([ox, oy]) => ({ x: px + ox * cos - oy * sin, y: py + ox * sin + oy * cos }));
}
// axis-aligned bounding box of a set of points
function bbox(pts) {
  return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
}
function rectsOverlap(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${DEV_URL}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  return { context, page };
}
async function land(page, id) {
  const summary = await page.evaluate((b) => window.__replay(b.seed, b.actions), base(id));
  await page.waitForTimeout(150);
  return summary;
}
const frames = (page, ms) => page.waitForTimeout(ms);

// ---- H3 legibility ---------------------------------------------------------
async function legibility(browser) {
  const { context, page } = await newPage(browser);
  const summary = await land(page, 'S10_eleven_cards');
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  // Measure the wheel container width + the banner (set name) and value badge in each wheel card.
  // RENDERED px = computed font-size × the element's actual on-screen transform scale (rect.width /
  // offsetWidth), because getComputedStyle.fontSize is the UNSCALED value — the CSS transform on the
  // wheel card (CardFace drawn at 132 then scaled) only shows up in the bounding rect.
  const dom = await page.evaluate(() => {
    const wheelCards = Array.from(document.querySelectorAll('[data-card-id]')).filter((el) => {
      const s = getComputedStyle(el);
      return s.position === 'absolute' && el.querySelector('img,svg');
    });
    const container = wheelCards[0]?.parentElement;
    const cRect = container?.getBoundingClientRect();
    // The my-area zone is two levels up (wheelCard → HandWheel container → relative wrapper → zone);
    // the wheel is pinned to the zone bottom (marginTop:auto), so it can grow UP into the slack above
    // it (header + groups): maxBand = zoneH - spaceAboveWheel(from zone top) - bottomPad(8).
    const zoneEl = container?.parentElement?.parentElement;
    const zone = zoneEl?.getBoundingClientRect();
    const spaceAboveWheel = cRect && zone ? +(cRect.top - zone.top).toFixed(1) : null;
    // The on-screen scale of the CardFace inside a wheel card = its painted width / 132 (fullWidth).
    function faceScale(cardEl) {
      const face = cardEl.querySelector('img,svg')?.closest('[style*="width"]');
      const r = cardEl.getBoundingClientRect();
      return r.width / 132; // the card's rendered box is exactly cardWidth; face is 132 → scale
    }
    // every element that directly holds visible text, with its rendered (post-transform) font px.
    function texts(root) {
      const out = [];
      const walk = (el) => {
        const direct = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join('');
        if (direct) {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
          const topInCard = r.top - root.getBoundingClientRect().top;
          out.push({ text: direct, unscaledFontPx: parseFloat(cs.fontSize), renderedCssPx: +(parseFloat(cs.fontSize) * scale).toFixed(2), rectTopInCard: +topInCard.toFixed(1), uppercase: cs.textTransform === 'uppercase' || direct === direct.toUpperCase() });
        }
        Array.from(el.children).forEach(walk);
      };
      walk(root);
      return out;
    }
    const cards = wheelCards.slice(0, 8).map((el) => ({ texts: texts(el) }));
    return { containerWidth: cRect?.width ?? null, containerRect: cRect ? { top: cRect.top, bottom: cRect.bottom, height: cRect.height } : null, myAreaZoneHeight: zone ? +zone.height.toFixed(1) : null, spaceAboveWheel, cards };
  });
  // The face is drawn at 132 and transform-scaled to the rest card width, so the RENDERED glyph size
  // is unscaledFont × faceScale (rotation reorients but does not resize glyphs). faceScale is exact
  // from the layout — the rotation-inflated bounding boxes can't be used for it.
  const faceScale = wheelLayoutJS(11, dom.containerWidth ?? 330).cardWidth / 132;
  const analyzed = dom.cards.map((c) => {
    // banner = the largest UNSCALED uppercase text (the set-name title, font 9, > "FULL SET" 8);
    // badge = the ₹N Cr value disc (font 7). Both are top-strip elements on a property card.
    const banner = c.texts.filter((t) => t.uppercase && t.text.length >= 3 && !/₹/.test(t.text)).sort((a, b) => b.unscaledFontPx - a.unscaledFontPx)[0];
    const badge = c.texts.find((t) => /₹\d+\s*Cr/.test(t.text));
    return {
      bannerText: banner?.text, bannerUnscaled: banner?.unscaledFontPx,
      bannerDevicePx: banner ? +(banner.unscaledFontPx * faceScale * dpr).toFixed(1) : null,
      badgeText: badge?.text, badgeUnscaled: badge?.unscaledFontPx,
      badgeDevicePx: badge ? +(badge.unscaledFontPx * faceScale * dpr).toFixed(1) : null,
    };
  });
  // visible outer-strip % per n, from geometry at the measured container width.
  const cw = dom.containerWidth ?? 330;
  const stripByN = {};
  for (const n of [2, 5, 7, 9, 11, 12]) {
    const L = wheelLayoutJS(n, cw);
    const bandBottom = L.height; // cards are clipped by the my-area at the hub line
    let worst = 1;
    for (const slot of L.slots) {
      const box = bbox(corners(slot, L.cardWidth, L.cardHeight));
      const visibleH = Math.min(box.y1, bandBottom) - box.y0;
      const frac = visibleH / (box.y1 - box.y0);
      worst = Math.min(worst, frac);
    }
    stripByN[n] = +(worst * 100).toFixed(1);
  }
  const L = wheelLayoutJS(11, cw);
  // Vertical budget: the wheel band may grow up to fill the slack above it in the my-area zone.
  const maxBand = dom.myAreaZoneHeight && dom.spaceAboveWheel != null ? Math.round(dom.myAreaZoneHeight - dom.spaceAboveWheel - 8) : null;
  // Search the largest card that (a) passes no-clip at {346,436} n=1..12, (b) fits the band budget.
  // Levers: WIDTH_FRAC (card = frac·containerW), MAXW clamp, HUB_RATIO (overlap → shorter band).
  function noClip(cfg) {
    for (const w of [346, 436]) for (let n = 1; n <= 12; n++) {
      const LL = wheelLayoutJS(n, w, cfg);
      for (const slot of LL.slots) for (const c of corners(slot, LL.cardWidth, LL.cardHeight)) {
        if (c.x < -0.6 || c.x > w + 0.6 || c.y < -0.6) return false;
        for (const cc of corners(slot, LL.cardWidth, LL.cardHeight, cfg.STRIP)) if (cc.y > LL.height + 0.6) return false;
      }
    }
    return true;
  }
  // For each hub depth, find the LARGEST card (finest frac/MAXW) that stays within the band budget
  // AND passes no-clip — so we can pick the DEEPEST hub (most roulette character) that still clears
  // the banner bar. Card size is what drives legibility; hub depth only buys vertical room.
  const byHub = [];
  for (let HUB_RATIO = 0.42; HUB_RATIO >= 0.28; HUB_RATIO -= 0.02) {
    let best = null;
    for (let MAXW = 78; MAXW <= 96; MAXW += 2) {
      for (let WIDTH_FRAC = 0.20; WIDTH_FRAC <= 0.30; WIDTH_FRAC += 0.002) {
        const cfg = { ...WHEEL, HUB_RATIO: +HUB_RATIO.toFixed(2), MAXW, WIDTH_FRAC: +WIDTH_FRAC.toFixed(3) };
        const atReal = wheelLayoutJS(11, cw, cfg);
        if (maxBand != null && atReal.height > maxBand) continue;
        if (!noClip(cfg)) continue;
        if (!best || atReal.cardWidth > best.restCardWidth) {
          const bScale = atReal.cardWidth / 132;
          best = { HUB_RATIO: +HUB_RATIO.toFixed(2), MAXW, WIDTH_FRAC: +WIDTH_FRAC.toFixed(3), restCardWidth: atReal.cardWidth, band: atReal.height, bannerDevicePx: +(9 * bScale * dpr).toFixed(1), badgeDevicePx: +(7 * bScale * dpr).toFixed(1) };
        }
      }
    }
    if (best) byHub.push(best);
  }
  const candidates = byHub;
  await context.close();
  return { mode: 'legibility', replay: summary, dpr, measuredContainerWidth: cw, faceScale: +faceScale.toFixed(3), restCardWidthPx: L.cardWidth, restCardHeightPx: L.cardHeight, wheelBandHeightPx: L.height, myAreaZoneHeight: dom.myAreaZoneHeight, spaceAboveWheel: dom.spaceAboveWheel, maxBandBudgetPx: maxBand, sampleCards: analyzed, visibleStripPctByN: stripByN, bars: { bannerDevicePx: 9, badgeDevicePx: 10, visibleStripPct: 26 }, tuningCandidates: candidates.slice(0, 8) };
}

// ---- H2b overlap -----------------------------------------------------------
async function overlap(browser) {
  const { context, page } = await newPage(browser);
  const summary = await land(page, 'S10_eleven_cards');
  const dom = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /End turn/i.test(b.textContent || ''));
    const bRect = btn?.getBoundingClientRect();
    const wheelCards = Array.from(document.querySelectorAll('[data-card-id]')).filter((el) => getComputedStyle(el).position === 'absolute' && el.querySelector('img,svg'));
    const container = wheelCards[0]?.parentElement?.getBoundingClientRect();
    return {
      button: bRect ? { x: bRect.x, y: bRect.y, w: bRect.width, h: bRect.height } : null,
      container: container ? { x: container.x, y: container.y, w: container.width, h: container.height } : null,
      cards: wheelCards.map((el) => { const r = el.getBoundingClientRect(); return { id: el.getAttribute('data-card-id'), x: r.x, y: r.y, w: r.width, h: r.height }; }),
    };
  });
  // live DOM overlap (bounding boxes)
  let liveHits = [];
  if (dom.button) {
    const b = { x0: dom.button.x, x1: dom.button.x + dom.button.w, y0: dom.button.y, y1: dom.button.y + dom.button.h };
    liveHits = dom.cards.filter((c) => rectsOverlap({ x0: c.x, x1: c.x + c.w, y0: c.y, y1: c.y + c.h }, b)).map((c) => c.id);
  }
  // analytic overlap at n=1..12 for both container widths, using the button size measured live,
  // anchored bottom-right (right:4, bottom:8) of the wheel band.
  const btnW = dom.button?.w ?? 92, btnH = dom.button?.h ?? 34;
  const analytic = {};
  for (const width of [346, 436]) {
    analytic[width] = [];
    for (let n = 1; n <= 12; n++) {
      const L = wheelLayoutJS(n, width);
      const slot = { x0: width - 4 - btnW, x1: width - 4, y0: L.height - 8 - btnH, y1: L.height - 8 };
      const hit = L.slots.some((s) => rectsOverlap(bbox(corners(s, L.cardWidth, L.cardHeight)), slot));
      if (hit) analytic[width].push(n);
    }
  }
  await context.close();
  return { mode: 'overlap', replay: summary, liveButton: dom.button, liveContainer: dom.container, liveOverlapCardIds: liveHits, buttonSizePx: { w: btnW, h: btnH }, analyticOverlapNByWidth: analytic };
}

// ---- H4 performance profile (4x CPU throttle) ------------------------------
function pct(sorted, p) { if (!sorted.length) return 0; return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]; }

async function profile(browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const requestsDuringInteraction = [];
  // Track REAL network fetches (not cache hits) of plate images during interactions, via CDP so we
  // can tell a served-from-cache request from a network one.
  await client.send('Network.enable');
  let countingNet = false;
  const netPlateFetches = [];
  client.on('Network.responseReceived', (e) => {
    if (countingNet && /\.(webp|png|jpg)(\?|$)/.test(e.response.url) && !e.response.fromDiskCache && e.response.fromServiceWorker !== true && (e.response.encodedDataLength ?? 0) > 0) {
      netPlateFetches.push(e.response.url.split('/').pop());
    }
  });
  page.on('request', (r) => { if (countingNet && /\.(webp|png|jpg)(\?|$)/.test(r.url())) requestsDuringInteraction.push(r.url().split('/').pop()); });
  await page.goto(`${DEV_URL}/#/autostart`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
  await page.evaluate((b) => window.__replay(b.seed, b.actions), base('S6_haveli')); // richest late-game board
  await page.evaluate(() => { window.__saudaCapturePaused = false; });
  await page.waitForTimeout(800); // let the game-start plate preload settle
  countingNet = true; // only count plate fetches DURING interactions (per-render fetches)
  // rAF frame recorder — inter-frame deltas under load are the frame times.
  await page.evaluate(() => {
    window.__frames = []; window.__rec = false;
    const tick = (t) => { if (window.__rec) window.__frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  async function measure(fn) {
    await page.evaluate(() => { window.__frames = []; window.__rec = true; window.__renderTally = {}; });
    await fn();
    const data = await page.evaluate(() => { window.__rec = false; return { frames: window.__frames, tally: window.__renderTally }; });
    const d = [];
    for (let i = 1; i < data.frames.length; i++) d.push(data.frames[i] - data.frames[i - 1]);
    d.sort((a, b) => a - b);
    return { frames: d.length, p50: +pct(d, 50).toFixed(1), p95: +pct(d, 95).toFixed(1), max: +(d.length ? d[d.length - 1] : 0).toFixed(1), tally: data.tally };
  }

  const bandBox = async () => { const c = await page.locator('[data-card-id]').all(); const bs = []; for (const x of c) { const b = await x.boundingBox(); if (b) bs.push(b); } bs.sort((a, b) => a.x - b.x); return bs; };

  // (a) wheel glide — commit a play so the hand shrinks and the rest glide (175ms).
  const glide = await measure(async () => {
    const bs = await bandBox();
    if (bs.length) { // drag the leftmost card up into a drag, then release over the bank if lit, else dead
      const y = bs[0].y + bs[0].height * 0.35;
      await page.mouse.move(bs[0].x + 6, y); await page.mouse.down();
      await page.mouse.move(bs[0].x + 6, y - 60, { steps: 4 });
      const bank = await page.locator('[data-drop="bank"]').first().boundingBox();
      if (bank) await page.mouse.move(bank.x + bank.width / 2, bank.y + bank.height / 2, { steps: 6 });
      await page.mouse.up();
    }
    await page.waitForTimeout(500);
  });

  // (b) active drag pointermove — the re-render test. Hold a card in the air, oscillate, never release.
  const drag = await measure(async () => {
    const bs = await bandBox();
    if (bs.length) {
      const mid = bs[Math.floor(bs.length / 2)];
      const y = mid.y + mid.height * 0.35;
      await page.mouse.move(mid.x + mid.width / 2, y); await page.mouse.down();
      await page.mouse.move(mid.x + mid.width / 2, y - 60, { steps: 4 }); // lift into a drag
      for (let i = 0; i < 24; i++) { await page.mouse.move(120 + (i % 2) * 90, 300 + (i % 3) * 40, { steps: 2 }); await frames(page, 16); }
      await page.mouse.move(5, 5); await page.mouse.up(); // release in dead space — no commit
    }
  });
  const dragTally = drag.tally;

  // (d) TableView open/close — tap my group open (its "tap to expand" title), then tap off to close.
  const tableview = await measure(async () => {
    const grp = page.locator('[title*="tap to expand"]').first();
    if (await grp.count()) { await grp.click(); await frames(page, 350); await page.mouse.click(180, 20); await frames(page, 350); }
  });

  // (c) a bot turn's beats — end my turn, let the bots play.
  const botTurn = await measure(async () => {
    const end = page.locator('button', { hasText: 'End turn' }).first();
    if (await end.count()) await end.click();
    await page.waitForTimeout(3000);
  });

  const dom = await page.evaluate(() => ({ nodes: document.querySelectorAll('*').length, imgs: document.querySelectorAll('img').length }));
  await context.close();
  return { mode: 'profile', board: 'S6_haveli', throttle: '4x CPU', budget: { targetMs: 16.7, ceilingMs: 33 }, frameTimes: { wheelGlide: glide, activeDrag: { frames: drag.frames, p50: drag.p50, p95: drag.p95, max: drag.max }, tableViewOpenClose: tableview, botTurnBeats: botTurn }, renderCountsDuringDrag: dragTally, domNodeCount: dom.nodes, imgCount: dom.imgs, plateImageRequestEvents: requestsDuringInteraction, plateNetworkFetchesDuringInteractions: netPlateFetches };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let result;
  try {
    if (MODE === 'legibility') result = await legibility(browser);
    else if (MODE === 'overlap') result = await overlap(browser);
    else if (MODE === 'profile') result = await profile(browser);
    else throw new Error(`unknown mode ${MODE}`);
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT_DIR, `${MODE}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
