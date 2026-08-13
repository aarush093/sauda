// @ts-check
/** pnpm --filter @sauda/mobile verify:difficulty — T1: prove the difficulty tier reaches a REAL
 * running game. Drives three games at the SAME seed (easy/medium/hard) through the live store, and
 * shows the bots' action logs diverge between tiers. Also shoots ?hud=1 stills of each tier. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', '..', 'docs/captures/hand-info-1'); mkdirSync(OUT, { recursive: true });
const SEED = 777;
const TIERS = ['easy', 'medium', 'hard'];

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2 })).newPage();
await page.goto('http://localhost:5174/#/autostart', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__replay === 'function', null, { timeout: 10000 });

const logs = {};
for (const tier of TIERS) {
  logs[tier] = await page.evaluate(({ tier, seed }) => {
    const g = () => window.__sauda.getState();
    window.__saudaCapturePaused = true;
    g().newGame({ seats: [{ kind: 'human' }, { kind: 'bot', difficulty: tier }, { kind: 'bot', difficulty: tier }, { kind: 'bot', difficulty: tier }], seed });
    for (let i = 0; i < 300; i++) {
      const st = g().state;
      if (st.phase === 'gameOver') break;
      const actor = st.pendingInterrupts.length ? st.pendingInterrupts.at(-1).responder : st.currentPlayerIndex;
      if (actor === 0) {
        if (st.phase === 'awaitingDraw') g().dispatch({ type: 'DRAW' });
        else if (st.phase === 'awaitingDiscard') break; // can't discard without the legal list — stop
        else g().dispatch({ type: 'END_TURN' });
      } else {
        g().stepBot();
      }
    }
    // the BOT action feed only (drop my own P0 lines and the turn markers)
    return g().log.map((l) => l.text).filter((t) => /^P[123] /.test(t));
  }, { tier, seed: SEED });
}

// First index where a tier's bot-action feed diverges from HARD (the deterministic baseline).
function firstDivergence(a, base) {
  const n = Math.min(a.length, base.length);
  for (let i = 0; i < n; i++) if (a[i] !== base[i]) return { index: i, tier: a[i], hard: base[i] };
  return a.length === base.length ? null : { index: n, tier: a[n] ?? '(end)', hard: base[n] ?? '(end)' };
}
const dEasy = firstDivergence(logs.easy, logs.hard);
const dMedium = firstDivergence(logs.medium, logs.hard);
const report = {
  seed: SEED,
  botLineCounts: { easy: logs.easy.length, medium: logs.medium.length, hard: logs.hard.length },
  easyDivergesFromHard: dEasy,
  mediumDivergesFromHard: dMedium,
  easyEqualsMedium: JSON.stringify(logs.easy) === JSON.stringify(logs.medium),
  sample: { hard: logs.hard.slice(0, 6), medium: logs.medium.slice(0, 6), easy: logs.easy.slice(0, 6) },
};
writeFileSync(join(OUT, 'verify-difficulty.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

// HUD stills: prove ?difficulty= reaches the live table (the HUD "bots: 3 · <tier>" line).
for (const tier of TIERS) {
  await page.goto(`http://localhost:5174/?hud=1&seed=${SEED}&difficulty=${tier}&bots=3#/autostart`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `t1_hud_${tier}_915x412.png`) });
  console.log('  ✓ hud still', tier);
}
await b.close();
console.log(dEasy && dMedium ? '\nDIVERGENCE CONFIRMED: both easy and medium diverge from hard.' : '\nWARNING: a tier did NOT diverge!');
