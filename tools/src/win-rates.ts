/**
 * `pnpm --filter @sauda/tools winrates [--games N] [--seed S]` — S6c (owner playtest, 13 Aug).
 *
 * The fairness measurement harness. It answers the owner's complaint ("the bots win every game at
 * every difficulty") with numbers: for bot counts 1, 2 and 3, and for each difficulty tier, it plays
 * N seeded games and reports the win rate of seat 0 — the "player" — under two proxies:
 *
 *   • strong proxy   = HeuristicBot('hard')  — a competent human (the ceiling a good player plays at)
 *   • beginner proxy = RandomBot             — a flailing first-timer (the floor)
 *
 * Seats 1..k are the opponents at the chosen tier. Two worlds are compared:
 *   • BEFORE = opponents are HeuristicBot(tier)  (the old world: medium ≡ hard, no real difference)
 *   • AFTER  = opponents are DifficultyBot(tier) (the S6b wrapper: genuinely weaker lower tiers)
 *
 * Target AFTER bands for the strong proxy at the 3-bot table (S6c): easy ~60-75%, medium ~40-50%,
 * hard ~25-30% (near the ~25% fair share). Tune SLIP_PROBABILITY in @sauda/difficulty until they land.
 * This is a report tool (no pass/fail gate) — determinism is preserved because every game is seeded.
 */
import { HeuristicBot, RandomBot } from '@sauda/bots';
import type { Bot, Difficulty } from '@sauda/bots';
import { DifficultyBot } from '@sauda/difficulty';
import { playGame } from './driver';

interface Options {
  games: number;
  seed: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { games: 1000, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--games') {
      options.games = Number(argv[++i]);
    } else if (argv[i] === '--seed') {
      options.seed = Number(argv[++i]);
    }
  }
  return options;
}

type World = 'before' | 'after';
type Proxy = 'strong' | 'beginner';

const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];
const BOT_COUNTS = [1, 2, 3];

// Seat 0 is the player proxy; seats 1..botCount are the opponents at `tier` in the chosen world.
function buildTable(world: World, proxy: Proxy, tier: Difficulty, botCount: number): Bot[] {
  const player: Bot = proxy === 'strong' ? new HeuristicBot('hard') : new RandomBot();
  const opponent = (): Bot => (world === 'before' ? new HeuristicBot(tier) : new DifficultyBot(tier));
  const bots: Bot[] = [player];
  for (let i = 0; i < botCount; i++) {
    bots.push(opponent());
  }
  return bots;
}

// Seat-0 win rate over `games` seeded games. Unfinished games (should be none) count as non-wins.
function winRate(world: World, proxy: Proxy, tier: Difficulty, botCount: number, opts: Options): number {
  let wins = 0;
  for (let i = 0; i < opts.games; i++) {
    const summary = playGame(buildTable(world, proxy, tier, botCount), opts.seed + i);
    if (summary.finished && summary.winner === 0) {
      wins += 1;
    }
  }
  return wins / opts.games;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`.padStart(6);
}

// The fair share of a `botCount`-opponent table: 1 / (players) = 1 / (botCount + 1).
function fairShare(botCount: number): string {
  return pct(1 / (botCount + 1));
}

function report(world: World, opts: Options): void {
  console.log('');
  console.log(`=== ${world.toUpperCase()} — seat-0 win rate over ${opts.games} seeded games/config ===`);
  console.log('proxy     tier     1 bot   2 bots  3 bots   (fair share: 50.0% / 33.3% / 25.0%)');
  console.log('-------------------------------------------------------------------------------');
  for (const proxy of ['strong', 'beginner'] as Proxy[]) {
    for (const tier of TIERS) {
      const cells = BOT_COUNTS.map((k) => pct(winRate(world, proxy, tier, k, opts))).join('  ');
      console.log(`${proxy.padEnd(9)} ${tier.padEnd(7)} ${cells}`);
    }
  }
  console.log('-------------------------------------------------------------------------------');
  console.log(`fair share (1 opp / 2 / 3):  ${fairShare(1)}  ${fairShare(2)}  ${fairShare(3)}`);
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`SAUDA fairness harness (S6c) — ${opts.games} games/config, base seed ${opts.seed}`);
  report('before', opts);
  report('after', opts);
  console.log('');
}

main();
