/**
 * `pnpm play` — a terminal game of SAUDA: one human (seat 0) versus three bots.
 * Pass `--auto` to let a bot play seat 0 too and print a full transcript (used to
 * demo a complete game). `--seed N` fixes the deal.
 *
 * Every choice the human makes comes straight from `legalActions`, so the CLI can
 * only ever offer legal moves — the same guarantee the mobile UI will rely on (M3).
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  GAME,
  createGame,
  legalActions,
  mulberry32,
  observe,
  reduce,
} from '@sauda/engine';
import type { Action, GameState } from '@sauda/engine';
import { HeuristicBot, RandomBot } from '@sauda/bots';
import type { Bot } from '@sauda/bots';
import { describeAction, describeCard, describeEvent, renderBoard } from './render';

interface Options {
  auto: boolean;
  seed: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { auto: false, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--auto') {
      options.auto = true;
    } else if (argv[i] === '--seed') {
      options.seed = Number(argv[++i]);
    }
  }
  return options;
}

function actorOf(state: GameState): number {
  if (state.pendingInterrupts.length > 0) {
    return state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder;
  }
  return state.currentPlayerIndex;
}

async function main(): Promise<void> {
  const { auto, seed } = parseArgs(process.argv.slice(2));
  const HUMAN = 0;

  // Seat 0 is the human unless --auto; the other three seats are bots of mixed skill.
  const bots: Bot[] = [
    new HeuristicBot('medium'), // stands in for the human in --auto mode
    new HeuristicBot('hard'),
    new HeuristicBot('medium'),
    new RandomBot(),
  ];

  const created = createGame({ players: 4, seed });
  let state = created.state;
  const rng = mulberry32((seed >>> 0) ^ 0x51ed2701);

  const rl = auto ? null : createInterface({ input: stdin, output: stdout });
  console.log(`\n=== ${GAME.name} — ${GAME.tagline} ===`);
  console.log(auto ? '(auto-demo: all seats played by bots)\n' : '(you are Player 0)\n');

  let guard = 0;
  while (state.phase !== 'gameOver' && state.turnCount <= 500 && guard < 20_000) {
    guard += 1;
    const actor = actorOf(state);
    const legal = legalActions(state, actor);
    if (legal.length === 0) {
      break;
    }

    let action: Action;
    if (!auto && actor === HUMAN) {
      action = await askHuman(rl!, state, legal);
    } else {
      action = bots[actor]!.chooseAction(observe(state, actor), legal, rng);
    }

    const result = reduce(state, action);
    if (!result.ok) {
      console.log(`  (illegal: ${result.error.message})`);
      continue;
    }
    state = result.value.state;
    for (const event of result.value.events) {
      const line = describeEvent(event);
      if (line) {
        console.log(line);
      }
    }
  }

  console.log('');
  if (state.winnerIndex !== null) {
    console.log(`Winner: Player ${state.winnerIndex}${state.winnerIndex === HUMAN && !auto ? ' — that’s you! 🎉' : ''}`);
  } else {
    console.log('Game ended without a winner (turn cap).');
  }
  console.log(`Total turns: ${state.turnCount}`);
  rl?.close();
}

async function askHuman(
  rl: ReturnType<typeof createInterface>,
  state: GameState,
  legal: Action[],
): Promise<Action> {
  const observation = observe(state, 0);
  console.log(`\n${renderBoard(observation)}`);
  console.log(`Your hand: ${observation.myHand.map(describeCard).join(' | ') || '(empty)'}`);
  console.log('Choose:');
  legal.forEach((action, index) => {
    console.log(`  [${index}] ${describeAction(action)}`);
  });

  for (;;) {
    const answer = (await rl.question('> ')).trim();
    const choice = Number(answer);
    if (Number.isInteger(choice) && choice >= 0 && choice < legal.length) {
      return legal[choice]!;
    }
    console.log(`  Enter a number 0–${legal.length - 1}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
