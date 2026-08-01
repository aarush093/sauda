// @ts-check
/**
 * pnpm capture:shell — the P8 shell evidence (PHONE-1). Shoots the front door and the rules book at
 * a real phone profile: HOME, HOME with the KHELO setup card open, the Book contents page, two Book
 * chapters (Properties with rent ladders · Action cards), and the in-game pause sheet (reached by
 * dealing a game then tapping the home glyph). Rerunnable; writes to docs/captures/phone-1/shell.
 *
 * Playwright is a devDependency and this lives outside src/, so the production bundle is unaffected.
 * Usage: pnpm capture:shell [--out=docs/captures/phone-1/shell] [--port=5173]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const OUT = resolve(REPO, String(argv.out ?? 'docs/captures/phone-1/shell'));
const PORT = Number(argv.port ?? 5173);
const URL = `http://localhost:${PORT}`;

async function reachable(u) { try { const r = await fetch(u); return r.ok || r.status === 404; } catch { return false; } }
async function startDev() {
  const proc = spawn('pnpm --filter @sauda/mobile dev', { cwd: REPO, shell: true, stdio: 'ignore' });
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) { if (await reachable(URL)) return proc; await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('capture:shell: dev server not reachable');
}
function stopDev(proc) {
  if (!proc || proc.pid === undefined) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill('SIGTERM');
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const have = await reachable(URL);
  const server = have ? null : await startDev();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
  try {
    // HOME + the KHELO setup card
    await page.goto(`${URL}/#/`, { waitUntil: 'load' }); await page.waitForTimeout(400);
    await shot('HOME');
    await page.getByText('KHELO').click(); await page.waitForTimeout(250);
    await shot('HOME_setup');

    // THE BOOK — contents + two chapters (fresh mount so the deep-link/contents state is clean)
    await page.goto(`${URL}/#/niyam`, { waitUntil: 'load' }); await page.waitForTimeout(400);
    await shot('BOOK_contents');
    await page.getByText('Properties & Wildcards').click(); await page.waitForTimeout(350);
    await shot('BOOK_ch3_properties');
    await page.getByText('← Niyam').click(); await page.waitForTimeout(150);
    await page.getByText('Action Cards').click(); await page.waitForTimeout(350);
    await shot('BOOK_ch6_actions');

    // IN-GAME PAUSE — deal a game, tap the home glyph
    await page.goto(`${URL}/#/`, { waitUntil: 'load' }); await page.waitForTimeout(300);
    await page.getByText('KHELO').click(); await page.waitForTimeout(150);
    await page.getByText('DEAL').click(); await page.waitForTimeout(500);
    await page.getByLabel('Pause — game menu').click(); await page.waitForTimeout(300);
    await shot('PAUSE_sheet');
  } finally {
    await browser.close();
    stopDev(server);
  }
  console.log(`capture:shell: wrote 6 frames to ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
