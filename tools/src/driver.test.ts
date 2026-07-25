/**
 * The simulator gate as a fast in-suite check (§8.3). We run a batch of seeded
 * HeuristicBot(Medium) vs RandomBot games and assert the M2 targets:
 *   - ZERO invariant violations across every game (the user's explicit requirement)
 *   - HeuristicBot wins ≥ 90%
 *   - average game length ≤ 25 turns
 *
 * The `pnpm simulate --games 1000` command runs the full 1000-game version.
 */
import { describe, it, expect } from 'vitest';
import { HeuristicBot, RandomBot } from '@sauda/bots';
import { playGame } from './driver';

describe('simulator gate (§8.3)', () => {
  it('zero invariant violations, ≥90% win rate, ≤25 avg turns', () => {
    const bots = [new HeuristicBot('medium'), new RandomBot()];
    const games = 200;

    let heuristicWins = 0;
    let totalViolations = 0;
    let totalTurns = 0;
    let unfinished = 0;

    for (let i = 0; i < games; i++) {
      const summary = playGame(bots, 1000 + i);
      totalViolations += summary.violations.length;
      if (!summary.finished) {
        unfinished += 1;
        continue;
      }
      totalTurns += summary.turns;
      if (summary.winner === 0) {
        heuristicWins += 1;
      }
    }

    expect(totalViolations, 'invariant violations across all games').toBe(0);
    expect(unfinished, 'games that never finished').toBe(0);
    expect(heuristicWins / games).toBeGreaterThanOrEqual(0.9);
    expect(totalTurns / games).toBeLessThanOrEqual(25);
  });
});
