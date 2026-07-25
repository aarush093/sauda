/**
 * legalActions(state, playerId) — the single source of truth for what a player may
 * do (§8.1). The UI renders only these; bots choose only from these. Every entry
 * here must be accepted by `reduce`, and `reduce` must reject everything not here
 * (the one exception is the payment SUBSET — see the payment note below).
 *
 * The most important rule: while an interrupt is open, ONLY the current responder
 * has any legal actions. That is what freezes the turn during a charge and what
 * lets NAHI CHALEGA be played off-turn.
 */
import type { SetId } from './types';
import { SETS } from './theme';
import type { Action } from './actions';
import type { CardId, GameState, PlayerId, PropertyGroup } from './state';
import {
  getCard,
  hasHaveli,
  hasMakaan,
  hasThreeCompleteSets,
  isSetComplete,
  placeableSets,
} from './sets';
import { suggestPayment } from './payment';
import type { PaymentRequest } from './payment';

const ALL_SETS = Object.keys(SETS) as SetId[];

export function legalActions(state: GameState, playerId: PlayerId): Action[] {
  if (state.phase === 'gameOver') {
    return [];
  }
  if (state.pendingInterrupts.length > 0) {
    return interruptActions(state, playerId);
  }
  if (playerId !== state.currentPlayerIndex) {
    return []; // only the current player acts when no interrupt is open
  }
  switch (state.phase) {
    case 'awaitingDraw':
      return awaitingDrawActions(state, playerId);
    case 'playing':
      return playingActions(state, playerId);
    case 'awaitingDiscard':
      return discardActions(state, playerId);
    default:
      return [];
  }
}

// --- interrupt windows -----------------------------------------------------

function interruptActions(state: GameState, playerId: PlayerId): Action[] {
  const frame = state.pendingInterrupts[state.pendingInterrupts.length - 1]!;
  if (playerId !== frame.responder) {
    return [];
  }
  const responder = state.players[playerId]!;

  if (frame.status === 'awaitingResponse') {
    const actions: Action[] = [{ type: 'RESPOND_ALLOW' }];
    for (const cardId of responder.hand) {
      const card = getCard(state, cardId);
      if (card.kind === 'action' && card.action === 'nahiChalega') {
        actions.push({ type: 'RESPOND_NAHI_CHALEGA', cardId });
      }
    }
    return actions;
  }

  if (frame.status === 'awaitingPayment' && frame.effect.kind === 'charge') {
    // PAYMENT NOTE (see DECISIONS.md): we return ONE suggested selection rather than
    // enumerating every subset (exponential). The UI reads the frame for the amount
    // and payable set to build alternatives; reduce validates any submission.
    const request: PaymentRequest = {
      debtor: frame.target,
      creditor: frame.origin,
      amountOwed: frame.effect.amount,
    };
    return [{ type: 'RESPOND_PAY', cardIds: suggestPayment(state, request) }];
  }

  if (frame.status === 'awaitingReceive') {
    const head = frame.pendingReceive[0];
    if (!head || head.receiver !== playerId) {
      return [];
    }
    const card = getCard(state, head.cardId);
    return placeableSets(card).map((set) => ({
      type: 'RESPOND_PLACE_RECEIVED',
      cardId: head.cardId,
      set,
    }));
  }

  return [];
}

// --- normal turn phases ----------------------------------------------------

function awaitingDrawActions(state: GameState, playerId: PlayerId): Action[] {
  const actions: Action[] = [{ type: 'DRAW' }];
  if (hasThreeCompleteSets(state, playerId)) {
    actions.push({ type: 'DECLARE_WIN' }); // §4.1 win check at turn start
  }
  return actions;
}

function discardActions(state: GameState, playerId: PlayerId): Action[] {
  // Only relevant while over the hand limit (§4.4 step 4).
  const player = state.players[playerId]!;
  if (player.hand.length <= state.rules.handLimit) {
    return [];
  }
  return player.hand.map((cardId) => ({ type: 'DISCARD', cardId }));
}

function playingActions(state: GameState, playerId: PlayerId): Action[] {
  const player = state.players[playerId]!;
  const actions: Action[] = [];

  if (hasThreeCompleteSets(state, playerId)) {
    actions.push({ type: 'DECLARE_WIN' });
  }

  // Free (not a play): rearrange your own wildcards between groups.
  actions.push(...rearrangeActions(state, playerId));

  // The three plays, only while you have plays left.
  if (state.playsRemaining > 0) {
    for (const cardId of player.hand) {
      actions.push(...playsForHandCard(state, playerId, cardId));
    }
  }

  actions.push({ type: 'END_TURN' });
  return actions;
}

function rearrangeActions(state: GameState, playerId: PlayerId): Action[] {
  const player = state.players[playerId]!;
  const actions: Action[] = [];
  for (const group of Object.values(player.properties) as PropertyGroup[]) {
    for (const cardId of group.cards) {
      const card = getCard(state, cardId);
      if (card.kind !== 'wildcard') {
        continue;
      }
      for (const toSet of placeableSets(card)) {
        if (toSet !== group.set) {
          actions.push({ type: 'REARRANGE_WILDCARD', cardId, toSet });
        }
      }
    }
  }
  return actions;
}

// All plays a single hand card enables. One card can enable several (e.g. a wildcard
// can join any of its colours).
function playsForHandCard(state: GameState, playerId: PlayerId, cardId: CardId): Action[] {
  const card = getCard(state, cardId);
  const actions: Action[] = [];

  if (card.kind === 'money' || card.kind === 'action' || card.kind === 'kiraya') {
    actions.push({ type: 'BANK_CARD', cardId });
  }
  if (card.kind === 'property' || card.kind === 'wildcard') {
    for (const set of placeableSets(card)) {
      actions.push({ type: 'PLACE_PROPERTY', cardId, set });
    }
  }
  if (card.kind === 'action') {
    actions.push(...actionCardPlays(state, playerId, cardId, card.action));
  }
  if (card.kind === 'kiraya') {
    actions.push(...kirayaPlays(state, playerId, cardId));
  }
  return actions;
}

function actionCardPlays(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
  action: string,
): Action[] {
  const actions: Action[] = [];
  const others = opponents(state, playerId);

  switch (action) {
    case 'aageBadho':
      actions.push({ type: 'PLAY_ACTION', cardId, params: { action: 'aageBadho' } });
      break;
    case 'makaan':
      for (const set of buildableSets(state, playerId, 'makaan')) {
        actions.push({ type: 'PLAY_ACTION', cardId, params: { action: 'makaan', set } });
      }
      break;
    case 'haveli':
      for (const set of buildableSets(state, playerId, 'haveli')) {
        actions.push({ type: 'PLAY_ACTION', cardId, params: { action: 'haveli', set } });
      }
      break;
    case 'vasooli':
      for (const target of others) {
        actions.push({ type: 'PLAY_ACTION', cardId, params: { action: 'vasooli', target } });
      }
      break;
    case 'shagun':
      if (others.length > 0) {
        actions.push({ type: 'PLAY_ACTION', cardId, params: { action: 'shagun' } });
      }
      break;
    case 'kabza':
      for (const target of others) {
        for (const set of completeSetsOf(state, target)) {
          actions.push({ type: 'PLAY_ACTION', cardId, params: { action: 'kabza', target, set } });
        }
      }
      break;
    case 'haathKiSafai':
      for (const target of others) {
        for (const stealCardId of stealableProperties(state, target)) {
          actions.push({
            type: 'PLAY_ACTION',
            cardId,
            params: { action: 'haathKiSafai', target, cardId: stealCardId },
          });
        }
      }
      break;
    case 'adlaBadli':
      for (const myCardId of stealableProperties(state, playerId)) {
        for (const target of others) {
          for (const theirCardId of stealableProperties(state, target)) {
            actions.push({
              type: 'PLAY_ACTION',
              cardId,
              params: { action: 'adlaBadli', myCardId, target, theirCardId },
            });
          }
        }
      }
      break;
    default:
      // 'dugna' and 'nahiChalega' have no standalone play; they attach / respond.
      break;
  }
  return actions;
}

// KIRAYA plays: for each colour you own, and each legal DUGNA count, produce a play.
function kirayaPlays(state: GameState, playerId: PlayerId, cardId: CardId): Action[] {
  const card = getCard(state, cardId);
  if (card.kind !== 'kiraya') {
    return [];
  }
  const me = state.players[playerId]!;
  const actions: Action[] = [];

  const colors = card.colors === 'ANY' ? ALL_SETS : card.colors;
  const ownedColors = colors.filter((color) => me.properties[color].cards.length > 0);

  // DUGNA attachments: identical cards, so a canonical "first N in hand" is enough.
  const dugnaInHand = me.hand.filter((id) => {
    const c = getCard(state, id);
    return c.kind === 'action' && c.action === 'dugna';
  });
  const maxDugna = Math.min(
    state.rules.maxDugnaPerCharge,
    dugnaInHand.length,
    state.playsRemaining - 1, // 1 play for the KIRAYA itself
  );

  for (const color of ownedColors) {
    for (let dugnaCount = 0; dugnaCount <= maxDugna; dugnaCount++) {
      const dugnaCardIds = dugnaInHand.slice(0, dugnaCount);
      if (card.targeted) {
        for (const target of opponents(state, playerId)) {
          actions.push({ type: 'PLAY_KIRAYA', cardId, color, target, dugnaCardIds });
        }
      } else {
        actions.push({ type: 'PLAY_KIRAYA', cardId, color, target: null, dugnaCardIds });
      }
    }
  }
  return actions;
}

// --- small read helpers ----------------------------------------------------

function opponents(state: GameState, playerId: PlayerId): PlayerId[] {
  const list: PlayerId[] = [];
  for (const player of state.players) {
    if (player.id !== playerId) {
      list.push(player.id);
    }
  }
  return list;
}

function completeSetsOf(state: GameState, playerId: PlayerId): SetId[] {
  const player = state.players[playerId]!;
  return ALL_SETS.filter((set) => isSetComplete(player.properties[set]));
}

// Properties that can be stolen/swapped: those NOT in a complete set (§5).
function stealableProperties(state: GameState, playerId: PlayerId): CardId[] {
  const player = state.players[playerId]!;
  const ids: CardId[] = [];
  for (const set of ALL_SETS) {
    const group = player.properties[set];
    if (!isSetComplete(group)) {
      ids.push(...group.cards);
    }
  }
  return ids;
}

// Sets where a building can be placed: complete, not Junctions/Utilities, and the
// prerequisite building state matches (§5).
function buildableSets(
  state: GameState,
  playerId: PlayerId,
  building: 'makaan' | 'haveli',
): SetId[] {
  const player = state.players[playerId]!;
  const result: SetId[] = [];
  for (const set of ALL_SETS) {
    if (set === 'junction' || set === 'utility') {
      continue;
    }
    const group = player.properties[set];
    if (!isSetComplete(group)) {
      continue;
    }
    if (building === 'makaan' && !hasMakaan(state, group)) {
      result.push(set);
    }
    if (building === 'haveli' && hasMakaan(state, group) && !hasHaveli(state, group)) {
      result.push(set);
    }
  }
  return result;
}
