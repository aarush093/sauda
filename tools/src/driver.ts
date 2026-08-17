/**
 * The game loop shared by the simulator and the tests. It wires the engine to a
 * list of bots: figure out whose move it is (the interrupt responder if a window
 * is open, else the current player), ask that bot to choose from legalActions,
 * apply it with reduce, and check invariants after every single step.
 *
 * Invariant violations are collected, not thrown, so the simulator can report the
 * exact count across a whole batch of games (the M2 gate requires ZERO).
 */
import {
  checkInvariants,
  createGame,
  legalActions,
  mulberry32,
  observe,
  reduce,
} from '@sauda/engine';
import type { GameEvent, GameState, Rules } from '@sauda/engine';
import { assistOpeningHand } from '@sauda/difficulty';
import type { Bot } from '@sauda/bots';

export interface GameSummary {
  winner: number | null;
  turns: number;
  steps: number;
  finished: boolean;
  violations: string[];
}

export interface PlayGameOptions {
  maxTurns?: number;
  rules?: Rules;
  onEvent?: (event: GameEvent, state: GameState) => void;
  // U4: apply the EASY opening-hand assist to this seat right after the deal (the fairness harness uses
  // it to measure the easy band for the human proxy; the live store applies the same on an easy table).
  assistSeat?: number;
}

// Whose move is it right now?
function actorOf(state: GameState): number {
  if (state.pendingInterrupts.length > 0) {
    return state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder;
  }
  return state.currentPlayerIndex;
}

export function playGame(bots: Bot[], seed: number, options: PlayGameOptions = {}): GameSummary {
  const maxTurns = options.maxTurns ?? 500;
  const created = createGame({ players: bots.length, seed, ...(options.rules ? { rules: options.rules } : {}) });
  let state = created.state;
  if (options.assistSeat !== undefined) {
    state = assistOpeningHand(state, options.assistSeat); // U4: easy opening-hand leg-up for the human
  }

  // A dedicated RNG for the bots, derived from the game seed so runs are reproducible
  // but independent of the deck shuffle stream inside the engine.
  const rng = mulberry32((seed >>> 0) ^ 0x51ed2701);
  const violations: string[] = [];
  let steps = 0;

  while (state.phase !== 'gameOver' && state.turnCount <= maxTurns && steps < 50_000) {
    const actor = actorOf(state);
    const legal = legalActions(state, actor);
    if (legal.length === 0) {
      violations.push(`turn ${state.turnCount}: no legal action for player ${actor}`);
      break;
    }
    const action = bots[actor]!.chooseAction(observe(state, actor), legal, rng);
    const result = reduce(state, action);
    if (!result.ok) {
      violations.push(`turn ${state.turnCount}: reduce rejected ${action.type} (${result.error.code})`);
      break;
    }
    state = result.value.state;
    if (options.onEvent) {
      for (const event of result.value.events) {
        options.onEvent(event, state);
      }
    }

    const invariants = checkInvariants(state);
    if (!invariants.ok) {
      for (const violation of invariants.violations) {
        violations.push(`turn ${state.turnCount}: ${violation}`);
      }
    }
    steps += 1;
  }

  return {
    winner: state.winnerIndex,
    turns: state.turnCount,
    steps,
    finished: state.phase === 'gameOver',
    violations,
  };
}
