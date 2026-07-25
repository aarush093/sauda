/**
 * Hidden-information view (§8.1). Bots and the UI must never see raw GameState —
 * they see only what a given player may know: their own hand, all public zones,
 * and opponents' hand *counts* (not their cards).
 */
import type { SetId } from './types';
import { SETS } from './theme';
import type { CardId, GameState, PlayerId, PropertyGroup, TurnPhase } from './state';

const ALL_SETS = Object.keys(SETS) as SetId[];

// What one player can see about an opponent: public piles + how many cards they hold.
export interface OpponentView {
  id: PlayerId;
  handCount: number; // count only — the cards themselves stay hidden
  bank: CardId[];
  properties: Record<SetId, PropertyGroup>;
}

export interface Observation {
  me: PlayerId;
  phase: TurnPhase;
  currentPlayer: PlayerId;
  playsRemaining: number;
  turnCount: number;
  myHand: CardId[]; // full — it is mine
  myBank: CardId[];
  myProperties: Record<SetId, PropertyGroup>;
  opponents: OpponentView[];
  drawPileCount: number; // count only — order is hidden
  discardPile: CardId[]; // discard is public
  winnerIndex: number | null;
}

export function observe(state: GameState, playerId: PlayerId): Observation {
  const me = state.players[playerId]!;

  const opponents: OpponentView[] = [];
  for (const player of state.players) {
    if (player.id === playerId) {
      continue;
    }
    opponents.push({
      id: player.id,
      handCount: player.hand.length,
      bank: [...player.bank],
      properties: cloneProperties(player.properties),
    });
  }

  return {
    me: playerId,
    phase: state.phase,
    currentPlayer: state.currentPlayerIndex,
    playsRemaining: state.playsRemaining,
    turnCount: state.turnCount,
    myHand: [...me.hand],
    myBank: [...me.bank],
    myProperties: cloneProperties(me.properties),
    opponents,
    drawPileCount: state.drawPile.length,
    discardPile: [...state.discardPile],
    winnerIndex: state.winnerIndex,
  };
}

function cloneProperties(
  properties: Record<SetId, PropertyGroup>,
): Record<SetId, PropertyGroup> {
  const copy = {} as Record<SetId, PropertyGroup>;
  for (const set of ALL_SETS) {
    const group = properties[set];
    copy[set] = { set: group.set, cards: [...group.cards], buildings: [...group.buildings] };
  }
  return copy;
}
