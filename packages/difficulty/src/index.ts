/**
 * @sauda/difficulty — TIER-SCALED TRAITS (U4, first-player pass). The owner's sister lost to the bots
 * on EASY. The old wrapper (S6b) degraded a tier by, with some probability, THROWING AWAY the strong
 * recommendation and playing a RANDOM legal move. The owner's verdict: random action selection is the
 * WRONG lever — it makes a weak bot bank properties and play nonsense, which reads as a BUG, not as a
 * beginner. A weak bot must play like an INEXPERIENCED player, not a broken one: it still banks money
 * and places properties; it just misses the sharp plays.
 *
 * So this rebuilds the wrapper around CHARACTER. The design brief, in the owner's framing: on easy the
 * opponent is a 12-year-old who barely knows the game; on medium a 16-year-old who knows some things;
 * on hard an 18-19-year-old who plays to win. Each tier scales six traits, and the wrapper only ever
 * FILTERS or REORDERS the moves the frozen brain already offered — it never invents a move and never
 * plays a random one. When a trait suppresses a class of move, the bot falls back to its BEST remaining
 * legal move (recommend() run on the narrowed list), which for a suppressed attack is a bank or a build
 * — a busy beginner tending their own collection, never a wrecking ball.
 *
 * The six traits (all a probability in [0,1] = "how good the bot is at this facet this move"):
 *   a. AGGRESSION   — how often it uses take-that actions (KABZA / HAATH KI SAFAI / ADLA-BADLI /
 *                     VASOOLI / SHAGUN / LAGAAN charges) against a live opponent.
 *   b. GREED/FOCUS  — how reliably it converts toward completing sets. A low-greed beginner sometimes
 *                     skips the set-building play and banks or spreads to another colour instead.
 *   c. WILDCARD     — how often it uses the FREE rearrange to optimise its board.
 *   d. DEFENCE      — how often it plays NAHI CHALEGA when it holds one (subsumes the old NAHI_THRESHOLD).
 *   e. CLOSING      — how promptly it declares a win it could declare (a beginner may sit on it a turn).
 *   f. RANDOM SLIP  — a SMALL residual chance of an ordinary quiet misplay, used only to fine-tune the
 *                     bands after a-e are set. Kept low so the bot never does something visibly stupid.
 *
 * Determinism: the ONLY randomness is the seeded `Rng` the caller passes (the game seed), so a game is
 * fully reproducible and simulatable. Rng is drawn only when a trait actually has a decision to make
 * (the relevant move is on offer), so it is never wasted. HARD's traits are all 1 and its slip is 0, so
 * every gate short-circuits WITHOUT drawing rng — hard is byte-identical to the frozen recommend().
 * It never touches Math.random, never mutates state, and only sequences already-legal moves, so
 * packages/bots and packages/engine stay byte-identical.
 *
 * MUNSHI IS EXEMPT (already-locked decision): the advisor uses full-strength recommend() directly and
 * never routes through this wrapper, so the human's advice is always sharpest regardless of the table's
 * difficulty. Enforced by the store (MUNSHI_DIFFICULTY = 'hard') and asserted in the tests.
 */
import type { Action, Observation, Rng } from '@sauda/engine';
import { recommend } from '@sauda/bots';
import type { Bot, Difficulty } from '@sauda/bots';

export { assistOpeningHand, EASY_OPENING_ASSIST_CARDS } from './opening-assist';

// One tier's character. Every field is "how skilled the bot is at this facet", 0 = never, 1 = always.
export interface DifficultyTraits {
  aggression: number; // how often it presses a take-that attack when one is the strong play
  greed: number; // how reliably it converts a building/completing play instead of banking/spreading
  wildcardSkill: number; // how often it takes a free REARRANGE that improves the board
  defence: number; // how often it plays NAHI CHALEGA when it holds one
  closing: number; // how promptly it declares a win it could declare this turn
  randomSlip: number; // a small residual chance of an ordinary quiet misplay (fine-tuning only)
}

// The tuned tiers (U4). Tuned against the >=1000-game fairness harness (`pnpm --filter @sauda/tools
// winrates`) — see DECISIONS "U4" for the before/after win-rate tables these values produce. Tune HERE
// if the bands drift. HARD is full strength (every trait 1, no slip) so it is byte-identical to the
// frozen bot; EASY is the 12-year-old (rarely attacks, poor conversion, almost never rearranges, weak
// defence, dawdles on the win); MEDIUM is the 16-year-old (competent, misses a trick).
export const TRAITS: Record<Difficulty, DifficultyTraits> = {
  easy: { aggression: 0.15, greed: 0.35, wildcardSkill: 0.05, defence: 0.2, closing: 0.45, randomSlip: 0.08 },
  medium: { aggression: 0.55, greed: 0.7, wildcardSkill: 0.5, defence: 0.55, closing: 0.85, randomSlip: 0.04 },
  hard: { aggression: 1, greed: 1, wildcardSkill: 1, defence: 1, closing: 1, randomSlip: 0 },
};

// A take-that attack against a live opponent — the moves an aggressive player presses and a timid
// beginner mostly leaves alone. LAGAAN (rent) is an attack; AAGE BADHO (draw 2) and buildings are not.
const ATTACK_PLAY_ACTIONS = new Set(['kabza', 'haathKiSafai', 'vasooli', 'shagun', 'adlaBadli']);
function isAttack(action: Action): boolean {
  if (action.type === 'PLAY_KIRAYA') {
    return true; // LAGAAN — charging rent at an opponent
  }
  if (action.type === 'PLAY_ACTION') {
    return ATTACK_PLAY_ACTIONS.has(action.params.action);
  }
  return false;
}

// A building play — placing or completing a set toward the win. The greed lever acts on these: a
// low-greed beginner sometimes fails to convert and does something lesser instead.
function isBuild(action: Action): boolean {
  return action.type === 'PLACE_PROPERTY' || action.type === 'REARRANGE_WILDCARD';
}

// A "quiet" move builds or passes rather than attacking — the safe pool the random-slip residual draws
// from, so even a slip looks like a cautious beginner (bank / place / pay / end), never a wild attack.
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
    default:
      return false;
  }
}

// A skill gate: does a bot of this skill level ACT on this facet this move? Returns false (suppress the
// facet) with probability (1 - skill). Skill 1 short-circuits WITHOUT drawing rng, so a full-strength
// tier consumes no randomness (keeping hard byte-identical to the frozen bot). Draws exactly one rng
// value otherwise, so the choice is reproducible under the game seed.
export function skilledEnough(rng: Rng, skill: number): boolean {
  if (skill >= 1) {
    return true;
  }
  return rng() < skill;
}

// Remove every action matching `predicate` from the pool, but never strand the bot: if that would empty
// the pool, keep it unchanged (the bot then plays the move it "couldn't avoid", e.g. its only legal
// move is an attack). Pure — returns a new array.
function withoutSuppressed(pool: Action[], predicate: (action: Action) => boolean): Action[] {
  const kept = pool.filter((action) => !predicate(action));
  return kept.length > 0 ? kept : pool;
}

/**
 * The move a bot of the given tier should make. It starts from the full legal list, NARROWS it by the
 * tier's traits (suppressing attacks / free rearranges / NAHI / a premature declare when the tier isn't
 * skilled enough this move), asks the frozen brain for the best move among what's left, then applies the
 * greed lever (a beginner who fails to convert) and a small random-slip residual. Deterministic under
 * `rng`. Hard (all traits 1, slip 0) draws no rng, so it returns exactly recommend(legal).action.
 */
export function chooseWithDifficulty(
  observation: Observation,
  legalActions: Action[],
  rng: Rng,
  difficulty: Difficulty,
): Action {
  const traits = TRAITS[difficulty];
  let candidates = legalActions;

  // a. AGGRESSION — a timid tier mostly leaves its attack cards alone and tends its own board instead.
  if (candidates.some(isAttack) && !skilledEnough(rng, traits.aggression)) {
    candidates = withoutSuppressed(candidates, isAttack);
  }
  // c. WILDCARD — the youngest almost never spots the free rearrange that tidies its board.
  if (candidates.some((action) => action.type === 'REARRANGE_WILDCARD') && !skilledEnough(rng, traits.wildcardSkill)) {
    candidates = withoutSuppressed(candidates, (action) => action.type === 'REARRANGE_WILDCARD');
  }
  // e. CLOSING — a beginner may sit on a winning position for a turn instead of declaring at once.
  if (candidates.some((action) => action.type === 'DECLARE_WIN') && !skilledEnough(rng, traits.closing)) {
    candidates = withoutSuppressed(candidates, (action) => action.type === 'DECLARE_WIN');
  }
  // d. DEFENCE — how often it actually counters with NAHI CHALEGA when it holds one (else it allows).
  if (candidates.some((action) => action.type === 'RESPOND_NAHI_CHALEGA') && !skilledEnough(rng, traits.defence)) {
    candidates = withoutSuppressed(candidates, (action) => action.type === 'RESPOND_NAHI_CHALEGA');
  }

  let choice = recommend(observation, candidates, difficulty).action;

  // b. GREED / FOCUS — a low-greed beginner sometimes fails to convert: skip the building play it just
  // picked and take its NEXT-best move instead (often a bank, or spreading a card to another colour —
  // exactly the beginner's mistake). One re-pick keeps it a single, readable naive miss.
  if (isBuild(choice) && candidates.length > 1 && !skilledEnough(rng, traits.greed)) {
    const withoutThisBuild = candidates.filter((action) => action !== choice);
    if (withoutThisBuild.length > 0) {
      choice = recommend(observation, withoutThisBuild, difficulty).action;
    }
  }

  // f. RANDOM SLIP — the small final adjustment: a rare ordinary quiet misplay. Drawn from the quiet
  // pool so it never looks like a wild attack — a beginner banking the wrong card, not a bot glitching.
  if (legalActions.length > 1 && traits.randomSlip > 0 && rng() < traits.randomSlip) {
    const quiet = legalActions.filter(isQuietAction);
    const pool = quiet.length > 0 ? quiet : legalActions;
    return pool[Math.floor(rng() * pool.length)]!;
  }

  return choice;
}

// A drop-in Bot (same interface as HeuristicBot) whose strength is set by tier. apps/mobile's store and
// the simulation tooling both build this, so the difficulty setting finally changes how the bots play.
// HeuristicBot itself is untouched and still available as the "strong proxy" for the fairness harness.
export class DifficultyBot implements Bot {
  readonly name: string;

  constructor(private readonly difficulty: Difficulty) {
    this.name = `DifficultyBot(${difficulty})`;
  }

  chooseAction(observation: Observation, legalActions: Action[], rng: Rng): Action {
    return chooseWithDifficulty(observation, legalActions, rng, this.difficulty);
  }
}
