// @ts-check
/**
 * pnpm --filter @sauda/mobile capture:tutorial — U3 proof: the guided tutorial ("Sikho") running.
 * Records ONE webm of the demo playing through several teaching beats, including a Book jump and return,
 * plus stills of each beat. Reuses a running dev server (pnpm dev:lan on 5174); never starts one.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const DEV = 'http://localhost:5174';
const OUT = resolve(REPO, 'docs/captures/first-player-u/tutorial');
const VIDEO_DIR = join(OUT, '_video_tmp');
mkdirSync(OUT, { recursive: true });
mkdirSync(VIDEO_DIR, { recursive: true });

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

async function main() {
  if (!(await reachable(DEV))) { console.error(`no dev server at ${DEV} — run pnpm dev:lan`); process.exit(1); }
  const results = [];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    recordVideo: { dir: VIDEO_DIR, size: { width: 915, height: 412 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(`${DEV}/#/sikho`, { waitUntil: 'load' });
    // Beat 1 — Drawing. It pauses on the beat immediately.
    await page.waitForSelector('text=Drawing', { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'beat1_drawing.png') });
    results.push({ shot: 'beat1_drawing.png', ok: true });

    // The Book jump — open the Niyam link, screenshot the chapter, return to the paused beat.
    await page.click('text=/Niyam 2/');
    await page.waitForSelector('text=Your Turn', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, 'beat1_book_jump.png') });
    results.push({ shot: 'beat1_book_jump.png', ok: true });
    await page.click('[aria-label="Close the book"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, 'beat1_book_return.png') });
    results.push({ shot: 'beat1_book_return.png', ok: true });

    // Continue → the cursor draws, then beat 2 (Placing property).
    await page.click('text=Continue');
    await page.waitForSelector('text=Placing property', { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'beat2_placing.png') });
    results.push({ shot: 'beat2_placing.png', ok: true });

    // Continue → beat 3 (Completing a set).
    await page.click('text=Continue');
    await page.waitForSelector('text=Completing a set', { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'beat3_completing.png') });
    results.push({ shot: 'beat3_completing.png', ok: true });

    // Continue → the cursor completes the set; capture the board mid-demo with the cursor.
    await page.click('text=Continue');
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(OUT, 'demo_board_cursor.png') });
    results.push({ shot: 'demo_board_cursor.png', ok: true });
  } catch (e) {
    results.push({ error: String(e).split('\n')[0] });
    console.error('capture:tutorial failed:', String(e).split('\n')[0]);
  }

  await page.waitForTimeout(200);
  const video = page.video();
  await context.close();
  if (video) {
    const src = await video.path();
    const dest = join(OUT, 'tutorial_beats.webm');
    if (existsSync(dest)) rmSync(dest);
    renameSync(src, dest);
  }
  await browser.close();
  try { rmSync(VIDEO_DIR, { recursive: true, force: true }); } catch { /* gone */ }
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(`capture:tutorial: ${results.filter((r) => r.ok).length} shots, ${errors.length} console errors → ${OUT}`);
  if (errors.length) console.log('  errors:', errors.slice(0, 3));
}

main().catch((e) => { console.error(e); process.exit(1); });
