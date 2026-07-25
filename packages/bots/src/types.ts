/**
 * The one interface every bot implements (§8.3). A bot is given only what a
 * player may legally see (`Observation`), the exact list of moves it may make
 * (`legalActions` — the engine's single source of truth), and a seeded RNG so
 * games are reproducible. It returns one of the offered actions.
 *
 * Bots never touch raw GameState and never re-derive the rules — in particular
 * payment selection is delegated to the engine's shared `suggestPayment` helper,
 * surfaced through the RESPOND_PAY action that `legalActions` already provides.
 */
import type { Action, Observation, Rng } from '@sauda/engine';

export interface Bot {
  readonly name: string;
  chooseAction(observation: Observation, legalActions: Action[], rng: Rng): Action;
}
