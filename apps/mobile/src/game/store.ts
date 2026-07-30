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
import { HeuristicBot, Munshi, MUNSHI_USES_PER_GAME } from '@sauda/bots';
import type { Bot, Difficulty, MunshiAdvice } from '@sauda/bots';
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
  munshiUsesRemaining: number; // Munshi advisor budget for THIS game (3, flat, no carry-over)
  newGame: (config: GameConfig) => void;
  dispatch: (action: Action) => void;
  stepBot: () => void;
  consultMunshi: () => MunshiAdvice | null; // read-only advice; spends one use, dispatches NOTHING
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

// The Munshi advisor lives beside the bot machinery, OUTSIDE the reactive store — a consult
// is read-only and must not itself trigger a re-render (only the mirrored uses count does).
// A fresh instance per game enforces "no carry-over" (project law). It shares the bot brain
// via `recommend`; the hard tier gives the human the sharpest read of the table (DECISIONS.md).
const MUNSHI_DIFFICULTY: Difficulty = 'hard';
let munshi = new Munshi(MUNSHI_DIFFICULTY);

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
    munshiUsesRemaining: MUNSHI_USES_PER_GAME,

    newGame: (config) => {
      botRng = mulberry32(config.seed);
      munshi = new Munshi(MUNSHI_DIFFICULTY); // fresh advisor: 3 uses, no carry-over from the last game
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
        munshiUsesRemaining: MUNSHI_USES_PER_GAME,
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

    // A single read-only Munshi consult (M4b H-rows). It evaluates MY current legal options
    // with the shared bot brain and returns the top move + one templated reason line. Two hard
    // guarantees: it answers only on the human's OWN play turn, and it NEVER calls reduce —
    // so opening the advisor changes no game state (the player still makes the move). Returns
    // null (spending no use) when it isn't my turn to play, or the 3-use budget is gone.
    consultMunshi: () => {
      const { state, seats } = get();
      if (!state || state.phase !== 'playing') {
        return null; // advice only during my main play phase — never draw / discard / game-over
      }
      const actor = actorOf(state);
      if (actor !== state.currentPlayerIndex || seats[actor]?.kind !== 'human') {
        return null; // a bot is up, or an interrupt has redirected control off my own turn
      }
      const advice = munshi.advise(observe(state, actor), legalActions(state, actor));
      if (advice) {
        set({ munshiUsesRemaining: munshi.usesRemaining }); // mirror the spent use into the chip
      }
      return advice;
    },

    ackHandoff: () => {
      const { handoffSeat } = get();
      if (handoffSeat === null) {
        return;
      }
      set({ revealedSeat: handoffSeat, handoffSeat: null });
    },

    reset: () => {
      munshi = new Munshi(MUNSHI_DIFFICULTY); // no advisor state survives leaving a game
      set({ state: null, seats: [], revealedSeat: null, handoffSeat: null, log: [], lastEvents: [], munshiUsesRemaining: MUNSHI_USES_PER_GAME });
    },
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
