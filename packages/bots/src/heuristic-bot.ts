/**
 * HeuristicBot (§8.3) — a competent, readable rule-based player, with three
 * difficulties. It reasons only over the Observation and the offered legalActions.
 *
 * The documented strategy (§8.3), in priority order on a normal turn:
 *   1. If a placement completes a set (esp. the 3rd) → do it, then declare.
 *   2. Bank until liquid ≥ ₹5, then push property toward the sets closest to done.
 *   3. Play a charge when its expected take ≥ what the card is worth banked.
 *   4. KABZA the most valuable opponent set available.
 *   6. PAYMENT IS DELEGATED: the bot returns the RESPOND_PAY that legalActions
 *      already filled from the engine's shared `suggestPayment` — it never
 *      re-implements §4.5 (see DECISIONS.md / user directive).
 *   5. Hold NAHI CHALEGA for threats above a difficulty threshold.
 */
import type { Action, Observation, PropertyGroup, Rng, SetId } from '@sauda/engine';
import { SETS, buildDeck } from '@sauda/engine';
import type { Bot } from './types';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Difficulty tuning (v1): how big a threatened loss must be before we spend a
// NAHI CHALEGA. Easy spends freely; Hard hoards it for the big threats (§8.3 #5).
const NAHI_THRESHOLD: Record<Difficulty, number> = { easy: 1, medium: 4, hard: 4 };

// Static id → card lookup, built once. Card ids are structural and the deck is
// fixed, so this lets a bot value any card it sees by id without the raw state.
const CARD_BY_ID = new Map(buildDeck().map((card) => [card.id, card]));

function cardValue(id: string): number {
  const card = CARD_BY_ID.get(id);
  if (!card) {
    return 0;
  }
  // ANY wildcards are worth ₹0 (and are never payable).
  if (card.kind === 'wildcard' && card.colors === 'ANY') {
    return 0;
  }
  return card.value;
}

export class HeuristicBot implements Bot {
  readonly name: string;

  constructor(private readonly difficulty: Difficulty = 'medium') {
    this.name = `HeuristicBot(${difficulty})`;
  }

  // The bot's move IS the shared recommendation's action — the same brain Munshi
  // uses, so bot and advisor can never disagree. Deterministic: the RNG is unused.
  chooseAction(observation: Observation, legalActions: Action[], _rng: Rng): Action {
    return recommend(observation, legalActions, this.difficulty).action;
  }
}

// Why the top move ranked first — this keys Munshi's one-line reasoning template.
export type MunshiReason =
  | 'completesSet'
  | 'deniesSet'
  | 'protectsSet'
  | 'bestValue'
  | 'preservesCounter'
  | 'generic';

export interface Recommendation {
  action: Action; // one of the offered legalActions — the move to play/highlight
  reason: MunshiReason;
}

// THE SHARED BRAIN (§8.3). Ranks the offered legalActions with the exact same
// priority cascade the bot has always used, and returns the top move plus the
// reason it won. Both HeuristicBot and Munshi consume this, so they are
// structurally incapable of disagreeing. Deterministic — no RNG, no mutation.
export function recommend(
  observation: Observation,
  legalActions: Action[],
  difficulty: Difficulty,
): Recommendation {
  // Responding to an interrupt? Those actions are only present in that window.
  if (legalActions.some((a) => a.type.startsWith('RESPOND_'))) {
    return recommendResponse(observation, legalActions, difficulty);
  }
  return recommendTurn(observation, legalActions);
}

// --- responding to a charge/steal against me -----------------------------
function recommendResponse(
  observation: Observation,
  legalActions: Action[],
  difficulty: Difficulty,
): Recommendation {
  // §4.5: payment is delegated to the engine — legalActions gives us the one
  // RESPOND_PAY already computed by suggestPayment. We never build it ourselves.
  const pay = legalActions.find((a) => a.type === 'RESPOND_PAY');
  if (pay) {
    return { action: pay, reason: 'bestValue' };
  }

  // Placing a received wildcard: put it where it best advances a set.
  const placements = legalActions.filter((a) => a.type === 'RESPOND_PLACE_RECEIVED');
  if (placements.length > 0) {
    return { action: bestByPlacement(observation, placements, (a) => a.set), reason: 'generic' };
  }

  // NAHI CHALEGA vs comply.
  const nahi = legalActions.find((a) => a.type === 'RESPOND_NAHI_CHALEGA');
  const allow = legalActions.find((a) => a.type === 'RESPOND_ALLOW');
  if (nahi && allow && worthCancelling(observation, difficulty)) {
    return { action: nahi, reason: 'protectsSet' };
  }
  // Comply. If we still hold a NAHI, we're deliberately saving it for a bigger threat.
  return { action: allow ?? legalActions[0]!, reason: nahi ? 'preservesCounter' : 'generic' };
}

function worthCancelling(observation: Observation, difficulty: Difficulty): boolean {
  const threat = observation.interrupt;
  if (!threat) {
    return false;
  }
  return estimateThreatLoss(observation, threat) >= NAHI_THRESHOLD[difficulty];
}

// --- a normal turn -------------------------------------------------------
function recommendTurn(observation: Observation, legalActions: Action[]): Recommendation {
  // 1. Win the moment we can.
  const declare = legalActions.find((a) => a.type === 'DECLARE_WIN');
  if (declare) {
    return { action: declare, reason: 'completesSet' };
  }
  const draw = legalActions.find((a) => a.type === 'DRAW');
  if (draw) {
    return { action: draw, reason: 'generic' };
  }

  // Discard step: never throw away a property/wildcard we are building with.
  const discards = legalActions.filter((a) => a.type === 'DISCARD');
  if (discards.length > 0 && discards.length === legalActions.length) {
    return { action: chooseDiscard(discards), reason: 'bestValue' };
  }

  // The whole game is a race to 3 sets, so building comes first (§8.3 #1, #2).

  // 0. Free win: shuffle a wildcard between groups to complete a set at no play cost.
  const rearrangeToComplete = bestRearrangeToComplete(observation, legalActions);
  if (rearrangeToComplete) {
    return { action: rearrangeToComplete, reason: 'completesSet' };
  }

  // 1. A placement that completes a set is the best move there is.
  const placements = legalActions.filter((a) => a.type === 'PLACE_PROPERTY');
  const completing = placements.find((a) => placementCompletesSet(observation, a.set));
  if (completing) {
    return { action: completing, reason: 'completesSet' };
  }

  // 2. KABZA hands us a whole complete set at once — a huge shortcut (and denies it).
  const kabza = bestKabza(legalActions);
  if (kabza) {
    return { action: kabza, reason: 'deniesSet' };
  }

  // 2b. HAATH KI SAFAI: steal a single property that advances a set of mine.
  const steal = bestHaath(observation, legalActions);
  if (steal) {
    return { action: steal, reason: 'generic' };
  }

  // 3. Push property toward the set closest to completion.
  const placement = bestPlacement(observation, placements);
  if (placement) {
    return { action: placement, reason: 'generic' };
  }

  // 4. Out of property to place → dig for more with AAGE BADHO (draw 2).
  const dig = legalActions.find(
    (a) => a.type === 'PLAY_ACTION' && a.params.action === 'aageBadho',
  );
  if (dig) {
    return { action: dig, reason: 'generic' };
  }

  // 5. Only now spend plays on a profitable charge (money, and denial).
  const charge = bestCharge(observation, legalActions);
  if (charge) {
    return { action: charge, reason: 'bestValue' };
  }

  // 6. Buildings add rent once a set is complete.
  const build = legalActions.find(
    (a) => a.type === 'PLAY_ACTION' && (a.params.action === 'makaan' || a.params.action === 'haveli'),
  );
  if (build) {
    return { action: build, reason: 'generic' };
  }

  // 7. Nothing left to build → bank a money card as a cash reserve to pay rent.
  const bankReserve = bankAMoneyCard(legalActions);
  if (bankReserve) {
    return { action: bankReserve, reason: 'bestValue' };
  }

  return { action: legalActions.find((a) => a.type === 'END_TURN') ?? legalActions[0]!, reason: 'generic' };
}

// --- shared read helpers ---------------------------------------------------

// A colour already has a complete set (so a second set of it doesn't help the win).
function colorHasCompleteSet(groups: PropertyGroup[], set: SetId): boolean {
  return groups.some((group) => group.cards.length >= SETS[set].size);
}

// Cards in the group a new placement of this colour would land in (the engine fills
// the first non-full group, else starts a fresh empty one).
function placementTargetCount(groups: PropertyGroup[], set: SetId): number {
  const size = SETS[set].size;
  for (const group of groups) {
    if (group.cards.length < size) {
      return group.cards.length;
    }
  }
  return 0;
}

// How many more cards the colour's next set needs (1 = one card from complete).
function nextSetRemaining(groups: PropertyGroup[], set: SetId): number {
  return SETS[set].size - placementTargetCount(groups, set);
}

// True if placing one more card completes a set in a colour I have NOT completed
// yet (a second same-colour set is only one colour, so it does not help the win).
function placementCompletesSet(observation: Observation, set: SetId): boolean {
  const groups = observation.myProperties[set];
  if (colorHasCompleteSet(groups, set)) {
    return false;
  }
  return nextSetRemaining(groups, set) === 1;
}

// Chooses the placement that best advances a NEW colour: closest to completion
// first, then the cheapest set to finish (§8.3 #2 — size-2 sets need only two
// cards). Skips colours already complete, since a 2nd same-colour set is wasted.
function bestPlacement(
  observation: Observation,
  placements: Extract<Action, { type: 'PLACE_PROPERTY' }>[],
): Action | null {
  let best: Action | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const action of placements) {
    const groups = observation.myProperties[action.set];
    if (colorHasCompleteSet(groups, action.set)) {
      continue;
    }
    const remainingAfter = nextSetRemaining(groups, action.set) - 1;
    const score = remainingAfter * 10 + SETS[action.set].size; // fewer-left, then smaller set
    if (score < bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

// The colour a card currently sits in on my table, or null.
function currentSetOf(observation: Observation, cardId: string): SetId | null {
  for (const groups of Object.values(observation.myProperties)) {
    for (const group of groups) {
      if (group.cards.includes(cardId)) {
        return group.set;
      }
    }
  }
  return null;
}

// A free REARRANGE_WILDCARD that completes a new colour without breaking a complete one.
function bestRearrangeToComplete(observation: Observation, legalActions: Action[]): Action | null {
  for (const action of legalActions) {
    if (action.type !== 'REARRANGE_WILDCARD') {
      continue;
    }
    const toGroups = observation.myProperties[action.toSet];
    if (colorHasCompleteSet(toGroups, action.toSet)) {
      continue; // completing a 2nd same-colour set doesn't help
    }
    if (nextSetRemaining(toGroups, action.toSet) !== 1) {
      continue;
    }
    const fromSet = currentSetOf(observation, action.cardId);
    // Don't rob a complete set to make another (no net gain).
    if (fromSet !== null && colorHasCompleteSet(observation.myProperties[fromSet], fromSet)) {
      continue;
    }
    return action;
  }
  return null;
}

// Generic "pick the placement that best advances a set" for received wildcards.
function bestByPlacement<T extends Action>(
  observation: Observation,
  actions: T[],
  setOf: (action: T) => SetId,
): T {
  let best = actions[0]!;
  let bestRemaining = Number.POSITIVE_INFINITY;
  for (const action of actions) {
    const set = setOf(action);
    const remaining = nextSetRemaining(observation.myProperties[set], set);
    if (remaining < bestRemaining) {
      bestRemaining = remaining;
      best = action;
    }
  }
  return best;
}

// §8.3 #4: take the highest-value complete opponent set on offer.
function bestKabza(legalActions: Action[]): Action | null {
  let best: Action | null = null;
  let bestValue = -1;
  for (const action of legalActions) {
    if (action.type === 'PLAY_ACTION' && action.params.action === 'kabza') {
      const value = SETS[action.params.set].value;
      if (value > bestValue) {
        bestValue = value;
        best = action;
      }
    }
  }
  return best;
}

// How much we want to KEEP a card when forced to discard (higher = keep).
// Property and wildcards build sets, so they are the last thing we drop.
function keepValue(id: string): number {
  const card = CARD_BY_ID.get(id);
  if (!card) {
    return 0;
  }
  switch (card.kind) {
    case 'property':
      return 100;
    case 'wildcard':
      return 90;
    case 'action':
      return card.action === 'nahiChalega' || card.action === 'kabza' ? 60 : 30;
    case 'kiraya':
      return 25;
    case 'money':
      return card.value; // drop the smallest money first
    default:
      return 50;
  }
}

// §4.4 step 4: discard the card we least want to keep.
function chooseDiscard(discards: Extract<Action, { type: 'DISCARD' }>[]): Action {
  let best = discards[0]!;
  let lowest = Number.POSITIVE_INFINITY;
  for (const action of discards) {
    const value = keepValue(action.cardId);
    if (value < lowest) {
      lowest = value;
      best = action;
    }
  }
  return best;
}

// The colour groups a card could join for me (a fixed property → its set; a
// wildcard → its colours, or every colour for ANY).
function colourOptions(cardId: string): SetId[] {
  const card = CARD_BY_ID.get(cardId);
  if (!card) {
    return [];
  }
  if (card.kind === 'property') {
    return [card.set];
  }
  if (card.kind === 'wildcard') {
    return card.colors === 'ANY' ? (Object.keys(SETS) as SetId[]) : [...card.colors];
  }
  return [];
}

// §8.3: HAATH KI SAFAI to grab a property that advances one of my building sets,
// preferring one that completes a set outright.
function bestHaath(observation: Observation, legalActions: Action[]): Action | null {
  let best: Action | null = null;
  let bestScore = -1;
  for (const action of legalActions) {
    if (action.type !== 'PLAY_ACTION' || action.params.action !== 'haathKiSafai') {
      continue;
    }
    for (const colour of colourOptions(action.params.cardId)) {
      const groups = observation.myProperties[colour];
      if (colorHasCompleteSet(groups, colour)) {
        continue; // grabbing for an already-complete colour is wasted for the win
      }
      const size = SETS[colour].size;
      // How advanced my closest incomplete set of this colour is.
      let owned = 0;
      for (const group of groups) {
        if (group.cards.length > 0 && group.cards.length < size) {
          owned = Math.max(owned, group.cards.length);
        }
      }
      if (owned === 0) {
        continue; // not actively building this colour
      }
      const score = owned + 1 >= size ? 100 : owned * 10;
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }
  }
  return best;
}

// A money card worth banking for liquidity (prefer the smallest).
function bankAMoneyCard(legalActions: Action[]): Action | null {
  let best: Action | null = null;
  let bestValue = Number.POSITIVE_INFINITY;
  for (const action of legalActions) {
    if (action.type !== 'BANK_CARD') {
      continue;
    }
    const card = CARD_BY_ID.get(action.cardId);
    if (card?.kind !== 'money') {
      continue; // keep action cards in hand for their effects
    }
    if (card.value < bestValue) {
      bestValue = card.value;
      best = action;
    }
  }
  return best;
}

// --- charge valuation (§8.3 #3) -------------------------------------------

// Total value an opponent could be made to pay from their table.
function opponentTableValue(observation: Observation, playerId: number): number {
  const opponent = observation.opponents.find((o) => o.id === playerId);
  if (!opponent) {
    return 0;
  }
  let total = 0;
  for (const id of opponent.bank) {
    total += cardValue(id);
  }
  for (const groups of Object.values(opponent.properties)) {
    for (const group of groups) {
      for (const id of [...group.cards, ...group.buildings]) {
        total += cardValue(id);
      }
    }
  }
  return total;
}

// Rough kiraya for a colour we own, mirroring §5 from the observation (buildings
// are inferred from group.buildings length: 1 = +₹3, 2 = +₹7). Estimation only —
// the authoritative amount is computed by the engine when the card is played.
function estimateGroupKiraya(group: PropertyGroup, dugnaCount: number): number {
  const owned = group.cards.length;
  if (owned === 0) {
    return 0;
  }
  const rentTable = SETS[group.set].rent;
  let amount = rentTable[Math.min(owned, rentTable.length) - 1] ?? 0;
  if (owned >= SETS[group.set].size) {
    amount += [0, 3, 7][Math.min(group.buildings.length, 2)]!;
  }
  return amount * Math.pow(2, dugnaCount);
}

// A colour is charged at its best (highest-rent) set — mirrors engine kirayaFor.
function estimateColorKiraya(groups: PropertyGroup[], dugnaCount: number): number {
  let best = 0;
  for (const group of groups) {
    best = Math.max(best, estimateGroupKiraya(group, dugnaCount));
  }
  return best;
}

// Picks the charge with the best (expected take − banked value), if it pays off.
function bestCharge(observation: Observation, legalActions: Action[]): Action | null {
  let best: Action | null = null;
  let bestGain = 0; // must strictly beat "do nothing"

  for (const action of legalActions) {
    const evaluated = evaluateCharge(observation, action);
    if (!evaluated) {
      continue;
    }
    const gain = evaluated.expectedTake - evaluated.bankedValue;
    if (evaluated.expectedTake >= evaluated.bankedValue && gain > bestGain) {
      bestGain = gain;
      best = action;
    }
  }
  return best;
}

function evaluateCharge(
  observation: Observation,
  action: Action,
): { expectedTake: number; bankedValue: number } | null {
  if (action.type === 'PLAY_ACTION' && action.params.action === 'vasooli') {
    return { expectedTake: Math.min(5, opponentTableValue(observation, action.params.target)), bankedValue: 3 };
  }
  if (action.type === 'PLAY_ACTION' && action.params.action === 'shagun') {
    let take = 0;
    for (const opponent of observation.opponents) {
      take += Math.min(2, opponentTableValue(observation, opponent.id));
    }
    return { expectedTake: take, bankedValue: 2 };
  }
  if (action.type === 'PLAY_KIRAYA') {
    const amount = estimateColorKiraya(observation.myProperties[action.color], action.dugnaCardIds.length);
    if (action.target !== null) {
      return { expectedTake: Math.min(amount, opponentTableValue(observation, action.target)), bankedValue: 3 };
    }
    let take = 0;
    for (const opponent of observation.opponents) {
      take += Math.min(amount, opponentTableValue(observation, opponent.id));
    }
    return { expectedTake: take, bankedValue: 1 };
  }
  return null;
}

// Estimated loss if a threat against me stands — used for the NAHI decision.
function estimateThreatLoss(observation: Observation, threat: NonNullable<Observation['interrupt']>): number {
  const effect = threat.effect;
  switch (effect.kind) {
    case 'charge':
      return effect.amount;
    case 'stealSet': {
      const groups = observation.myProperties[effect.set];
      const stolen = groups.find((g) => g.cards.length >= SETS[effect.set].size) ?? groups[0];
      let value = 0;
      for (const id of stolen ? [...stolen.cards, ...stolen.buildings] : []) {
        value += cardValue(id);
      }
      return value + 3; // a whole set is worse than its face value
    }
    case 'stealProperty':
      return cardValue(effect.cardId);
    case 'swap':
      return 3; // losing position, hard to value precisely
    default:
      return 0;
  }
}
