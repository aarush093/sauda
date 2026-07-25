/**
 * `pnpm simulate --games 1000` — the bot-strength + invariant harness (§8.3).
 *
 * Runs HeuristicBot(Medium) head-to-head against RandomBot over N seeded games and
 * checks the M2 gate:
 *   - ZERO invariant violations across ALL games (not just "games finish")
 *   - HeuristicBot(Medium) beats RandomBot ≥ 90%
 *   - average game length ≤ 25 turns
 * Exits non-zero if any target is missed, so CI can enforce it.
 */
import { HeuristicBot, RandomBot } from '@sauda/bots';
import type { Difficulty } from '@sauda/bots';
import { playGame } from './driver';

interface Options {
  games: number;
  seed: number;
  difficulty: Difficulty;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { games: 1000, seed: 1, difficulty: 'medium' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--games') {
      options.games = Number(argv[++i]);
    } else if (arg === '--seed') {
      options.seed = Number(argv[++i]);
    } else if (arg === '--difficulty') {
      options.difficulty = argv[++i] as Difficulty;
    }
  }
  return options;
}

function main(): void {
  const { games, seed, difficulty } = parseArgs(process.argv.slice(2));

  // Seat 0 = HeuristicBot (the bot under test), seat 1 = RandomBot.
  const bots = [new HeuristicBot(difficulty), new RandomBot()];

  let heuristicWins = 0;
  let randomWins = 0;
  let unfinished = 0;
  let totalTurnsFinished = 0;
  let totalViolations = 0;
  let gamesWithViolations = 0;
  let longestGame = 0;

  for (let i = 0; i < games; i++) {
    const summary = playGame(bots, seed + i);
    if (summary.violations.length > 0) {
      totalViolations += summary.violations.length;
      gamesWithViolations += 1;
      if (gamesWithViolations <= 3) {
        console.error(`  ! seed ${seed + i}: ${summary.violations[0]}`);
      }
    }
    if (!summary.finished) {
      unfinished += 1;
      continue;
    }
    totalTurnsFinished += summary.turns;
    longestGame = Math.max(longestGame, summary.turns);
    if (summary.winner === 0) {
      heuristicWins += 1;
    } else if (summary.winner === 1) {
      randomWins += 1;
    }
  }

  const finished = games - unfinished;
  const winRate = finished > 0 ? heuristicWins / games : 0;
  const avgTurns = finished > 0 ? totalTurnsFinished / finished : 0;

  const targets = {
    zeroViolations: totalViolations === 0,
    winRate: winRate >= 0.9,
    avgTurns: avgTurns <= 25,
    allFinished: unfinished === 0,
  };
  const pass = Object.values(targets).every(Boolean);

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  console.log('');
  console.log(`SAUDA simulator — ${games} games, HeuristicBot(${difficulty}) vs RandomBot`);
  console.log('-------------------------------------------------------------');
  console.log(`  HeuristicBot wins : ${heuristicWins}  (${pct(winRate)})   target ≥ 90%   ${targets.winRate ? 'PASS' : 'FAIL'}`);
  console.log(`  RandomBot wins    : ${randomWins}  (${pct(finished > 0 ? randomWins / games : 0)})`);
  console.log(`  Unfinished        : ${unfinished}                        target 0       ${targets.allFinished ? 'PASS' : 'FAIL'}`);
  console.log(`  Avg game length   : ${avgTurns.toFixed(2)} turns   (longest ${longestGame})   target ≤ 25   ${targets.avgTurns ? 'PASS' : 'FAIL'}`);
  console.log(`  Invariant issues  : ${totalViolations}  (in ${gamesWithViolations} games)   target 0       ${targets.zeroViolations ? 'PASS' : 'FAIL'}`);
  console.log('-------------------------------------------------------------');
  console.log(`  RESULT: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('');

  process.exit(pass ? 0 : 1);
}

main();
