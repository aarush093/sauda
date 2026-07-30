/**
 * H5 (excellence pass) — bot-pacing measurement. Runs a seeded 4-seat game (seat 0 = the human,
 * seats 1-3 = medium bots, exactly the capture table) deterministically and counts the BEATS each
 * bot turn takes. From those real beat counts it computes the human's inter-turn wait — the time
 * from ending my turn to my next auto-draw, i.e. the summed presentation delay of the bot turns in
 * between — under the OLD flat 700ms/beat pacing and the NEW paced table. Beat COUNTS are pacing-
 * independent (pure engine), so the before/after is apples-to-apples. Run: `pnpm --filter @sauda/tools exec tsx src/measure-pacing.ts`.
 */
import { createGame, legalActions, mulberry32, observe, reduce } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { HeuristicBot } from '@sauda/bots';

// Mirror apps/mobile/src/game/interaction.ts BOT_PACING + botBeatDelayMs (tools can't import mobile).
const BOT_PACING = { firstBeatMs: 700, beatMs: 450, floorMs: 350, turnCapMs: 3000 };
function botBeatDelayMs(beatIndex: number, elapsedMs: number): number {
  if (beatIndex === 0) return BOT_PACING.firstBeatMs;
  const remaining = BOT_PACING.turnCapMs - elapsedMs;
  return Math.max(BOT_PACING.floorMs, Math.min(BOT_PACING.beatMs, remaining));
}
const OLD_FLAT_MS = 700; // the pacing this pass replaces

const HUMAN_SEAT = 0;
const GAMES = Number(process.argv[2] ?? 60); // aggregate many seeded games for a robust p95
const MAX_BEATS = 4000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
}

// Run ONE seeded game and return the human's inter-turn waits under old + new pacing.
function runGame(seed: number): { waitsOld: number[]; waitsNew: number[]; gapBeats: number[] } {
  const bot = new HeuristicBot('medium');
  const rng = mulberry32(seed);
  let { state } = createGame({ players: 4, seed });

  // Walk the whole game, recording one beat per applied action tagged with its actor.
  const beats: { actor: number }[] = [];
  for (let i = 0; i < MAX_BEATS && state.phase !== 'gameOver'; i++) {
    const actor = state.pendingInterrupts.length > 0 ? state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder : state.currentPlayerIndex;
    const legal = legalActions(state, actor);
    if (legal.length === 0) break;
    const action: Action = bot.chooseAction(observe(state, actor), legal, rng);
    const result = reduce(state, action);
    if (!result.ok) break;
    beats.push({ actor });
    state = result.value.state;
  }

  // Assign each beat its delay under NEW pacing (paced per actor-run, resetting on actor change) and
  // OLD pacing (flat). Human beats are instant (user-driven / auto-draw) — they add no wait.
  let runActor = -1;
  let runIndex = 0;
  let runElapsed = 0;
  const delaysNew: number[] = [];
  const delaysOld: number[] = [];
  for (const beat of beats) {
    const isBot = beat.actor !== HUMAN_SEAT;
    if (beat.actor !== runActor) {
      runActor = beat.actor;
      runIndex = 0;
      runElapsed = 0;
    }
    const dNew = isBot ? botBeatDelayMs(runIndex, runElapsed) : 0;
    delaysNew.push(dNew);
    delaysOld.push(isBot ? OLD_FLAT_MS : 0);
    runIndex += 1;
    runElapsed += dNew;
  }

  // The human's inter-turn waits = the summed delay of each maximal run of consecutive BOT beats
  // between two of my turns.
  const waitsOld: number[] = [];
  const waitsNew: number[] = [];
  const gapBeatCounts: number[] = [];
  let curOld = 0;
  let curNew = 0;
  let curBeats = 0;
  let inGap = false;
  for (let i = 0; i < beats.length; i++) {
    const isBot = beats[i]!.actor !== HUMAN_SEAT;
    if (isBot) {
      inGap = true;
      curOld += delaysOld[i]!;
      curNew += delaysNew[i]!;
      curBeats += 1;
    } else if (inGap) {
      waitsOld.push(curOld);
      waitsNew.push(curNew);
      gapBeatCounts.push(curBeats);
      curOld = 0;
      curNew = 0;
      curBeats = 0;
      inGap = false;
    }
  }
  return { waitsOld, waitsNew, gapBeats: gapBeatCounts };
}

function main() {
  const waitsOld: number[] = [];
  const waitsNew: number[] = [];
  const gapBeats: number[] = [];
  for (let seed = 1; seed <= GAMES; seed++) {
    const g = runGame(seed);
    waitsOld.push(...g.waitsOld);
    waitsNew.push(...g.waitsNew);
    gapBeats.push(...g.gapBeats);
  }

  const sortedOld = [...waitsOld].sort((a, b) => a - b);
  const sortedNew = [...waitsNew].sort((a, b) => a - b);
  const fmt = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

  console.log(`H5 bot-pacing measurement — ${GAMES} seeded games, 4 seats (1 human + 3 medium bots)`);
  console.log(`human inter-turn gaps sampled ${waitsOld.length}, mean bot beats/gap ${(gapBeats.reduce((a, b) => a + b, 0) / gapBeats.length).toFixed(1)}`);
  console.log('');
  console.log('| metric | OLD (flat 700ms) | NEW (paced 700/450/350, ~3s cap) |');
  console.log('|--------|------------------|----------------------------------|');
  console.log(`| median inter-turn wait | ${fmt(median(waitsOld))} | ${fmt(median(waitsNew))} |`);
  console.log(`| p95 inter-turn wait | ${fmt(percentile(sortedOld, 95))} | ${fmt(percentile(sortedNew, 95))} |`);
  console.log(`| max inter-turn wait | ${fmt(Math.max(...waitsOld))} | ${fmt(Math.max(...waitsNew))} |`);
  console.log(`| min inter-turn wait | ${fmt(Math.min(...waitsOld))} | ${fmt(Math.min(...waitsNew))} |`);
}

main();
