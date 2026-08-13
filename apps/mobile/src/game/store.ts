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
import { createGame, legalActions, makeState, mulberry32, observe, reduce } from '@sauda/engine';
import type { Action, GameEvent, GameState, Observation, Rng } from '@sauda/engine';
import { Munshi, MUNSHI_USES_PER_GAME } from '@sauda/bots';
import type { Bot, Difficulty, MunshiAdvice } from '@sauda/bots';
import { DifficultyBot } from '@sauda/difficulty';
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
  activeSeed: number | null; // S6a: the seed THIS game was dealt from — shown in the HUD so a game can be replayed
  newGame: (config: GameConfig) => void;
  dispatch: (action: Action) => void;
  stepBot: () => void;
  // read-only advice; spends one use, dispatches NOTHING. Returns the observation alongside so the
  // UI can compose a nuanced line from the recommendation PLUS public facts (R6).
  consultMunshi: () => { advice: MunshiAdvice; observation: Observation } | null;
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
// S6b: seats now play through the DifficultyBot wrapper (not the raw HeuristicBot), so the tier the
// owner picks genuinely changes how a bot plays — hard is the old full-strength brain verbatim, and
// medium/easy slip off it (seeded by botRng, so still fully reproducible). packages/bots is untouched.
function botFor(difficulty: Difficulty): Bot {
  const existing = botCache.get(difficulty);
  if (existing) {
    return existing;
  }
  const bot = new DifficultyBot(difficulty);
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
    activeSeed: null,

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
        activeSeed: config.seed,
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
      const observation = observe(state, actor);
      const advice = munshi.advise(observation, legalActions(state, actor));
      if (!advice) {
        return null;
      }
      set({ munshiUsesRemaining: munshi.usesRemaining }); // mirror the spent use into the chip
      return { advice, observation };
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
      set({ state: null, seats: [], revealedSeat: null, handoffSeat: null, log: [], lastEvents: [], munshiUsesRemaining: MUNSHI_USES_PER_GAME, activeSeed: null });
    },
  };
});

// The 4-seat table the capture harness replays into: seat 0 the human, seats 1-3 the medium
// bots — matching the seatCount the fixture was generated with. Used only by the dev __replay
// hook below, so it is tree-shaken from production along with that block.
const CAPTURE_SEATS: SeatConfig[] = [
  { kind: 'human' },
  { kind: 'bot', difficulty: 'medium' },
  { kind: 'bot', difficulty: 'medium' },
  { kind: 'bot', difficulty: 'medium' },
];

// What __replay hands back to the Playwright pipeline so it can assert the state landed.
interface ReplaySummary {
  ok: boolean; // every logged action was legal on replay
  applied: number;
  total: number;
  phase: string | null;
  actor: number | null;
  handLen: number | null;
}

// Dev-only: expose the store so the Phase-B scenario capture harness (and manual debugging)
// can drive it from the browser — replay a recorded action log to land the UI on any target
// state. Vite replaces `import.meta.env.DEV` with `false` in a production build, so this whole
// block is dead-code-eliminated from the shipped app bundle.
if (import.meta.env.DEV) {
  const globals = globalThis as unknown as {
    __sauda?: typeof useGame;
    __replay?: (seed: number, actions: Action[]) => ReplaySummary;
    __craft?: (spec: Parameters<typeof makeState>[0]) => void;
    __saudaCapturePaused?: boolean;
  };
  globals.__sauda = useGame;

  // __craft(spec): inject an arbitrary crafted board via the engine testkit's makeState, so the
  // capture harness can stage a scenario the seeded deals don't naturally produce (e.g. the S4
  // wildcard-assistant's pink-pink-dual). Pauses the auto-beats and renders through the normal store.
  globals.__craft = (spec) => {
    globals.__saudaCapturePaused = true;
    useGame.setState({
      state: makeState(spec),
      seats: CAPTURE_SEATS,
      revealedSeat: 0,
      handoffSeat: null,
      log: [],
      lastEvents: [],
      munshiUsesRemaining: MUNSHI_USES_PER_GAME,
      activeSeed: 0,
    });
  };

  // __replay(seed, actions): land the real UI deterministically on a recorded scenario state.
  // The committed fixture log already contains EVERY seat's actions (bots included), so we just
  // rebuild the game from the seed and dispatch the whole log in one synchronous pass — no bot
  // stepping. It first sets `__saudaCapturePaused` so the Table's automatic beats (bot timer,
  // auto-draw, auto-resolve) don't advance the game past the frame the harness wants to shoot;
  // the pause holds until the next __replay resets the page. Returns a small summary the
  // Playwright pipeline asserts on. This is the capture bridge the scenarios harness describes.
  globals.__saudaCapturePaused = false;
  globals.__replay = (seed, actions) => {
    globals.__saudaCapturePaused = true;
    useGame.getState().newGame({ seats: CAPTURE_SEATS, seed });
    let applied = 0;
    for (const action of actions) {
      const before = useGame.getState().state;
      useGame.getState().dispatch(action); // reduce rejects an illegal action silently (no set)
      if (useGame.getState().state !== before) {
        applied += 1;
      }
    }
    const state = useGame.getState().state;
    return {
      ok: applied === actions.length,
      applied,
      total: actions.length,
      phase: state ? state.phase : null,
      actor: state ? actorOf(state) : null,
      handLen: state ? state.players[0]!.hand.length : null,
    };
  };
}

// The seat whose perspective the board should render right now.
export function viewSeat(store: Pick<GameStore, 'revealedSeat' | 'seats'>): number {
  if (store.revealedSeat !== null) {
    return store.revealedSeat;
  }
  const firstHuman = store.seats.findIndex((seat) => seat.kind === 'human');
  return firstHuman === -1 ? 0 : firstHuman;
}
