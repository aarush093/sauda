/**
 * `pnpm --filter @sauda/tools tiers [--games N]` — U4 QUALITATIVE check (owner's "reads as naive, not
 * broken" rule). Numbers alone can be right while the behaviour looks silly, so this fingerprints WHAT
 * each tier actually does: it plays N games of a competent proxy (HeuristicBot 'hard') vs ONE bot at
 * the tier, wrapping that bot so every move it chooses is tallied. It then prints, per tier, the average
 * per game of each move class — banks, property placements, free rearranges, attacks, and declares — so
 * you can SEE the character: easy banks + builds but rarely attacks or rearranges and dawdles on the
 * win; hard does everything sharply. A bot that "banks properties / plays nonsense" would show up here.
 */
import { HeuristicBot } from '@sauda/bots';
import type { Bot, Difficulty } from '@sauda/bots';
import { DifficultyBot } from '@sauda/difficulty';
import type { Action, Observation, Rng } from '@sauda/engine';
import { playGame } from './driver';

interface Options {
  games: number;
  seed: number;
}
function parseArgs(argv: string[]): Options {
  const options: Options = { games: 300, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--games') options.games = Number(argv[++i]);
    else if (argv[i] === '--seed') options.seed = Number(argv[++i]);
  }
  return options;
}

const ATTACK_PLAY_ACTIONS = new Set(['kabza', 'haathKiSafai', 'vasooli', 'shagun', 'adlaBadli']);
function isAttack(action: Action): boolean {
  if (action.type === 'PLAY_KIRAYA') return true;
  if (action.type === 'PLAY_ACTION') return ATTACK_PLAY_ACTIONS.has(action.params.action);
  return false;
}

interface Tally {
  moves: number;
  bank: number;
  place: number;
  rearrange: number;
  attack: number;
  build: number; // makaan / haveli
  declare: number;
  wins: number;
}

// A recording bot: delegates every choice to the wrapped DifficultyBot and tallies what it played.
class RecordingBot implements Bot {
  readonly name: string;
  constructor(private readonly inner: DifficultyBot, private readonly tally: Tally) {
    this.name = inner.name;
  }
  chooseAction(observation: Observation, legalActions: Action[], rng: Rng): Action {
    const action = this.inner.chooseAction(observation, legalActions, rng);
    this.tally.moves += 1;
    if (action.type === 'BANK_CARD') this.tally.bank += 1;
    else if (action.type === 'PLACE_PROPERTY') this.tally.place += 1;
    else if (action.type === 'REARRANGE_WILDCARD') this.tally.rearrange += 1;
    else if (action.type === 'DECLARE_WIN') this.tally.declare += 1;
    else if (action.type === 'PLAY_ACTION' && (action.params.action === 'makaan' || action.params.action === 'haveli')) this.tally.build += 1;
    if (isAttack(action)) this.tally.attack += 1;
    return action;
  }
}

function run(tier: Difficulty, opts: Options): Tally {
  const tally: Tally = { moves: 0, bank: 0, place: 0, rearrange: 0, attack: 0, build: 0, declare: 0, wins: 0 };
  for (let i = 0; i < opts.games; i++) {
    const bots: Bot[] = [new HeuristicBot('hard'), new RecordingBot(new DifficultyBot(tier), tally)];
    const summary = playGame(bots, opts.seed + i);
    if (summary.winner === 1) tally.wins += 1;
  }
  return tally;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`SAUDA tier fingerprint (U4) — ${opts.games} games/tier, the tier bot vs a competent proxy\n`);
  console.log('per game the tier bot played, on average:');
  console.log('tier     banks  places  rearr  attacks  builds  declares   bot-win%');
  console.log('----------------------------------------------------------------------');
  for (const tier of ['easy', 'medium', 'hard'] as Difficulty[]) {
    const t = run(tier, opts);
    const per = (n: number) => (n / opts.games).toFixed(2).padStart(6);
    const pct = ((t.wins / opts.games) * 100).toFixed(1).padStart(6);
    console.log(`${tier.padEnd(8)} ${per(t.bank)} ${per(t.place)} ${per(t.rearrange)} ${per(t.attack)}  ${per(t.build)}  ${per(t.declare)}   ${pct}%`);
  }
  console.log('');
}

main();
