// @ts-check
/**
 * J3 (M4b close-out): shoot the value-badge legibility FLOOR side-by-side, OFF vs ON, for the owner
 * to rule on. The floor ships OFF (design/badgeFloor.ts BADGE_FLOOR_DEFAULT); a `?badgeFloor=1` query
 * param flips it ON for a single page load, so the same build produces both halves of each pair.
 *
 *   node apps/mobile/scripts/capture-badge-floor.mjs [--port=5174]
 *
 * Scenes (the ones the pass names): the hand wheel at n=7 and n=11 (where the badge measured ~7.3
 * device px, under the 10 bar), and one late-game board (S6_haveli) so the owner also sees the floor
 * on the small on-board cascades + opponent strips (where it grows the most). Output + an index →
 * docs/captures/m4b-closeout/badge-floor/. Reuses the running dev server; never starts one.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port ?? 5174);
const DEV_URL = `http://localhost:${PORT}`;
const OUT = resolve(REPO, 'docs/captures/m4b-closeout/badge-floor');
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const base = (id) => ({ seed: fixture.states[id].seed, actions: fixture.states[id].actions });

const KILL_MOTION = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

const SCENES = [
  { file: 'wheel_n7', hash: '#/dev/wheel/7', what: 'Hand wheel, 7 cards — the value badge on each card face.' },
  { file: 'wheel_n11', hash: '#/dev/wheel/11', what: 'Hand wheel, 11 cards — the same badge at the busiest hand.' },
  { file: 'board_cascade', hash: '#/autostart', base: base('S6_haveli'), what: 'Late-game board — my ~38 px on-board set cascades + opponent strips (where the floor grows most).' },
];

async function shoot(browser, scene, floorOn) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const query = floorOn ? '?badgeFloor=1' : '';
  await page.goto(`${DEV_URL}/${query}${scene.hash}`, { waitUntil: 'load' });
  if (scene.base) {
    await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });
    await page.evaluate((b) => window.__replay(b.seed, b.actions), scene.base);
    await page.waitForTimeout(150);
  }
  await page.addStyleTag({ content: KILL_MOTION });
  await page.waitForTimeout(150);
  const suffix = floorOn ? 'floor_on' : 'floor_off';
  await page.screenshot({ path: join(OUT, `${scene.file}_${suffix}.png`) });
  await context.close();
}

async function reachable(url) { try { const r = await fetch(url); return r.ok || r.status === 404; } catch { return false; } }

// J3 hard constraint: the FULL-SIZE face must be byte-identical OFF vs ON (the floor only touches
// scaled renders). The dev card route draws a full-size CardFace with no renderedWidth, so the floor
// is a no-op there — we prove it by hashing the two screenshots. Returns whether they matched.
async function proveFullSizeIdentical(browser) {
  const cardId = 'prop_newDelhi_0';
  const shot = async (floorOn) => {
    const context = await browser.newContext({ viewport: { width: 500, height: 760 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${DEV_URL}/${floorOn ? '?badgeFloor=1' : ''}#/dev/card/${cardId}`, { waitUntil: 'load' });
    await page.addStyleTag({ content: KILL_MOTION });
    await page.waitForTimeout(150);
    const buffer = await page.screenshot();
    await context.close();
    return buffer;
  };
  const off = await shot(false);
  const on = await shot(true);
  writeFileSync(join(OUT, 'fullsize_face_floor_off.png'), off);
  writeFileSync(join(OUT, 'fullsize_face_floor_on.png'), on);
  const hashOff = createHash('sha256').update(off).digest('hex');
  const hashOn = createHash('sha256').update(on).digest('hex');
  return { identical: hashOff === hashOn, hashOff: hashOff.slice(0, 16), hashOn: hashOn.slice(0, 16) };
}

async function main() {
  if (!(await reachable(DEV_URL))) { console.error(`capture-badge-floor: no dev server at ${DEV_URL} — start one (pnpm --filter @sauda/mobile dev:lan) first.`); process.exit(1); }
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let proof;
  try {
    for (const scene of SCENES) {
      for (const floorOn of [false, true]) {
        await shoot(browser, scene, floorOn);
        console.log(`  ${scene.file.padEnd(16)} ${floorOn ? 'floor ON ' : 'floor OFF'}  ok`);
      }
    }
    proof = await proveFullSizeIdentical(browser);
    console.log(`  full-size face OFF vs ON: ${proof.identical ? 'IDENTICAL ✓' : 'DIFFERENT ✗'} (${proof.hashOff} / ${proof.hashOn})`);
  } finally {
    await browser.close();
  }
  writeIndex(proof);
  console.log(`\ncapture-badge-floor: ${SCENES.length} scenes × {OFF,ON} + full-size proof → ${OUT}`);
}

function writeIndex(proof) {
  const lines = [
    '# J3 — value-badge legibility floor: OFF vs ON (owner A/B)',
    '',
    'The badge floor keeps the value numerals at ≥10 device px on shrunk faces (design/badgeFloor.ts).',
    'It ships **OFF** (`BADGE_FLOOR_DEFAULT = false`); these stills are for the owner to rule. Each pair',
    'is the SAME state, `?badgeFloor=1` the only difference. 360×740, deviceScaleFactor 2, motion off.',
    'Reshoot: `node apps/mobile/scripts/capture-badge-floor.mjs`.',
    '',
    '| Scene | OFF (shipped default) | ON (candidate) |',
    '|-------|-----------------------|----------------|',
  ];
  for (const s of SCENES) {
    lines.push(`| ${s.what} | \`${s.file}_floor_off.png\` | \`${s.file}_floor_on.png\` |`);
  }
  lines.push('');
  if (proof) {
    lines.push(`**Full-size face unaffected (proof):** \`fullsize_face_floor_off.png\` vs \`fullsize_face_floor_on.png\` are **${proof.identical ? 'byte-identical' : 'DIFFERENT'}** (sha256 ${proof.hashOff} / ${proof.hashOn}). The floor only touches scaled-down renders.`);
    lines.push('');
  }
  lines.push('**Owner call:** pick OFF or ON. If ON, flip `BADGE_FLOOR_DEFAULT` to `true` (one line).');
  writeFileSync(join(OUT, 'INDEX.md'), lines.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
