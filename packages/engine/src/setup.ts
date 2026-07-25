/**
 * Game setup (§4.2): shuffle the 106-card deck with a seed, deal 5 to each
 * player, the rest becomes the draw pile, discard starts empty. Everything is
 * seeded, so the same (players, seed) always produces the same starting game.
 */
import type { SetId } from './types';
import { SETS } from './theme';
import { buildDeck } from './deck';
import { shuffleWithState, initialRngState } from './rng';
import { DEFAULT_RULES } from './rules';
import type { Rules } from './rules';
import type { CardId, GameEvent, GameState, PlayerState, PropertyGroup } from './state';

export interface NewGameOptions {
  players: number; // 2..4
  seed: number;
  rules?: Rules;
}

// An empty property area: every colour starts with an empty list of groups.
// Groups are created on demand as cards are placed (§ overflow).
function emptyPropertyArea(): Record<SetId, PropertyGroup[]> {
  const area = {} as Record<SetId, PropertyGroup[]>;
  for (const set of Object.keys(SETS) as SetId[]) {
    area[set] = [];
  }
  return area;
}

export function createGame(options: NewGameOptions): { state: GameState; events: GameEvent[] } {
  const rules = options.rules ?? DEFAULT_RULES;

  // Build the fixed card registry, then shuffle a list of ids with the seed.
  const deck = buildDeck();
  const cards: Record<CardId, (typeof deck)[number]> = {};
  for (const card of deck) {
    cards[card.id] = card;
  }
  const shuffle = shuffleWithState(
    deck.map((card) => card.id),
    initialRngState(options.seed),
  );
  const shuffledIds = shuffle.items;

  // Deal 5 to each player from the top of the pile (the end of the array).
  const players: PlayerState[] = [];
  let cursor = shuffledIds.length;
  for (let index = 0; index < options.players; index++) {
    const hand = shuffledIds.slice(cursor - 5, cursor);
    cursor -= 5;
    players.push({ id: index, hand, bank: [], properties: emptyPropertyArea() });
  }

  // The remainder (bottom-through-cursor) is the draw pile; top of pile = last id.
  const drawPile = shuffledIds.slice(0, cursor);

  const state: GameState = {
    rules,
    cards,
    players,
    drawPile,
    discardPile: [],
    currentPlayerIndex: 0,
    playsRemaining: rules.playsPerTurn,
    turnCount: 1,
    phase: 'awaitingDraw',
    pendingInterrupts: [],
    nextInterruptId: 1,
    rngState: shuffle.state,
    winnerIndex: null,
  };

  const events: GameEvent[] = [
    { type: 'GameStarted', playerCount: options.players, seed: options.seed },
    { type: 'TurnStarted', player: 0, turn: 1 },
  ];
  return { state, events };
}
