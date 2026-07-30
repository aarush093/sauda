// @ts-check
/**
 * pnpm capture — the headless, committed, rerunnable Phase-B capture pipeline.
 *
 * WHAT: opens the real play UI headless at an exact viewport (default 360x740, deviceScaleFactor
 * 2, reduced-motion) and shoots one PNG per recorded scenario state PLUS the composite frames the
 * Phase-B report could only describe (mid-drag glow, the Munshi advisor, a dimmed bot turn, …).
 *
 * HOW it reaches each state: the committed fixture `tools/fixtures/scenarios.json` holds a full,
 * deterministic action log per state. We drive the app's dev-only `window.__replay(seed, actions)`
 * hook (see apps/mobile/src/game/store.ts), which rebuilds the game from the seed and dispatches
 * the whole log — so the SAME seed reproduces the SAME frame in any future run. __replay also
 * freezes the table (bot timer / auto-draw / auto-resolve) so a frame can't advance before it is
 * shot. The mid-drag frames use REAL pointer input (mouse.down → move past the 8 px slop → hold →
 * screenshot → release in dead space, so no game state changes).
 *
 * This file is a Node dev script OUTSIDE src/, and Playwright is a devDependency — neither is
 * imported by the app, so the production bundle is unaffected (proven by build size in the report).
 *
 * Usage:  pnpm capture [--viewport=360x740] [--out=docs/captures] [--port=5173]
 *         The viewport is a parameter (default 360x740) so M5 can reuse the pipeline for store
 *         screenshots at other device sizes.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/mobile/scripts
const REPO = resolve(HERE, '..', '..', '..'); // repo root

// ---------------------------------------------------------------------------
// Args (all optional): --viewport=WxH · --out=<dir> · --port=<n>
// ---------------------------------------------------------------------------
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const [vw, vh] = String(argv.viewport ?? '360x740').split('x').map(Number);
const VIEWPORT = { width: vw, height: vh };
const OUT_DIR = resolve(REPO, String(argv.out ?? 'docs/captures'));
const PORT = Number(argv.port ?? 5173);
const DEV_URL = `http://localhost:${PORT}`;
const AUTOSTART = `${DEV_URL}/#/autostart`; // the direct route: <Table> fills the viewport (no iframe)

// ---------------------------------------------------------------------------
// The fixture (the committed cache of recorded states) + the spec rows each evidences,
// pulled from docs/PLAYTEST_PHASE_B.md Table A so INDEX.md can cite them.
// ---------------------------------------------------------------------------
const fixture = JSON.parse(readFileSync(resolve(REPO, 'tools/fixtures/scenarios.json'), 'utf8'));
const SPEC = {
  S1_nahi_hold: 'D1', S2_nahi_chain: 'D3', S3_pay_from_bank: 'C1/C3', S4_zero_payable: 'C4',
  S5_discard_mode: 'A8/A9', S6_makaan: 'B19', S6_haveli: 'B19', S7_wild_lagaan: 'B14',
  S8_dugna_x2: 'B15', S8_dugna_x4: 'B15', S9_adla_badli: 'B16/B18', S9_kabza: 'B13',
  S10_eleven_cards: 'A2', S11_declare_win: 'A11',
};

// A replay base: {seed, actions}. Fixture states read straight from the cache.
const base = (id) => ({ seed: fixture.states[id].seed, actions: fixture.states[id].actions });

// ---------------------------------------------------------------------------
// The composite frames (the report's flag 5). Each is a fixture base state plus a small,
// documented interaction. `prep` runs after the state lands (before the shot); `post` runs
// after the shot (releases a held drag in dead space so no game state changes).
// ---------------------------------------------------------------------------
const NEUTRAL = { x: Math.round(vw * 0.5), y: Math.round(vh * 0.34) }; // centre felt — over no drop zone

// Recipe for the dual-wildcard canon frame: a seed-search (tools) found this shortest log where
// seat 0 already OWNS both mumbai and newDelhi AND holds the mumbai|newDelhi wildcard in hand — so
// dragging it lights two EXISTING groups with the soft-glow ring (clearer than empty ghost slots),
// while the bank stays dark (no wildcard is bankable — A4 · legal.ts:166). Deterministic per seed.
const WILD_IN_HAND = {
  seed: 185,
  actions: [
    { type: 'DRAW' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_puraniDilli_1', set: 'puraniDilli' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_mumbai_0', set: 'mumbai' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_newDelhi_0', set: 'newDelhi' },
    { type: 'END_TURN' },
    { type: 'DRAW' },
    { type: 'PLACE_PROPERTY', cardId: 'wild_junction_utility_0', set: 'utility' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_junction_2', set: 'junction' },
    { type: 'PLAY_ACTION', cardId: 'action_aageBadho_5', params: { action: 'aageBadho' } },
    { type: 'END_TURN' },
    { type: 'DRAW' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_puraniDilli_0', set: 'puraniDilli' },
    { type: 'PLAY_ACTION', cardId: 'action_haathKiSafai_1', params: { action: 'haathKiSafai', target: 0, cardId: 'prop_puraniDilli_1' } },
    { type: 'RESPOND_ALLOW' },
    { type: 'PLACE_PROPERTY', cardId: 'wild_chennai_bangalore_0', set: 'chennai' },
    { type: 'END_TURN' },
    { type: 'DRAW' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_kolkata_0', set: 'kolkata' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_kashi_1', set: 'kashi' },
    { type: 'PLACE_PROPERTY', cardId: 'prop_jaipur_2', set: 'jaipur' },
    { type: 'END_TURN' },
    { type: 'DRAW' },
    { type: 'PLAY_ACTION', cardId: 'action_aageBadho_6', params: { action: 'aageBadho' } },
  ],
};

/** Press a card/token, drag past the 8 px slop, then hold over `target` (a selector or an {x,y}). */
async function pressDrag(page, cardSel, target) {
  const start = await grab(page, cardSel);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 12, start.y - 12, { steps: 4 }); // > 8 px ⇒ this is a drag, not a tap
  const to = target.sel ? await center(page, target.sel) : target;
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.waitForTimeout(90); // let React paint the eligible/hot glow before the shot
}
/** Release the held drag over dead space (the opponent row carries no drop zone) — springs home. */
async function releaseDead(page) {
  await page.mouse.move(5, 5, { steps: 3 });
  await page.mouse.up();
}
async function center(page, sel) {
  const box = await page.locator(sel).first().boundingBox();
  if (!box) throw new Error(`capture: no element for ${sel}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
// A hand card's CENTRE is covered by the next fan card (they overlap ~60%), which would grab the
// wrong card. The left strip of each card is always exposed (the next card starts further right,
// and this card is drawn on top of the previous one there), so grab a few px in from the left.
async function grab(page, sel) {
  const box = await page.locator(sel).first().boundingBox();
  if (!box) throw new Error(`capture: no element for ${sel}`);
  return { x: box.x + Math.min(12, box.width / 2), y: box.y + box.height / 2 };
}

const COMPOSITES = [
  {
    file: 'REST_my_turn', base: base('S9_kabza'), spec: 'A2 · A10 L2',
    what: 'Rest state on my own turn — hand fan, bank, groups, End-turn column; no overlay.',
  },
  {
    file: 'DRAG_money_bank_hot', base: base('S9_adla_badli'), spec: 'A10 L3/L5 · A4',
    what: 'A money card mid-drag held over the bank — the bank zone glows HOT.',
    prep: (page) => pressDrag(page, '[data-card-id="money_3_1"]', { sel: '[data-drop="bank"]' }),
    post: releaseDead,
  },
  {
    file: 'DRAG_wild_two_groups', base: WILD_IN_HAND, spec: 'A4 · §6.2 canon · L5',
    what: 'A dual wildcard (mumbai|newDelhi) mid-drag held over neutral felt — BOTH its owned set groups glow (soft gold ring), the bank does NOT glow (no wildcard is bankable — canon).',
    prep: (page) => pressDrag(page, '[data-card-id="wild_mumbai_newDelhi_0"]', NEUTRAL),
    post: releaseDead,
  },
  {
    file: 'DRAG_placed_wild_rearrange', base: base('S9_adla_badli'), spec: 'B8',
    what: 'A placed wildcard mid-rearrange — its "◈" token dragged out; the legal destination groups glow.',
    prep: (page) => pressDrag(page, '[data-card-id="wild_jaipur_kolkata_0"]', NEUTRAL),
    post: releaseDead,
  },
  {
    file: 'BOT_turn_dim', base: base('S9_kabza'), spec: 'A2 dimSleep · I1',
    what: 'A bot turn asleep — I end my turn, control passes to a bot, my area dims (off-turn sleep).',
    prep: async (page) => {
      await page.evaluate(() => window.__sauda.getState().dispatch({ type: 'END_TURN' }));
      await page.waitForTimeout(90);
    },
  },
  {
    file: 'MUNSHI_open', base: base('S9_kabza'), spec: 'M4b H-rows · L2',
    what: 'The Munshi advisor open — the read-only "Munshi ki Salah" card over a slept board (one live surface).',
    prep: async (page) => {
      await page.locator('[aria-label^="Munshi advisor"]').click();
      await page.waitForTimeout(90);
    },
  },
];

// Composites the report also names but which ARE fixture states — captured once, mapped in INDEX.
const COMPOSITE_ALIASES = [
  { file: 'S3_pay_from_bank', as: 'the payment sheet pre-filled' },
  { file: 'S5_discard_mode', as: 'discard mode' },
  { file: 'S10_eleven_cards', as: 'the 11-card hand fan' },
];

// ---------------------------------------------------------------------------
// Dev-server lifecycle: reuse a running Vite, else start one and stop it on exit.
// ---------------------------------------------------------------------------
async function reachable(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok || res.status === 404; // any HTTP answer means the server is up
  } catch {
    return false;
  }
}
async function startDevServer() {
  // `pnpm --filter @sauda/mobile dev` → vite on PORT (see vite.config.ts). Windows needs a shell to
  // launch pnpm.cmd; passing the command as ONE string (not an args array) keeps the shell but
  // avoids Node's un-escaped-args deprecation warning. The command is a fixed literal, so safe.
  const proc = spawn('pnpm --filter @sauda/mobile dev', { cwd: REPO, shell: true, stdio: 'ignore' });
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if (await reachable(DEV_URL)) return proc;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('capture: Vite dev server did not become reachable in 40 s');
}
function stopDevServer(proc) {
  if (!proc || proc.pid === undefined) return;
  // Kill the whole tree — on Windows the shell wraps pnpm→vite, which a bare kill would orphan.
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill('SIGTERM');
  }
}

// ---------------------------------------------------------------------------
// Drive one capture: fresh page → land the state → optional prep → shoot → optional release.
// ---------------------------------------------------------------------------
async function shoot(context, item) {
  const page = await context.newPage();
  const warnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text());
  });
  await page.goto(AUTOSTART, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10_000 });
  // Kill any transition/caret so frames are deterministic (belt-and-suspenders; M4c has no motion yet).
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  const summary = await page.evaluate((b) => window.__replay(b.seed, b.actions), item.base);
  await page.waitForTimeout(120); // let React paint the landed state
  if (item.prep) await item.prep(page);
  await page.screenshot({ path: join(OUT_DIR, `${item.file}.png`) });
  if (item.post) await item.post(page);
  await page.close();
  return { ...summary, warnings };
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const haveServer = await reachable(DEV_URL);
  const server = haveServer ? null : await startDevServer();
  if (haveServer) console.log(`capture: reusing dev server at ${DEV_URL}`);
  else console.log(`capture: started dev server at ${DEV_URL}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: 'reduce' });

  const results = [];
  try {
    // 1) every found fixture state
    for (const [id, entry] of Object.entries(fixture.states)) {
      if (!entry.found) {
        results.push({ file: id, kind: 'state', ok: false, note: 'NOT FOUND in fixture' });
        continue;
      }
      const r = await shoot(context, { file: id, base: base(id) });
      results.push({ file: id, kind: 'state', spec: SPEC[id] ?? '', note: entry.note, ...r });
      console.log(`  ${id.padEnd(22)} ${r.ok ? 'ok' : `PARTIAL ${r.applied}/${r.total}`}  ${r.phase}/actor${r.actor}`);
    }
    // 2) the composites
    for (const item of COMPOSITES) {
      const r = await shoot(context, item);
      results.push({ file: item.file, kind: 'composite', spec: item.spec, note: item.what, ...r });
      console.log(`  ${item.file.padEnd(22)} ${r.ok ? 'ok' : `PARTIAL ${r.applied}/${r.total}`}`);
    }
  } finally {
    await browser.close();
    stopDevServer(server);
  }

  writeIndex(results);
  const bad = results.filter((r) => r.ok === false);
  console.log(`\ncapture: wrote ${results.length} frames to ${OUT_DIR}` + (bad.length ? `  (${bad.length} NOT CAPTURED)` : ''));
}

// ---------------------------------------------------------------------------
// INDEX.md — every image, the state it shows, its replay id, the spec rows it evidences.
// ---------------------------------------------------------------------------
function writeIndex(results) {
  const lines = [];
  lines.push('# Phase-B capture pack — INDEX', '');
  lines.push(`Generated by \`pnpm capture\` (viewport ${vw}×${vh}, deviceScaleFactor 2, reduced-motion).`);
  lines.push('Each frame is the REAL play UI, driven to its state by replaying the committed fixture');
  lines.push('log through the dev `window.__replay(seed, actions)` hook — deterministic and rerunnable.');
  lines.push('');
  lines.push('The mid-drag frames (`DRAG_*`) use REAL pointer input — mouse down on the card, move past');
  lines.push('the 8 px tap slop, hold over the target so the glow paints, shoot, then release in dead');
  lines.push('space (the opponent row carries no drop zone) so the game state is unchanged. The C4');
  lines.push('"nothing to pay" beat (`S4`) and the NAHI-chain resolution beat (`S2`) are held by the');
  lines.push('dev capture-freeze (`__replay` pauses the bot timer / auto-draw / auto-resolve) so the');
  lines.push('transient beat can be shot without advancing the game.', '');

  lines.push('## Recorded fixture states', '');
  lines.push('| Image | State it shows | Replay id (seed) | Spec rows |');
  lines.push('|-------|----------------|------------------|-----------|');
  for (const r of results.filter((x) => x.kind === 'state')) {
    const seed = fixture.states[r.file]?.seed;
    lines.push(`| \`${r.file}.png\` | ${r.note ?? ''} | \`${r.file}\` (seed ${seed}) | ${r.spec ?? ''} |`);
  }

  lines.push('', '## Composite frames (report flag 5 — the mid-drag / advisor / dim states)', '');
  lines.push('| Image | Frame it shows | Replay base | Spec rows |');
  lines.push('|-------|----------------|-------------|-----------|');
  for (const r of results.filter((x) => x.kind === 'composite')) {
    const item = COMPOSITES.find((c) => c.file === r.file);
    const b = item.base;
    let baseLabel;
    if (fixtureIdOf(b)) baseLabel = `\`${fixtureIdOf(b)}\``;
    else if (b.actions.length <= 3) baseLabel = `seed ${b.seed} · [${b.actions.map((a) => a.type).join(', ')}]`;
    else baseLabel = `seed ${b.seed} · ${b.actions.length}-step recipe`;
    lines.push(`| \`${r.file}.png\` | ${item.what} | ${baseLabel} | ${r.spec} |`);
  }

  lines.push('', '### Composite requirements also satisfied by a fixture image', '');
  for (const alias of COMPOSITE_ALIASES) {
    lines.push(`- **${alias.as}** → \`${alias.file}.png\` (same state; no separate frame needed).`);
  }

  const notCaptured = results.filter((r) => r.ok === false);
  lines.push('', '## NOT CAPTURED', '');
  if (notCaptured.length === 0) {
    lines.push('None — every state and composite rendered and was shot cleanly.');
  } else {
    for (const r of notCaptured) lines.push(`- \`${r.file}\` — ${r.note}`);
  }

  const anyWarn = results.flatMap((r) => r.warnings ?? []);
  lines.push('', '## Scroll-guard / console', '');
  if (anyWarn.length === 0) {
    lines.push('No console warnings during capture — in particular the `#/autostart` scroll guard stayed');
    lines.push('silent, so no state scrolled the play surface (A2).');
  } else {
    lines.push('Console warnings seen during capture:');
    for (const w of [...new Set(anyWarn)]) lines.push(`- ${w}`);
  }

  lines.push('', '---', '', '_Rerun:_ `pnpm capture` (from the repo root). Viewport is a parameter:');
  lines.push('`pnpm capture --viewport=1080x1920` for M5 store screenshots.', '');
  writeFileSync(join(OUT_DIR, 'INDEX.md'), lines.join('\n'));
}

// If a composite base matches a fixture entry (same seed + action log), name it by that id.
function fixtureIdOf(b) {
  for (const [id, entry] of Object.entries(fixture.states)) {
    if (entry.found && entry.seed === b.seed && JSON.stringify(entry.actions) === JSON.stringify(b.actions)) {
      return id;
    }
  }
  return null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
