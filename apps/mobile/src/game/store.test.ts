/**
 * Drives full games through the actual store (engine + bots + hand-off logic) to a
 * winner, asserting no console errors along the way — this is the M3 gate proof:
 * a complete game start→win with zero console errors, without any browser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { legalActions, mulberry32, observe } from '@sauda/engine';
import { HeuristicBot, recommend } from '@sauda/bots';
import { actorOf, useGame } from './store';
import type { SeatConfig } from './store';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useGame.getState().reset();
});
afterEach(() => {
  errorSpy.mockRestore();
});

// Plays a game to completion, using a HeuristicBot to choose for human seats too
// (so we exercise dispatch + hand-off + reduce end to end).
function playToWin(seats: SeatConfig[], seed: number): { winner: number | null; sawHandoff: boolean } {
  const store = useGame.getState();
  store.newGame({ seats, seed });
  const policy = new HeuristicBot('medium');
  const rng = mulberry32(seed);
  let sawHandoff = false;

  for (let guard = 0; guard < 20_000; guard++) {
    const current = useGame.getState();
    const state = current.state!;
    if (state.phase === 'gameOver') {
      break;
    }
    if (current.handoffSeat !== null) {
      sawHandoff = true;
      current.ackHandoff();
      continue;
    }
    const actor = actorOf(state);
    if (current.seats[actor]!.kind === 'bot') {
      current.stepBot();
    } else {
      const legal = legalActions(state, actor);
      current.dispatch(policy.chooseAction(observe(state, actor), legal, rng));
    }
  }
  return { winner: useGame.getState().state!.winnerIndex, sawHandoff };
}

describe('game store — full game via engine', () => {
  it('solo (1 human vs 3 bots) plays to a winner with no console errors', () => {
    const seats: SeatConfig[] = [
      { kind: 'human' },
      { kind: 'bot', difficulty: 'medium' },
      { kind: 'bot', difficulty: 'easy' },
      { kind: 'bot', difficulty: 'hard' },
    ];
    const { winner } = playToWin(seats, 12345);
    expect(winner).not.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('pass-and-play (3 humans) plays to a winner and shows a hand-off', () => {
    const seats: SeatConfig[] = [{ kind: 'human' }, { kind: 'human' }, { kind: 'human' }];
    const { winner, sawHandoff } = playToWin(seats, 999);
    expect(winner).not.toBeNull();
    expect(sawHandoff).toBe(true); // the privacy overlay was triggered between players
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('game store — Munshi advisor (read-only · 3 uses · no carry-over)', () => {
  // Seat 0 (human) always opens the game (§setup currentPlayerIndex: 0); one DRAW moves it
  // from awaitingDraw into the 'playing' phase — exactly when the chip offers advice.
  function humanOnPlayTurn(seed: number): void {
    useGame.getState().newGame({ seats: [{ kind: 'human' }, { kind: 'bot', difficulty: 'medium' }], seed });
    useGame.getState().dispatch({ type: 'DRAW' });
  }

  it('spends exactly 3 consults per game, then renders spent (never negative)', () => {
    humanOnPlayTurn(7);
    expect(useGame.getState().state!.phase).toBe('playing');
    expect(useGame.getState().munshiUsesRemaining).toBe(3);

    expect(useGame.getState().consultMunshi()).not.toBeNull();
    expect(useGame.getState().munshiUsesRemaining).toBe(2);
    expect(useGame.getState().consultMunshi()).not.toBeNull();
    expect(useGame.getState().consultMunshi()).not.toBeNull();
    expect(useGame.getState().munshiUsesRemaining).toBe(0);

    // Budget spent: no further advice, and the count never drifts below zero.
    expect(useGame.getState().consultMunshi()).toBeNull();
    expect(useGame.getState().munshiUsesRemaining).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does not carry over across games — a new game restores all 3 uses', () => {
    humanOnPlayTurn(7);
    useGame.getState().consultMunshi();
    useGame.getState().consultMunshi();
    expect(useGame.getState().munshiUsesRemaining).toBe(1);

    humanOnPlayTurn(8); // a fresh game
    expect(useGame.getState().munshiUsesRemaining).toBe(3);
  });

  it('opening the advisor dispatches NO engine action (read-only)', () => {
    humanOnPlayTurn(7);
    const before = useGame.getState().state!; // the exact engine state object before consulting
    const advice = useGame.getState().consultMunshi();

    expect(advice).not.toBeNull();
    // reduce is never called, so the engine state object is untouched (same reference) —
    // the player must still perform the move themselves.
    expect(useGame.getState().state).toBe(before);
    expect(useGame.getState().state!.phase).toBe('playing');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('MUNSHI IS EXEMPT — full-strength advice even when the table is EASY (S6b)', () => {
    // Seat 0 human, the bot seat set to easy. The advisor must still counsel at full (hard) strength.
    useGame.getState().newGame({ seats: [{ kind: 'human' }, { kind: 'bot', difficulty: 'easy' }], seed: 7 });
    useGame.getState().dispatch({ type: 'DRAW' });
    const result = useGame.getState().consultMunshi();
    expect(result).not.toBeNull();
    const { observation } = result!;
    const state = useGame.getState().state!;
    const legal = legalActions(state, actorOf(state));
    // The advice matches the FULL-strength recommendation, not the degraded easy wrapper.
    expect(result!.advice.action).toEqual(recommend(observation, legal, 'hard').action);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('offers nothing (and spends no use) when it is not my play turn', () => {
    // Fresh game sits in awaitingDraw, not the 'playing' phase — the chip is not offered.
    useGame.getState().newGame({ seats: [{ kind: 'human' }, { kind: 'bot', difficulty: 'medium' }], seed: 7 });
    expect(useGame.getState().state!.phase).toBe('awaitingDraw');
    expect(useGame.getState().consultMunshi()).toBeNull();
    expect(useGame.getState().munshiUsesRemaining).toBe(3);
  });
});
