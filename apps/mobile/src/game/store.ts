/**
 * The single game store (zustand). It is a thin shell around @sauda/engine:
 *   - dispatch(action) === reduce(state, action)   (no rule ever lives in React)
 *   - stepBot() asks a HeuristicBot to pick from legalActions and dispatches it
 *   - hand-off logic hides the board between two different human players
 *
 * If any component needs to know "is this legal?" or "what happens next?", it
 * asks the engine (legalActions / observe / reduce), never this file.
 */
import { create } from 'zustand';
import { createGame, legalActions, mulberry32, observe, reduce } from '@sauda/engine';
import type { Action, GameEvent, GameState, Rng } from '@sauda/engine';
import { HeuristicBot } from '@sauda/bots';
import type { Bot, Difficulty } from '@sauda/bots';
import { describeEvent } from './labels';

export type SeatConfig = { kind: 'human' } | { kind: 'bot'; difficulty: Difficulty };

export interface GameConfig {
  seats: SeatConfig[];
  seed: number;
}

export interface LogLine {
  id: number;
  text: string;
}

export interface GameStore {
  state: GameState | null;
  seats: SeatConfig[];
  revealedSeat: number | null; // which human currently sees the board
  handoffSeat: number | null; // if set, show the pass-the-device overlay for this seat
  log: LogLine[];
  lastEvents: GameEvent[]; // events from the most recent applied action (drives the bot spotlight)
  newGame: (config: GameConfig) => void;
  dispatch: (action: Action) => void;
  stepBot: () => void;
  ackHandoff: () => void;
  reset: () => void;
}

// Whose move is it: the interrupt responder if a window is open, else the turn player.
export function actorOf(state: GameState): number {
  if (state.pendingInterrupts.length > 0) {
    return state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder;
  }
  return state.currentPlayerIndex;
}

// Bot machinery lives outside the reactive store (it must not trigger re-renders).
let botRng: Rng = mulberry32(1);
const botCache = new Map<Difficulty, Bot>();
function botFor(difficulty: Difficulty): Bot {
  const existing = botCache.get(difficulty);
  if (existing) {
    return existing;
  }
  const bot = new HeuristicBot(difficulty);
  botCache.set(difficulty, bot);
  return bot;
}
let logCounter = 0;

export const useGame = create<GameStore>((set, get) => {
  function extendLog(previous: LogLine[], texts: string[]): LogLine[] {
    const next = previous.slice(-120);
    for (const text of texts) {
      next.push({ id: logCounter++, text });
    }
    return next;
  }

  // Recompute the hand-off / reveal state after any change to the game state.
  function syncHandoff(): void {
    const { state, seats, revealedSeat } = get();
    if (!state || state.phase === 'gameOver') {
      set({ handoffSeat: null });
      return;
    }
    const humanCount = seats.filter((seat) => seat.kind === 'human').length;
    const actor = actorOf(state);
    if (seats[actor]!.kind !== 'human') {
      set({ handoffSeat: null }); // a bot is up; the board keeps the last human's view
      return;
    }
    // A human is up. Only ask to pass the device when it is a DIFFERENT human.
    if (humanCount > 1 && actor !== revealedSeat) {
      set({ handoffSeat: actor });
    } else {
      set({ revealedSeat: actor, handoffSeat: null });
    }
  }

  function applyAction(action: Action): void {
    const { state, log } = get();
    if (!state) {
      return;
    }
    const result = reduce(state, action);
    if (!result.ok) {
      return; // the UI only ever offers legal actions; ignore anything else
    }
    const texts = result.value.events
      .map(describeEvent)
      .filter((text): text is string => text !== null);
    set({ state: result.value.state, log: extendLog(log, texts), lastEvents: result.value.events });
    syncHandoff();
  }

  return {
    state: null,
    seats: [],
    revealedSeat: null,
    handoffSeat: null,
    log: [],
    lastEvents: [],

    newGame: (config) => {
      botRng = mulberry32(config.seed);
      const created = createGame({ players: config.seats.length, seed: config.seed });
      const texts = created.events
        .map(describeEvent)
        .filter((text): text is string => text !== null);
      set({
        state: created.state,
        seats: config.seats,
        revealedSeat: null,
        handoffSeat: null,
        log: extendLog([], texts),
        lastEvents: created.events,
      });
      syncHandoff();
    },

    dispatch: (action) => {
      applyAction(action);
    },

    stepBot: () => {
      const { state, seats, handoffSeat } = get();
      if (!state || state.phase === 'gameOver' || handoffSeat !== null) {
        return;
      }
      const actor = actorOf(state);
      const seat = seats[actor]!;
      if (seat.kind !== 'bot') {
        return;
      }
      const legal = legalActions(state, actor);
      if (legal.length === 0) {
        return;
      }
      const action = botFor(seat.difficulty).chooseAction(observe(state, actor), legal, botRng);
      applyAction(action);
    },

    ackHandoff: () => {
      const { handoffSeat } = get();
      if (handoffSeat === null) {
        return;
      }
      set({ revealedSeat: handoffSeat, handoffSeat: null });
    },

    reset: () => set({ state: null, seats: [], revealedSeat: null, handoffSeat: null, log: [], lastEvents: [] }),
  };
});

// The seat whose perspective the board should render right now.
export function viewSeat(store: Pick<GameStore, 'revealedSeat' | 'seats'>): number {
  if (store.revealedSeat !== null) {
    return store.revealedSeat;
  }
  const firstHuman = store.seats.findIndex((seat) => seat.kind === 'human');
  return firstHuman === -1 ? 0 : firstHuman;
}
