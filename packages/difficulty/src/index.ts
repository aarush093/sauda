/**
 * @sauda/difficulty — S6b (owner playtest, 13 Aug). The three difficulty tiers used to be nearly
 * identical: the frozen HeuristicBot only varied a NAHI-CHALEGA threshold, and medium ≡ hard exactly
 * (see DECISIONS "S6b"). So the owner lost every game at every setting — all three ran the same
 * ~95.8%-win brain. This package WRAPS the frozen full-strength `recommend()` from @sauda/bots and
 * DEGRADES it by tier, so a lower difficulty is a genuinely weaker — but still plausible — opponent,
 * not a broken one:
 *
 *   hard   → recommend() verbatim (the current bot; consumes NO rng, so byte-identical to before).
 *   medium → with probability p_m, discard the recommendation and play a random legal action.
 *   easy   → same, with a much higher p_e, AND when it randomises it prefers a QUIET move (bank /
 *            build / pass) over an aggressive charge or steal — a timid beginner, not a wrecking ball.
 *
 * Determinism: the ONLY randomness is the seeded `Rng` the caller passes (the game seed), so a game
 * is fully reproducible and simulatable. It never touches Math.random and never mutates state. It
 * only sequences already-legal moves the engine offered, so packages/bots and packages/engine stay
 * byte-identical.
 *
 * MUNSHI IS EXEMPT (already-locked decision): the advisor uses full-strength recommend() directly
 * and never routes through this wrapper, so the human's advice is always sharpest regardless of the
 * table's difficulty. Enforced by the store (MUNSHI_DIFFICULTY = 'hard') and asserted in the tests.
 */
import type { Action, Observation, Rng } from '@sauda/engine';
import { recommend } from '@sauda/bots';
import type { Bot, Difficulty } from '@sauda/bots';

// How often each tier THROWS AWAY the strong recommendation and plays a weaker legal move instead.
// hard never slips (0). Tuned in S6c against the >=1000-game simulation harness — see DECISIONS
// "S6c" for the win-rate tables these values produce; tune HERE if the bands drift.
export const SLIP_PROBABILITY: Record<Difficulty, number> = {
  easy: 0.7,
  medium: 0.35,
  hard: 0,
};

// A "quiet" move builds or passes rather than attacking an opponent. An easy bot leans on these when
// it wanders off the recommendation, so it reads like a cautious beginner (banks, places property,
// pays, ends the turn) instead of a bot that suicides its action cards into random targets.
function isQuietAction(action: Action): boolean {
  switch (action.type) {
    case 'BANK_CARD':
    case 'PLACE_PROPERTY':
    case 'DRAW':
    case 'END_TURN':
    case 'DISCARD':
    case 'RESPOND_ALLOW':
    case 'RESPOND_PAY':
    case 'RESPOND_PLACE_RECEIVED':
      return true;
    // The punchy moves: KABZA / VASOOLI / HAATH (PLAY_ACTION), kiraya, buildings, DECLARE_WIN, NAHI.
    default:
      return false;
  }
}

// Pick a weaker-but-legal move for a tier that has decided to slip. A timid tier (easy) prefers the
// quiet subset when it is non-empty; otherwise both tiers pick uniformly from every legal action.
// Draws only from the engine's offered `legalActions`, so the result is always legal.
function slipAction(legalActions: Action[], rng: Rng, timid: boolean): Action {
  if (timid) {
    const quiet = legalActions.filter(isQuietAction);
    if (quiet.length > 0) {
      return quiet[Math.floor(rng() * quiet.length)]!;
    }
  }
  return legalActions[Math.floor(rng() * legalActions.length)]!;
}

// The slip gate: does a bot of this tier abandon the recommendation THIS move? Draws one value from
// the seeded rng (so it's reproducible), except for hard, where `slip > 0` short-circuits and rng is
// never touched — making hard byte-identical to the frozen bot. Exported so the probability can be
// asserted directly, independent of which action a slip happens to land on.
export function shouldSlip(rng: Rng, difficulty: Difficulty): boolean {
  const slip = SLIP_PROBABILITY[difficulty];
  return slip > 0 && rng() < slip;
}

// The move a bot of the given tier should make: the full-strength recommendation, OR — with the
// tier's slip probability — a weaker legal move. Deterministic under `rng`. hard (slip 0) never
// draws from `rng`, so it is exactly `recommend().action` — the current bot, unchanged. A single
// legal option can't be slipped (there's nothing else to play), so we don't burn rng deciding.
export function chooseWithDifficulty(
  observation: Observation,
  legalActions: Action[],
  rng: Rng,
  difficulty: Difficulty,
): Action {
  const strong = recommend(observation, legalActions, difficulty).action;
  if (legalActions.length > 1 && shouldSlip(rng, difficulty)) {
    return slipAction(legalActions, rng, difficulty === 'easy');
  }
  return strong;
}

// A drop-in Bot (same interface as HeuristicBot) whose strength is set by tier. apps/mobile's store
// and the simulation tooling both build this, so the difficulty setting finally changes how the bots
// actually play. HeuristicBot itself is untouched and still available for the "strong proxy".
export class DifficultyBot implements Bot {
  readonly name: string;

  constructor(private readonly difficulty: Difficulty) {
    this.name = `DifficultyBot(${difficulty})`;
  }

  chooseAction(observation: Observation, legalActions: Action[], rng: Rng): Action {
    return chooseWithDifficulty(observation, legalActions, rng, this.difficulty);
  }
}
