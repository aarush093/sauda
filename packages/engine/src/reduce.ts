/**
 * reduce(state, action) → Result<{state, events}> — the ONLY place state changes
 * (§8.1). Every rule is enforced here defensively, even though legalActions already
 * filters, because RESPOND_PAY is not fully enumerable (see DECISIONS.md).
 *
 * IMPLEMENTATION STYLE (readability contract): we deep-clone the state once, then
 * mutate the clone locally, then return it. "Clone then mutate" is far easier to
 * read and reason about than threading immutable updates through every zone, and it
 * cannot alias the caller's state. The immutable card registry is shared, not copied.
 *
 * The actor is implied by the state: turn actions are performed by the current
 * player; responses by the open interrupt's `responder` (which is how off-turn NAHI
 * CHALEGA works). So reduce takes no explicit actor id.
 */
import type { SetId } from './types';
import type { Action, ActionParams } from './actions';
import type {
  CardId,
  GameEvent,
  GameState,
  Interrupt,
  PlayerId,
  PropertyGroup,
  Result,
} from './state';
import { fail, ok } from './state';
import { shuffleWithState } from './rng';
import {
  canPlaceInSet,
  getCard,
  hasHaveli,
  hasMakaan,
  hasThreeCompleteSets,
  isSetComplete,
  kirayaFor,
} from './sets';
import { chargeStandsByParity } from './interrupts';
import { applyPayment, relocateOrphanedBuildings, validatePayment } from './payment';
import type { PaymentRequest } from './payment';

export function reduce(state: GameState, action: Action): Result<{ state: GameState; events: GameEvent[] }> {
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const result = apply(draft, action, events);
  if (!result.ok) {
    return result; // caller's original state is untouched
  }
  return ok({ state: draft, events });
}

// Dispatch one action to its handler. Handlers mutate `draft`/`events` and return a
// Result<void> so a rule violation aborts without changing the returned state.
function apply(draft: GameState, action: Action, events: GameEvent[]): Result<void> {
  switch (action.type) {
    case 'DRAW':
      return handleDraw(draft, events);
    case 'BANK_CARD':
      return handleBank(draft, action.cardId, events);
    case 'PLACE_PROPERTY':
      return handlePlaceProperty(draft, action.cardId, action.set, events);
    case 'PLAY_ACTION':
      return handlePlayAction(draft, action.cardId, action.params, events);
    case 'PLAY_KIRAYA':
      return handlePlayKiraya(draft, action, events);
    case 'REARRANGE_WILDCARD':
      return handleRearrange(draft, action.cardId, action.toSet, events);
    case 'END_TURN':
      return handleEndTurn(draft, events);
    case 'DISCARD':
      return handleDiscard(draft, action.cardId, events);
    case 'DECLARE_WIN':
      return handleDeclareWin(draft, events);
    case 'RESPOND_NAHI_CHALEGA':
      return handleNahiChalega(draft, action.cardId, events);
    case 'RESPOND_ALLOW':
      return handleAllow(draft, events);
    case 'RESPOND_PAY':
      return handlePay(draft, action.cardIds, events);
    case 'RESPOND_PLACE_RECEIVED':
      return handlePlaceReceived(draft, action.cardId, action.set, events);
    default:
      return fail('UNKNOWN_ACTION', `unknown action`);
  }
}

// --- turn flow -------------------------------------------------------------

// §4.4 step 2: draw 2, or 5 if the hand is empty at the start of the turn.
function handleDraw(draft: GameState, events: GameEvent[]): Result<void> {
  if (draft.pendingInterrupts.length > 0) {
    return fail('INTERRUPT_OPEN', 'resolve the pending action first');
  }
  if (draft.phase !== 'awaitingDraw') {
    return fail('WRONG_PHASE', 'you have already drawn this turn');
  }
  const player = current(draft);
  const count = player.hand.length === 0 ? draft.rules.emptyHandDraw : draft.rules.drawPerTurn;
  drawCards(draft, player.id, count, events);
  draft.phase = 'playing';
  return ok(undefined);
}

// Draws `count` cards, reshuffling the discard pile into the draw pile if it runs
// out (§4.6). Top of a pile is the last array element.
function drawCards(draft: GameState, playerId: PlayerId, count: number, events: GameEvent[]): void {
  const player = draft.players[playerId]!;
  const drawn: CardId[] = [];
  for (let i = 0; i < count; i++) {
    if (draft.drawPile.length === 0) {
      if (draft.discardPile.length === 0) {
        break; // nothing left anywhere
      }
      reshuffleDiscardIntoDraw(draft, events);
    }
    drawn.push(draft.drawPile.pop()!);
  }
  player.hand.push(...drawn);
  if (drawn.length > 0) {
    events.push({ type: 'CardsDrawn', player: playerId, cardIds: drawn });
  }
}

function reshuffleDiscardIntoDraw(draft: GameState, events: GameEvent[]): void {
  // Deterministic reshuffle using the stored RNG state (§4.6).
  const count = draft.discardPile.length;
  const shuffled = shuffleWithState(draft.discardPile, draft.rngState);
  draft.drawPile = shuffled.items;
  draft.rngState = shuffled.state;
  draft.discardPile = [];
  events.push({ type: 'DrawPileReshuffled', count });
}

// §4.4 step 1 free part: end plays. If over the hand limit we move to the discard
// step; otherwise the turn passes to the next player.
function handleEndTurn(draft: GameState, events: GameEvent[]): Result<void> {
  const guard = requirePlaying(draft);
  if (!guard.ok) {
    return guard;
  }
  if (current(draft).hand.length > draft.rules.handLimit) {
    draft.phase = 'awaitingDiscard';
    return ok(undefined);
  }
  startNextTurn(draft, events);
  return ok(undefined);
}

// §4.4 step 4: discard down to the hand limit, then the turn ends.
function handleDiscard(draft: GameState, cardId: CardId, events: GameEvent[]): Result<void> {
  if (draft.pendingInterrupts.length > 0) {
    return fail('INTERRUPT_OPEN', 'resolve the pending action first');
  }
  if (draft.phase !== 'awaitingDiscard') {
    return fail('WRONG_PHASE', 'not in the discard step');
  }
  const player = current(draft);
  if (!removeId(player.hand, cardId)) {
    return fail('CARD_NOT_IN_HAND', `card ${cardId} is not in your hand`);
  }
  draft.discardPile.push(cardId);
  events.push({ type: 'CardsDiscarded', player: player.id, cardIds: [cardId] });
  if (player.hand.length <= draft.rules.handLimit) {
    startNextTurn(draft, events);
  }
  return ok(undefined);
}

function startNextTurn(draft: GameState, events: GameEvent[]): void {
  events.push({ type: 'TurnEnded', player: draft.currentPlayerIndex });
  draft.currentPlayerIndex = (draft.currentPlayerIndex + 1) % draft.players.length;
  draft.turnCount += 1;
  draft.playsRemaining = draft.rules.playsPerTurn;
  draft.phase = 'awaitingDraw';
  events.push({ type: 'TurnStarted', player: draft.currentPlayerIndex, turn: draft.turnCount });
}

// §4.1: a win may only be declared on your own turn, when you hold 3 complete sets.
function handleDeclareWin(draft: GameState, events: GameEvent[]): Result<void> {
  if (draft.pendingInterrupts.length > 0) {
    return fail('INTERRUPT_OPEN', 'resolve the pending action first');
  }
  if (draft.phase !== 'awaitingDraw' && draft.phase !== 'playing') {
    return fail('WRONG_PHASE', 'you can only declare on your own turn');
  }
  if (!hasThreeCompleteSets(draft, draft.currentPlayerIndex)) {
    return fail('NO_WIN', 'you do not hold 3 complete sets');
  }
  draft.winnerIndex = draft.currentPlayerIndex;
  draft.phase = 'gameOver';
  events.push({ type: 'WinDeclared', player: draft.currentPlayerIndex });
  return ok(undefined);
}

// --- the three plays -------------------------------------------------------

// §4.4: bank a money OR action card (kiraya counts as an action-type card here) at
// its ₹ value. Properties and wildcards cannot be banked — they go to the table.
function handleBank(draft: GameState, cardId: CardId, events: GameEvent[]): Result<void> {
  const guard = requirePlay(draft);
  if (!guard.ok) {
    return guard;
  }
  const player = current(draft);
  if (!player.hand.includes(cardId)) {
    return fail('CARD_NOT_IN_HAND', `card ${cardId} is not in your hand`);
  }
  const card = getCard(draft, cardId);
  if (card.kind !== 'money' && card.kind !== 'action' && card.kind !== 'kiraya') {
    return fail('CANNOT_BANK', 'only money or action cards can be banked');
  }
  removeId(player.hand, cardId);
  player.bank.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'CardBanked', player: player.id, cardId, value: card.value });
  return ok(undefined);
}

// §4.4: place a property or wildcard into a colour group you choose.
function handlePlaceProperty(
  draft: GameState,
  cardId: CardId,
  set: SetId,
  events: GameEvent[],
): Result<void> {
  const guard = requirePlay(draft);
  if (!guard.ok) {
    return guard;
  }
  const player = current(draft);
  if (!player.hand.includes(cardId)) {
    return fail('CARD_NOT_IN_HAND', `card ${cardId} is not in your hand`);
  }
  const card = getCard(draft, cardId);
  if (card.kind !== 'property' && card.kind !== 'wildcard') {
    return fail('NOT_A_PROPERTY', 'only property or wildcard cards can be placed');
  }
  if (!canPlaceInSet(card, set)) {
    return fail('WRONG_COLOR', `card ${cardId} cannot join ${set}`);
  }
  removeId(player.hand, cardId);
  player.properties[set].cards.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'PropertyPlaced', player: player.id, cardId, set });
  return ok(undefined);
}

// §4.4 free action: rearrange your own wildcard between groups. Not a play, own turn
// only. If moving it breaks a complete set, its buildings relocate (§4.5).
function handleRearrange(
  draft: GameState,
  cardId: CardId,
  toSet: SetId,
  events: GameEvent[],
): Result<void> {
  const guard = requirePlaying(draft);
  if (!guard.ok) {
    return guard;
  }
  const player = current(draft);
  const fromSet = findWildcardGroup(draft, player.id, cardId);
  if (fromSet === null) {
    return fail('CARD_NOT_ON_TABLE', `wildcard ${cardId} is not in your property area`);
  }
  const card = getCard(draft, cardId);
  if (!canPlaceInSet(card, toSet)) {
    return fail('WRONG_COLOR', `wildcard ${cardId} cannot join ${toSet}`);
  }
  removeId(player.properties[fromSet].cards, cardId);
  player.properties[toSet].cards.push(cardId);
  events.push({ type: 'WildcardRearranged', player: player.id, cardId, fromSet, toSet });
  events.push(...relocateOrphanedBuildings(draft, player.id));
  return ok(undefined);
}

// --- action cards ----------------------------------------------------------

function handlePlayAction(
  draft: GameState,
  cardId: CardId,
  params: ActionParams,
  events: GameEvent[],
): Result<void> {
  const guard = requirePlay(draft);
  if (!guard.ok) {
    return guard;
  }
  const player = current(draft);
  if (!player.hand.includes(cardId)) {
    return fail('CARD_NOT_IN_HAND', `card ${cardId} is not in your hand`);
  }
  const card = getCard(draft, cardId);
  if (card.kind !== 'action' || card.action !== params.action) {
    return fail('WRONG_CARD', 'card does not match the requested action');
  }

  switch (params.action) {
    case 'aageBadho':
      return playAageBadho(draft, cardId, events);
    case 'makaan':
      return playMakaan(draft, cardId, params.set, events);
    case 'haveli':
      return playHaveli(draft, cardId, params.set, events);
    case 'vasooli':
      return playCharge(draft, cardId, [params.target], 5, 'vasooli', events);
    case 'shagun':
      return playCharge(draft, cardId, opponents(draft, player.id), 2, 'shagun', events);
    case 'kabza':
      return playKabza(draft, cardId, params.target, params.set, events);
    case 'haathKiSafai':
      return playHaathKiSafai(draft, cardId, params.target, params.cardId, events);
    case 'adlaBadli':
      return playAdlaBadli(draft, cardId, params, events);
    default:
      return fail('UNKNOWN_ACTION', 'unknown action card');
  }
}

// §5: draw 2 immediately. Consumes a play; the card is discarded.
function playAageBadho(draft: GameState, cardId: CardId, events: GameEvent[]): Result<void> {
  const player = current(draft);
  removeId(player.hand, cardId);
  draft.discardPile.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'ActionPlayed', player: player.id, cardId, action: 'aageBadho' });
  drawCards(draft, player.id, 2, events);
  return ok(undefined);
}

// §5: place a MAKAAN on your complete set (never Junctions/Utilities), max one.
function playMakaan(draft: GameState, cardId: CardId, set: SetId, events: GameEvent[]): Result<void> {
  const player = current(draft);
  const group = player.properties[set];
  if (set === 'junction' || set === 'utility') {
    return fail('NO_BUILDING_HERE', 'Junctions and Utilities cannot hold buildings');
  }
  if (!isSetComplete(group)) {
    return fail('SET_INCOMPLETE', 'a building needs a complete set');
  }
  if (hasMakaan(draft, group)) {
    return fail('MAKAAN_EXISTS', 'this set already has a makaan');
  }
  removeId(player.hand, cardId);
  group.buildings.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'BuildingPlaced', player: player.id, cardId, set, building: 'makaan' });
  return ok(undefined);
}

// §5: place a HAVELI on a complete set that already has a makaan, max one.
function playHaveli(draft: GameState, cardId: CardId, set: SetId, events: GameEvent[]): Result<void> {
  const player = current(draft);
  const group = player.properties[set];
  if (!isSetComplete(group)) {
    return fail('SET_INCOMPLETE', 'a building needs a complete set');
  }
  if (!hasMakaan(draft, group)) {
    return fail('NO_MAKAAN', 'a haveli needs a makaan first');
  }
  if (hasHaveli(draft, group)) {
    return fail('HAVELI_EXISTS', 'this set already has a haveli');
  }
  removeId(player.hand, cardId);
  group.buildings.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'BuildingPlaced', player: player.id, cardId, set, building: 'haveli' });
  return ok(undefined);
}

// §5: VASOOLI/SHAGUN — open one independent charge frame per target. The source
// card is discarded immediately (you spent it), consuming one play.
function playCharge(
  draft: GameState,
  cardId: CardId,
  targets: PlayerId[],
  amount: number,
  actionName: string,
  events: GameEvent[],
): Result<void> {
  const player = current(draft);
  removeId(player.hand, cardId);
  draft.discardPile.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'ActionPlayed', player: player.id, cardId, action: actionName });
  for (const target of targets) {
    openInterrupt(draft, player.id, target, { kind: 'charge', amount }, events);
  }
  return ok(undefined);
}

// §5: KABZA — take a target's complete set (with buildings). Opens a response window.
function playKabza(
  draft: GameState,
  cardId: CardId,
  target: PlayerId,
  set: SetId,
  events: GameEvent[],
): Result<void> {
  const player = current(draft);
  if (!isSetComplete(draft.players[target]!.properties[set])) {
    return fail('SET_INCOMPLETE', 'KABZA can only take a complete set');
  }
  removeId(player.hand, cardId);
  draft.discardPile.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'ActionPlayed', player: player.id, cardId, action: 'kabza' });
  openInterrupt(draft, player.id, target, { kind: 'stealSet', set }, events);
  return ok(undefined);
}

// §5: HAATH KI SAFAI — take one property from a target, never from a complete set.
function playHaathKiSafai(
  draft: GameState,
  cardId: CardId,
  target: PlayerId,
  targetCardId: CardId,
  events: GameEvent[],
): Result<void> {
  const set = findPropertyGroup(draft, target, targetCardId);
  if (set === null) {
    return fail('CARD_NOT_ON_TABLE', 'that property is not on the target table');
  }
  if (isSetComplete(draft.players[target]!.properties[set])) {
    return fail('SET_COMPLETE', 'cannot take from a complete set');
  }
  const player = current(draft);
  removeId(player.hand, cardId);
  draft.discardPile.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'ActionPlayed', player: player.id, cardId, action: 'haathKiSafai' });
  openInterrupt(draft, player.id, target, { kind: 'stealProperty', cardId: targetCardId }, events);
  return ok(undefined);
}

// §5: ADLA-BADLI — swap one of your properties with a target's. Neither may be in a
// complete set.
function playAdlaBadli(
  draft: GameState,
  cardId: CardId,
  params: Extract<ActionParams, { action: 'adlaBadli' }>,
  events: GameEvent[],
): Result<void> {
  const player = current(draft);
  const mySet = findPropertyGroup(draft, player.id, params.myCardId);
  const theirSet = findPropertyGroup(draft, params.target, params.theirCardId);
  if (mySet === null || theirSet === null) {
    return fail('CARD_NOT_ON_TABLE', 'both cards must be on the table');
  }
  if (isSetComplete(player.properties[mySet])) {
    return fail('SET_COMPLETE', 'cannot swap from your complete set');
  }
  if (isSetComplete(draft.players[params.target]!.properties[theirSet])) {
    return fail('SET_COMPLETE', 'cannot swap from their complete set');
  }
  removeId(player.hand, cardId);
  draft.discardPile.push(cardId);
  draft.playsRemaining -= 1;
  events.push({ type: 'ActionPlayed', player: player.id, cardId, action: 'adlaBadli' });
  openInterrupt(
    draft,
    player.id,
    params.target,
    { kind: 'swap', myCardId: params.myCardId, theirCardId: params.theirCardId },
    events,
  );
  return ok(undefined);
}

// §5: KIRAYA — charge rent for a colour you own. DUGNA cards attach to double it;
// each attached DUGNA consumes an extra play (§5, edge #11).
function handlePlayKiraya(
  draft: GameState,
  action: Extract<Action, { type: 'PLAY_KIRAYA' }>,
  events: GameEvent[],
): Result<void> {
  if (draft.pendingInterrupts.length > 0) {
    return fail('INTERRUPT_OPEN', 'resolve the pending action first');
  }
  if (draft.phase !== 'playing') {
    return fail('WRONG_PHASE', 'not your play phase');
  }
  const player = current(draft);
  if (!player.hand.includes(action.cardId)) {
    return fail('CARD_NOT_IN_HAND', `card ${action.cardId} is not in your hand`);
  }
  const card = getCard(draft, action.cardId);
  if (card.kind !== 'kiraya') {
    return fail('WRONG_CARD', 'not a KIRAYA card');
  }

  // Colour must be allowed by the card and owned by the player (§5, edge #12).
  const colorAllowed = card.colors === 'ANY' || card.colors.includes(action.color);
  if (!colorAllowed) {
    return fail('WRONG_COLOR', 'this KIRAYA cannot charge that colour');
  }
  if (player.properties[action.color].cards.length === 0) {
    return fail('COLOR_NOT_OWNED', 'you must own a property of the chosen colour');
  }

  // Validate DUGNA attachments.
  const dugna = validateDugna(draft, action.dugnaCardIds);
  if (!dugna.ok) {
    return dugna;
  }
  const dugnaCount = action.dugnaCardIds.length;
  if (dugnaCount > draft.rules.maxDugnaPerCharge) {
    return fail('TOO_MANY_DUGNA', `at most ${draft.rules.maxDugnaPerCharge} DUGNA per charge`);
  }
  const playsNeeded = 1 + dugnaCount;
  if (draft.playsRemaining < playsNeeded) {
    return fail('NO_PLAYS', 'not enough plays remaining for KIRAYA + DUGNA');
  }

  // Targeting: wild KIRAYA hits one chosen opponent; a colour-pair hits all.
  const targeted = card.targeted;
  let targets: PlayerId[];
  if (targeted) {
    if (action.target === null || action.target === player.id) {
      return fail('BAD_TARGET', 'wild KIRAYA needs one opponent target');
    }
    targets = [action.target];
  } else {
    if (action.target !== null) {
      return fail('BAD_TARGET', 'colour-pair KIRAYA hits all opponents');
    }
    targets = opponents(draft, player.id);
  }

  const amount = kirayaFor(draft, player.id, action.color, dugnaCount);

  // Spend the KIRAYA card and the DUGNA cards, then open the charges.
  removeId(player.hand, action.cardId);
  draft.discardPile.push(action.cardId);
  for (const dugnaId of action.dugnaCardIds) {
    removeId(player.hand, dugnaId);
    draft.discardPile.push(dugnaId);
  }
  draft.playsRemaining -= playsNeeded;
  events.push({ type: 'ActionPlayed', player: player.id, cardId: action.cardId, action: 'kiraya' });
  for (const target of targets) {
    openInterrupt(draft, player.id, target, { kind: 'charge', amount }, events);
  }
  return ok(undefined);
}

function validateDugna(draft: GameState, dugnaCardIds: CardId[]): Result<void> {
  const player = current(draft);
  const seen = new Set<CardId>();
  for (const id of dugnaCardIds) {
    if (seen.has(id)) {
      return fail('DUGNA_DUPLICATE', 'a DUGNA card was listed twice');
    }
    seen.add(id);
    if (!player.hand.includes(id)) {
      return fail('CARD_NOT_IN_HAND', `DUGNA ${id} is not in your hand`);
    }
    const card = getCard(draft, id);
    if (card.kind !== 'action' || card.action !== 'dugna') {
      return fail('NOT_DUGNA', `card ${id} is not a DUGNA`);
    }
  }
  return ok(undefined);
}

// --- interrupt responses ---------------------------------------------------

// Opens a charge/steal frame: the target must respond before the turn continues.
function openInterrupt(
  draft: GameState,
  origin: PlayerId,
  target: PlayerId,
  effect: Interrupt['effect'],
  events: GameEvent[],
): void {
  const id = `int_${draft.nextInterruptId}`;
  draft.nextInterruptId += 1;
  draft.pendingInterrupts.push({
    id,
    origin,
    target,
    effect,
    nahiChain: [],
    responder: target,
    status: 'awaitingResponse',
    pendingReceive: [],
  });
  events.push({ type: 'ChargeOpened', interruptId: id, origin, target });
}

// §5: NAHI CHALEGA. Adds to the chain and flips who responds next. Never consumes a
// play, and works off-turn (the responder need not be the current player).
function handleNahiChalega(draft: GameState, cardId: CardId, events: GameEvent[]): Result<void> {
  const frame = topInterrupt(draft);
  if (!frame || frame.status !== 'awaitingResponse') {
    return fail('NO_RESPONSE_WINDOW', 'there is nothing to cancel right now');
  }
  const responder = draft.players[frame.responder]!;
  if (!responder.hand.includes(cardId)) {
    return fail('CARD_NOT_IN_HAND', `NAHI CHALEGA ${cardId} is not in your hand`);
  }
  const card = getCard(draft, cardId);
  if (card.kind !== 'action' || card.action !== 'nahiChalega') {
    return fail('NOT_NAHI', `card ${cardId} is not a NAHI CHALEGA`);
  }
  removeId(responder.hand, cardId);
  frame.nahiChain.push(cardId);
  // The other party may now cancel back (LIFO). Flip between origin and target.
  frame.responder = frame.responder === frame.target ? frame.origin : frame.target;
  events.push({
    type: 'NahiChalegaPlayed',
    interruptId: frame.id,
    player: responder.id,
    chainLength: frame.nahiChain.length,
  });
  return ok(undefined);
}

// The responder declines to cancel further ⇒ settle the frame by parity (§5).
function handleAllow(draft: GameState, events: GameEvent[]): Result<void> {
  const frame = topInterrupt(draft);
  if (!frame || frame.status !== 'awaitingResponse') {
    return fail('NO_RESPONSE_WINDOW', 'there is nothing to allow right now');
  }

  // The NAHI cards are spent regardless of outcome.
  draft.discardPile.push(...frame.nahiChain);
  const stands = chargeStandsByParity(frame.nahiChain.length);
  frame.nahiChain = [];

  if (!stands) {
    events.push({ type: 'InterruptCancelled', interruptId: frame.id });
    draft.pendingInterrupts.pop();
    return ok(undefined);
  }

  if (frame.effect.kind === 'charge') {
    // The target now owes the amount; move to the payment window.
    frame.status = 'awaitingPayment';
    frame.responder = frame.target;
    return ok(undefined);
  }

  // Steal / swap: apply now. If a wildcard changed hands, the receiver must place it.
  const received = applyEffect(draft, frame, events);
  if (received.length > 0) {
    frame.status = 'awaitingReceive';
    frame.pendingReceive = received;
    frame.responder = received[0]!.receiver;
    return ok(undefined);
  }
  events.push({ type: 'InterruptResolved', interruptId: frame.id });
  draft.pendingInterrupts.pop();
  return ok(undefined);
}

// Applies a stand-ing steal/swap effect; returns any wildcards awaiting placement.
function applyEffect(
  draft: GameState,
  frame: Interrupt,
  events: GameEvent[],
): Interrupt['pendingReceive'] {
  switch (frame.effect.kind) {
    case 'stealSet': {
      const set = frame.effect.set;
      const from = draft.players[frame.target]!;
      const to = draft.players[frame.origin]!;
      to.properties[set].cards.push(...from.properties[set].cards);
      to.properties[set].buildings.push(...from.properties[set].buildings);
      from.properties[set] = { set, cards: [], buildings: [] };
      events.push({ type: 'SetStolen', from: frame.target, to: frame.origin, set });
      return [];
    }
    case 'stealProperty':
      return transferProperty(draft, frame.target, frame.origin, frame.effect.cardId, events, {
        stolen: true,
      });
    case 'swap': {
      const toTarget = transferProperty(
        draft,
        frame.origin,
        frame.target,
        frame.effect.myCardId,
        events,
        { stolen: false },
      );
      const toOrigin = transferProperty(
        draft,
        frame.target,
        frame.origin,
        frame.effect.theirCardId,
        events,
        { stolen: false },
      );
      events.push({
        type: 'PropertiesSwapped',
        a: frame.origin,
        b: frame.target,
        aCardId: frame.effect.myCardId,
        bCardId: frame.effect.theirCardId,
      });
      return [...toTarget, ...toOrigin];
    }
    default:
      return [];
  }
}

// Moves one property/wildcard from `from` to `to`. A fixed property lands in its
// set; a colour wildcard becomes a pending receive (the receiver chooses the group).
function transferProperty(
  draft: GameState,
  from: PlayerId,
  to: PlayerId,
  cardId: CardId,
  events: GameEvent[],
  opts: { stolen: boolean },
): Interrupt['pendingReceive'] {
  const set = findPropertyGroup(draft, from, cardId);
  if (set !== null) {
    removeId(draft.players[from]!.properties[set].cards, cardId);
  }
  const card = getCard(draft, cardId);
  if (opts.stolen) {
    events.push({ type: 'PropertyStolen', from, to, cardId });
  }
  // A fixed property lands in its own set. Any wildcard (colour or ANY) waits for
  // the receiver to choose its group (§4.5, edge #19).
  if (card.kind === 'property') {
    draft.players[to]!.properties[card.set].cards.push(cardId);
    events.push({ type: 'CardReceived', player: to, cardId, set: card.set });
    return [];
  }
  return [{ cardId, receiver: to }];
}

// §4.5: the target chooses which table cards to hand over.
function handlePay(draft: GameState, cardIds: CardId[], events: GameEvent[]): Result<void> {
  const frame = topInterrupt(draft);
  if (!frame || frame.status !== 'awaitingPayment') {
    return fail('NO_PAYMENT_DUE', 'no payment is due right now');
  }
  if (frame.effect.kind !== 'charge') {
    return fail('NO_PAYMENT_DUE', 'this interrupt is not a charge');
  }
  const request: PaymentRequest = {
    debtor: frame.target,
    creditor: frame.origin,
    amountOwed: frame.effect.amount,
  };
  const valid = validatePayment(draft, request, cardIds);
  if (!valid.ok) {
    return valid;
  }
  const outcome = applyPayment(draft, request, cardIds);
  events.push(...outcome.events);
  if (outcome.received.length > 0) {
    frame.status = 'awaitingReceive';
    frame.pendingReceive = outcome.received;
    frame.responder = outcome.received[0]!.receiver;
    return ok(undefined);
  }
  events.push({ type: 'InterruptResolved', interruptId: frame.id });
  draft.pendingInterrupts.pop();
  return ok(undefined);
}

// §4.5 / edge #19: the receiver places a received wildcard into a colour group.
function handlePlaceReceived(
  draft: GameState,
  cardId: CardId,
  set: SetId,
  events: GameEvent[],
): Result<void> {
  const frame = topInterrupt(draft);
  if (!frame || frame.status !== 'awaitingReceive') {
    return fail('NOTHING_TO_PLACE', 'no received card is awaiting placement');
  }
  const head = frame.pendingReceive[0];
  if (!head || head.cardId !== cardId) {
    return fail('WRONG_RECEIVE', 'place the received cards in order');
  }
  const card = getCard(draft, cardId);
  if (!canPlaceInSet(card, set)) {
    return fail('WRONG_COLOR', `card ${cardId} cannot join ${set}`);
  }
  draft.players[head.receiver]!.properties[set].cards.push(cardId);
  events.push({ type: 'CardReceived', player: head.receiver, cardId, set });
  frame.pendingReceive.shift();
  if (frame.pendingReceive.length === 0) {
    events.push({ type: 'InterruptResolved', interruptId: frame.id });
    draft.pendingInterrupts.pop();
  } else {
    frame.responder = frame.pendingReceive[0]!.receiver;
  }
  return ok(undefined);
}

// --- shared guards and lookups --------------------------------------------

function requirePlaying(draft: GameState): Result<void> {
  if (draft.pendingInterrupts.length > 0) {
    return fail('INTERRUPT_OPEN', 'resolve the pending action first');
  }
  if (draft.phase !== 'playing') {
    return fail('WRONG_PHASE', 'not your play phase');
  }
  return ok(undefined);
}

function requirePlay(draft: GameState): Result<void> {
  const playing = requirePlaying(draft);
  if (!playing.ok) {
    return playing;
  }
  if (draft.playsRemaining <= 0) {
    return fail('NO_PLAYS', 'no plays remaining this turn');
  }
  return ok(undefined);
}

function current(draft: GameState) {
  return draft.players[draft.currentPlayerIndex]!;
}

function topInterrupt(draft: GameState): Interrupt | undefined {
  return draft.pendingInterrupts[draft.pendingInterrupts.length - 1];
}

function opponents(draft: GameState, playerId: PlayerId): PlayerId[] {
  const list: PlayerId[] = [];
  for (const player of draft.players) {
    if (player.id !== playerId) {
      list.push(player.id);
    }
  }
  return list;
}

// Which group holds this property/wildcard on a player's table, or null.
function findPropertyGroup(draft: GameState, playerId: PlayerId, cardId: CardId): SetId | null {
  const player = draft.players[playerId]!;
  for (const group of Object.values(player.properties) as PropertyGroup[]) {
    if (group.cards.includes(cardId)) {
      return group.set;
    }
  }
  return null;
}

// Like findPropertyGroup, but only returns the group if the card is a wildcard.
function findWildcardGroup(draft: GameState, playerId: PlayerId, cardId: CardId): SetId | null {
  const set = findPropertyGroup(draft, playerId, cardId);
  if (set === null) {
    return null;
  }
  return getCard(draft, cardId).kind === 'wildcard' ? set : null;
}

function removeId(list: CardId[], id: CardId): boolean {
  const index = list.indexOf(id);
  if (index === -1) {
    return false;
  }
  list.splice(index, 1);
  return true;
}

// Deep-clone the mutable parts of the state; the card registry is immutable & shared.
function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      id: player.id,
      hand: [...player.hand],
      bank: [...player.bank],
      properties: cloneProperties(player.properties),
    })),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    pendingInterrupts: state.pendingInterrupts.map((frame) => ({
      ...frame,
      nahiChain: [...frame.nahiChain],
      pendingReceive: frame.pendingReceive.map((item) => ({ ...item })),
    })),
    cards: state.cards,
  };
}

function cloneProperties(
  properties: Record<SetId, PropertyGroup>,
): Record<SetId, PropertyGroup> {
  const copy = {} as Record<SetId, PropertyGroup>;
  for (const set of Object.keys(properties) as SetId[]) {
    const group = properties[set];
    copy[set] = { set: group.set, cards: [...group.cards], buildings: [...group.buildings] };
  }
  return copy;
}
