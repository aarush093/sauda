/**
 * RandomBot: picks a uniformly random legal action. It is the baseline the
 * HeuristicBot must beat ≥90% of the time (§8.3), and it is invaluable for the
 * property/invariant tests because it stress-tests the engine with chaotic but
 * always-legal play.
 */
import type { Action, Observation, Rng } from '@sauda/engine';
import type { Bot } from './types';

export class RandomBot implements Bot {
  readonly name = 'RandomBot';

  chooseAction(_observation: Observation, legalActions: Action[], rng: Rng): Action {
    const index = Math.floor(rng() * legalActions.length);
    return legalActions[index]!;
  }
}
