/**
 * Test-only scenario builder. NOT exported from index.ts — this is a fixture
 * helper for the test suites, so we can craft an exact GameState (specific cards
 * in specific zones) and let every unused card fall into the draw pile, keeping
 * all 106 cards accounted for automatically.
 *
 * Card ids are structural (e.g. `prop_mumbai_0`, `action_kabza_0`), so tests can
 * name the cards they want directly and readably.
 */
import type { SetId } from './types';
import { SETS } from './theme';
import { buildDeck } from './deck';
import { DEFAULT_RULES } from './rules';
import type { Rules } from './rules';
import type { Card } from './types';
import type { CardId, GameState, PlayerState, PropertyGroup, TurnPhase } from './state';

const ALL_SETS = Object.keys(SETS) as SetId[];

interface GroupSpec {
  cards?: CardId[];
  buildings?: CardId[];
}
interface PlayerSpec {
  hand?: CardId[];
  bank?: CardId[];
  // A colour maps to one group (the common case) or several (to set up overflow).
  properties?: Partial<Record<SetId, GroupSpec | GroupSpec[]>>;
}
export interface StateSpec {
  players: PlayerSpec[];
  currentPlayerIndex?: number;
  phase?: TurnPhase;
  playsRemaining?: number;
  discardPile?: CardId[];
  rules?: Rules;
}

function emptyArea(): Record<SetId, PropertyGroup[]> {
  const area = {} as Record<SetId, PropertyGroup[]>;
  for (const set of ALL_SETS) {
    area[set] = [];
  }
  return area;
}

// Builds a GameState from a spec. Any card not explicitly placed lands in the draw
// pile, so the 106-card invariant always holds.
export function makeState(spec: StateSpec): GameState {
  const deck = buildDeck();
  const cards: Record<CardId, Card> = {};
  for (const card of deck) {
    cards[card.id] = card;
  }

  const used = new Set<CardId>();
  const claim = (id: CardId): CardId => {
    if (used.has(id)) {
      throw new Error(`card ${id} used twice in scenario`);
    }
    if (!(id in cards)) {
      throw new Error(`unknown card id in scenario: ${id}`);
    }
    used.add(id);
    return id;
  };

  const players: PlayerState[] = spec.players.map((playerSpec, index) => {
    const properties = emptyArea();
    if (playerSpec.properties) {
      for (const set of ALL_SETS) {
        const spec = playerSpec.properties[set];
        if (!spec) {
          continue;
        }
        const groupSpecs = Array.isArray(spec) ? spec : [spec];
        properties[set] = groupSpecs.map((groupSpec) => ({
          set,
          cards: (groupSpec.cards ?? []).map(claim),
          buildings: (groupSpec.buildings ?? []).map(claim),
        }));
      }
    }
    return {
      id: index,
      hand: (playerSpec.hand ?? []).map(claim),
      bank: (playerSpec.bank ?? []).map(claim),
      properties,
    };
  });

  const discardPile = (spec.discardPile ?? []).map(claim);
  const drawPile = deck.map((card) => card.id).filter((id) => !used.has(id));

  return {
    rules: spec.rules ?? DEFAULT_RULES,
    cards,
    players,
    drawPile,
    discardPile,
    currentPlayerIndex: spec.currentPlayerIndex ?? 0,
    playsRemaining: spec.playsRemaining ?? DEFAULT_RULES.playsPerTurn,
    turnCount: 1,
    phase: spec.phase ?? 'playing',
    pendingInterrupts: [],
    nextInterruptId: 1,
    rngState: 12345,
    winnerIndex: null,
  };
}

// Convenience: unwrap a reduce Result, throwing on failure (tests want the state).
import type { Action } from './actions';
import type { GameEvent, Result } from './state';
import { reduce } from './reduce';

export function expectOk(
  result: Result<{ state: GameState; events: GameEvent[] }>,
): { state: GameState; events: GameEvent[] } {
  if (!result.ok) {
    throw new Error(`expected ok, got violation: ${result.error.code} ${result.error.message}`);
  }
  return result.value;
}

// Apply one action and return the next state, throwing on any rule violation.
export function step(state: GameState, action: Action): GameState {
  return expectOk(reduce(state, action)).state;
}
