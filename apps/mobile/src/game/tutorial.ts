/**
 * THE GUIDED TUTORIAL — "Sikho" (U3, first-player pass; the owner's sister asked for it). A demo game
 * the player WATCHES, driven by an automated pointer, that teaches every kind of move and ties each to
 * the rulebook. This module is the deterministic BRAIN of it — the fixed starting state + the scripted
 * action list — kept pure and browser-free so the whole demo is testable (tutorial.test.ts) and plays
 * out identically every time. The cursor, the teaching-beat cards and the Book links are the UI layer
 * (TutorialPlayer / TutorialCursor); this file decides no pixels.
 *
 * HOW IT STAYS DETERMINISTIC AND LEGAL. We craft one 2-player game with `makeState` (You = seat 0, one
 * bot = seat 1) and then STACK the draw pile so each DRAW hands out exactly the cards the script needs
 * next (the draw pile is shared, so the stack lists every draw — human and bot — in order). Every step
 * is a real engine action applied through `reduce`; the test replays the whole list and asserts each
 * step is legal and the game ends in a human win, so the script can never silently drift out of the
 * rules. Because it is one continuous legal game, the finale is a real declared SAUDA.
 */
import type { Action } from '@sauda/engine';
import { makeState, reduce } from '@sauda/engine';
import type { GameState } from '@sauda/engine';
import type { StateSpec } from '@sauda/engine';

// The move classes the demo teaches, in the owner's list. Each first appearance gets a teaching beat.
export type TutorialMove =
  | 'draw'
  | 'place'
  | 'complete'
  | 'bank'
  | 'rearrange'
  | 'pay'
  | 'wildcard'
  | 'steal'
  | 'makaan'
  | 'lagaan'
  | 'haveli'
  | 'nahi'
  | 'discard'
  | 'declare'
  // Structural steps that aren't a player move to TEACH: the bot's own plays, turn ends, and the
  // "no counter — allow it" responses. They advance the game and the cursor but carry no teaching beat.
  | 'flow';

// A teaching beat: the demo pauses, dims, and shows this before the move type is first seen. `niyam` is
// the Book chapter it ties to (1..8 — see shell/Book.tsx CHAPTERS), opened by a tap-through.
export interface TeachBeat {
  title: string;
  what: string; // what is about to happen
  why: string; // why the player would do it
  niyam: number; // Book chapter number (1-based)
  niyamLabel: string; // e.g. "Niyam 3: Properties & Wildcards"
}

// One scripted step: the engine action to apply, the move class it demonstrates, an optional teaching
// beat (present on the FIRST occurrence of each move class), a short caption for the cursor moment, and
// a cursor hint naming the board elements the pointer travels between (data-attributes the UI resolves).
export interface TutorialStep {
  by: 'you' | 'bot'; // whose move it is (for narration; the engine derives the real actor)
  action: Action;
  move: TutorialMove;
  caption: string; // the quiet line shown while the cursor performs it
  teach?: TeachBeat;
  cursor?: { to?: string; from?: string; gesture: 'tap' | 'drag' | 'point' };
}

// ── the crafted starting board ────────────────────────────────────────────────────────────────────
// You (seat 0) start mid-game with three colours part-built, so the demo can complete all three and
// declare a real win in a few turns. The bot (seat 1) holds two VASOOLI (to charge you — one you pay,
// one you cancel with NAHI CHALEGA) and a bank to pay your LAGAAN from, plus a lone property to steal.
const START: StateSpec = {
  players: [
    {
      hand: [
        'prop_kashi_1', // place (advances kashi)
        'prop_kashi_2', // completes kashi
        'prop_mumbai_1', // completes mumbai
        'prop_puraniDilli_1', // completes puraniDilli
        'money_5_0', // bank, then pays a Rs5 charge in full
        'wild_kashi_junction_0', // a wildcard to place
        'action_haathKiSafai_0', // steal a property
      ],
      properties: {
        kashi: { cards: ['prop_kashi_0'] }, // size 3 — one down, two to add
        jaipur: { cards: ['wild_jaipur_kolkata_0'] }, // a placed wildcard to REARRANGE (jaipur→kolkata)
        mumbai: { cards: ['prop_mumbai_0'] }, // size 2 — one to add
        puraniDilli: { cards: ['prop_puraniDilli_0'] }, // size 2 — one to add
      },
    },
    {
      hand: ['action_vasooli_0', 'action_vasooli_1'], // two charges against you (pay, then NAHI)
      bank: ['money_4_0', 'money_4_1'], // the bot's only value — it pays your LAGAAN from here
      properties: { chennai: { cards: ['prop_chennai_0'] } }, // a lone property you steal (before LAGAAN)
    },
  ],
  currentPlayerIndex: 0,
  phase: 'awaitingDraw',
  playsRemaining: 3,
};

// The exact draw order (top of the pile downward), human AND bot interleaved, so every DRAW in the
// script below hands out precisely these cards. `null` = "any leftover card" (a don't-care draw). The
// order matches the DRAW steps in TUTORIAL_STEPS one-for-one. money_1_0 is delivered as the spare card
// the hand-limit DISCARD throws away, so no demo card is ever lost to the discard.
// Bot draws are named too, so its end-of-turn hand-limit discards target known cards (the bot draws but
// rarely plays, so it must shed cards on its later turns just like a real player would).
const DRAW_SEQUENCE: (string | null)[] = [
  'action_makaan_0', 'action_haveli_0', // T1 You
  'money_1_1', 'money_1_2', // T2 Bot
  'action_nahiChalega_0', 'money_1_0', // T3 You (money_1_0 is the spare the hand-limit discard throws)
  'money_2_0', 'money_2_1', // T4 Bot
  'kiraya_puraniDilli_kashi_0', 'action_dugna_0', // T5 You
  'money_2_2', 'money_2_3', // T6 Bot
  null, null, // T7 You
  'money_3_1', 'money_3_2', // T8 Bot
  null, null, // T9 You
  'money_1_3', 'money_1_4', // T10 Bot
];

// Stack the draw pile so `reduce`'s DRAW (which pops the LAST element) hands out DRAW_SEQUENCE in order,
// filling each `null` with a leftover card. Keeps the 106-card multiset intact — it only reorders.
function stackDrawPile(state: GameState, sequence: (string | null)[]): GameState {
  const wanted = new Set(sequence.filter((id): id is string => id !== null));
  const leftovers = state.drawPile.filter((id) => !wanted.has(id));
  let nextLeftover = 0;
  const drawOrder = sequence.map((id) => id ?? leftovers[nextLeftover++]!);
  const remaining = leftovers.slice(nextLeftover);
  // drawOrder[0] must be drawn first, so it goes LAST in the pile; the rest sit beneath.
  return { ...state, drawPile: [...remaining, ...[...drawOrder].reverse()] };
}

export function buildTutorialState(): GameState {
  return stackDrawPile(makeState(START), DRAW_SEQUENCE);
}

// ── the script ────────────────────────────────────────────────────────────────────────────────────
// Chapter numbers (shell/Book.tsx): 1 Goal & Winning · 2 Your Turn · 3 Properties & Wildcards ·
// 4 Money & Payment · 5 Kiraya & Dugna · 6 Action Cards · 7 Nahi Chalega · 8 Munshi.
export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── Turn 1 (You): draw, build the first set, bank, rearrange ──
  {
    by: 'you', action: { type: 'DRAW' }, move: 'draw', caption: 'Your turn opens with a draw.',
    cursor: { to: '[data-tut="draw"]', gesture: 'point' },
    teach: { title: 'Drawing', what: 'Every turn begins by drawing two cards.', why: 'They are your fuel — properties to build with, money and actions to spend.', niyam: 2, niyamLabel: 'Niyam 2: Your Turn' },
  },
  {
    by: 'you', action: { type: 'PLACE_PROPERTY', cardId: 'prop_kashi_1', set: 'kashi' }, move: 'place', caption: 'Place a property into its colour.',
    cursor: { from: '[data-card-id="prop_kashi_1"]', to: '[data-drop="set:kashi"]', gesture: 'drag' },
    teach: { title: 'Placing property', what: 'Drag a property onto its colour group.', why: 'Collecting a full colour is how you win — this is the heart of the game.', niyam: 3, niyamLabel: 'Niyam 3: Properties & Wildcards' },
  },
  {
    by: 'you', action: { type: 'PLACE_PROPERTY', cardId: 'prop_kashi_2', set: 'kashi' }, move: 'complete', caption: 'That completes the Kashi set!',
    cursor: { from: '[data-card-id="prop_kashi_2"]', to: '[data-drop="set:kashi"]', gesture: 'drag' },
    teach: { title: 'Completing a set', what: 'Adding the last property completes the colour.', why: 'Three complete sets of different colours wins the game.', niyam: 1, niyamLabel: 'Niyam 1: Goal & Winning' },
  },
  {
    by: 'you', action: { type: 'BANK_CARD', cardId: 'money_5_0' }, move: 'bank', caption: 'Bank a money card for later.',
    cursor: { from: '[data-card-id="money_5_0"]', to: '[data-drop="bank"]', gesture: 'drag' },
    teach: { title: 'Banking money', what: 'Send a money card to your bank.', why: "You can't pay rent with properties — keep cash ready.", niyam: 4, niyamLabel: 'Niyam 4: Money & Payment' },
  },
  {
    by: 'you', action: { type: 'REARRANGE_WILDCARD', cardId: 'wild_jaipur_kolkata_0', toSet: 'kolkata' }, move: 'rearrange', caption: 'Shift a wildcard between colours — free.',
    cursor: { from: '[data-card-id="wild_jaipur_kolkata_0"]', to: '[data-drop="set:kolkata"]', gesture: 'drag' },
    teach: { title: 'Rearranging a wildcard', what: 'A placed wildcard can move colours for free.', why: 'Slide it where it completes a set soonest — it costs no play.', niyam: 3, niyamLabel: 'Niyam 3: Properties & Wildcards' },
  },
  { by: 'you', action: { type: 'END_TURN' }, move: 'flow', caption: 'End the turn.', cursor: { to: '[data-tut="endturn"]', gesture: 'tap' } },

  // ── Turn 2 (Bot): the bot charges you — you pay ──
  { by: 'bot', action: { type: 'DRAW' }, move: 'flow', caption: 'The bot takes its turn.' },
  { by: 'bot', action: { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 0 } }, move: 'flow', caption: 'The bot plays VASOOLI on you.' },
  { by: 'you', action: { type: 'RESPOND_ALLOW' }, move: 'flow', caption: 'You have no counter — allow it.' },
  {
    by: 'you', action: { type: 'RESPOND_PAY', cardIds: ['money_5_0'] }, move: 'pay', caption: 'Pay from your bank.',
    cursor: { from: '[data-pay-card="money_5_0"]', to: '[data-tut="pay"]', gesture: 'tap' },
    teach: { title: 'Being charged', what: 'When a charge lands, you pay from your bank or table.', why: 'No change is given, so pay as tight as you can.', niyam: 4, niyamLabel: 'Niyam 4: Money & Payment' },
  },
  { by: 'bot', action: { type: 'END_TURN' }, move: 'flow', caption: 'The bot ends its turn.' },

  // ── Turn 3 (You): a quiet draw pushes you over the hand limit — discard ──
  { by: 'you', action: { type: 'DRAW' }, move: 'draw', caption: 'You draw into a full hand.' },
  { by: 'you', action: { type: 'END_TURN' }, move: 'flow', caption: 'End the turn — you are over the limit.' },
  {
    by: 'you', action: { type: 'DISCARD', cardId: 'money_1_0' }, move: 'discard', caption: 'Discard down to the hand limit.',
    cursor: { from: '[data-card-id="money_1_0"]', to: '[data-tut="discard"]', gesture: 'tap' },
    teach: { title: 'Hand limit', what: 'End a turn holding more than seven cards and you discard the excess.', why: "Don't hoard cards you can't use — spend them or lose them.", niyam: 2, niyamLabel: 'Niyam 2: Your Turn' },
  },

  // ── Turn 4 (Bot): the bot charges again — you cancel with NAHI CHALEGA ──
  { by: 'bot', action: { type: 'DRAW' }, move: 'flow', caption: 'The bot draws.' },
  { by: 'bot', action: { type: 'PLAY_ACTION', cardId: 'action_vasooli_1', params: { action: 'vasooli', target: 0 } }, move: 'flow', caption: 'Another VASOOLI on you.' },
  {
    by: 'you', action: { type: 'RESPOND_NAHI_CHALEGA', cardId: 'action_nahiChalega_0' }, move: 'nahi', caption: 'NAHI CHALEGA — cancel it!',
    cursor: { from: '[data-card-id="action_nahiChalega_0"]', to: '[data-tut="nahi"]', gesture: 'tap' },
    teach: { title: 'Nahi Chalega', what: 'This card cancels an action played against you.', why: 'Save it for the charge or theft that would hurt most.', niyam: 7, niyamLabel: 'Niyam 7: Nahi Chalega' },
  },
  { by: 'bot', action: { type: 'RESPOND_ALLOW' }, move: 'flow', caption: 'The bot lets your cancel stand.' },
  { by: 'bot', action: { type: 'END_TURN' }, move: 'flow', caption: 'The bot ends its turn.' },

  // ── Turn 5 (You): complete two more sets, then steal a property (before you charge rent) ──
  { by: 'you', action: { type: 'DRAW' }, move: 'draw', caption: 'Your turn — draw again.' },
  { by: 'you', action: { type: 'PLACE_PROPERTY', cardId: 'prop_mumbai_1', set: 'mumbai' }, move: 'complete', caption: 'Mumbai is complete — set two.', cursor: { from: '[data-card-id="prop_mumbai_1"]', to: '[data-drop="set:mumbai"]', gesture: 'drag' } },
  { by: 'you', action: { type: 'PLACE_PROPERTY', cardId: 'prop_puraniDilli_1', set: 'puraniDilli' }, move: 'complete', caption: 'Purani Dilli too — set three!', cursor: { from: '[data-card-id="prop_puraniDilli_1"]', to: '[data-drop="set:puraniDilli"]', gesture: 'drag' } },
  {
    by: 'you', action: { type: 'PLAY_ACTION', cardId: 'action_haathKiSafai_0', params: { action: 'haathKiSafai', target: 1, cardId: 'prop_chennai_0' } }, move: 'steal', caption: 'HAATH KI SAFAI — take a property.',
    cursor: { from: '[data-card-id="action_haathKiSafai_0"]', to: '[data-tut="opponent"]', gesture: 'drag' },
    teach: { title: 'Taking from an opponent', what: 'HAATH KI SAFAI steals one loose property.', why: 'Grab the card that finishes a set of yours — or denies theirs.', niyam: 6, niyamLabel: 'Niyam 6: Action Cards' },
  },
  { by: 'bot', action: { type: 'RESPOND_ALLOW' }, move: 'flow', caption: 'The bot cannot stop it.' },
  { by: 'you', action: { type: 'END_TURN' }, move: 'flow', caption: 'End the turn.' },

  // ── Turn 6 (Bot): a quiet turn ──
  { by: 'bot', action: { type: 'DRAW' }, move: 'flow', caption: 'The bot draws.' },
  { by: 'bot', action: { type: 'END_TURN' }, move: 'flow', caption: 'The bot has nothing to press.' },

  // ── Turn 7 (You): build MAKAAN + HAVELI, place a wildcard ──
  { by: 'you', action: { type: 'DRAW' }, move: 'draw', caption: 'Your turn.' },
  {
    by: 'you', action: { type: 'PLAY_ACTION', cardId: 'action_makaan_0', params: { action: 'makaan', set: 'kashi' } }, move: 'makaan', caption: 'Build a MAKAAN on a complete set.',
    cursor: { from: '[data-card-id="action_makaan_0"]', to: '[data-drop="set:kashi"]', gesture: 'drag' },
    teach: { title: 'Buildings', what: 'A MAKAAN sits on a complete set and raises its rent.', why: 'It makes your LAGAAN charges hurt more.', niyam: 6, niyamLabel: 'Niyam 6: Action Cards' },
  },
  {
    by: 'you', action: { type: 'PLAY_ACTION', cardId: 'action_haveli_0', params: { action: 'haveli', set: 'kashi' } }, move: 'haveli', caption: 'A HAVELI stacks on the MAKAAN.',
    cursor: { from: '[data-card-id="action_haveli_0"]', to: '[data-drop="set:kashi"]', gesture: 'drag' },
    teach: { title: 'Haveli', what: 'A HAVELI adds even more rent, on top of a MAKAAN.', why: 'A fully built set is your biggest earner.', niyam: 6, niyamLabel: 'Niyam 6: Action Cards' },
  },
  {
    by: 'you', action: { type: 'PLACE_PROPERTY', cardId: 'wild_kashi_junction_0', set: 'junction' }, move: 'wildcard', caption: 'Place a wildcard into any of its colours.',
    cursor: { from: '[data-card-id="wild_kashi_junction_0"]', to: '[data-drop="set:junction"]', gesture: 'drag' },
    teach: { title: 'Wildcards', what: 'A wildcard counts as any of its printed colours.', why: 'It plugs the gap in whichever set is closest to done.', niyam: 3, niyamLabel: 'Niyam 3: Properties & Wildcards' },
  },
  { by: 'you', action: { type: 'END_TURN' }, move: 'flow', caption: 'End the turn.' },

  // ── Turn 8 (Bot): a quiet turn — its hand is over the limit, so it discards too ──
  { by: 'bot', action: { type: 'DRAW' }, move: 'flow', caption: 'The bot draws.' },
  { by: 'bot', action: { type: 'END_TURN' }, move: 'flow', caption: 'The bot passes.' },
  { by: 'bot', action: { type: 'DISCARD', cardId: 'money_1_1' }, move: 'flow', caption: 'The bot discards down to the limit.' },

  // ── Turn 9 (You): charge LAGAAN + DUGNA ──
  { by: 'you', action: { type: 'DRAW' }, move: 'draw', caption: 'Your turn.' },
  {
    by: 'you', action: { type: 'PLAY_KIRAYA', cardId: 'kiraya_puraniDilli_kashi_0', color: 'kashi', target: null, dugnaCardIds: ['action_dugna_0'] }, move: 'lagaan', caption: 'Charge LAGAAN, doubled by DUGNA.',
    cursor: { from: '[data-card-id="kiraya_puraniDilli_kashi_0"]', to: '[data-drop="set:kashi"]', gesture: 'drag' },
    teach: { title: 'Lagaan & Dugna', what: 'LAGAAN charges rent for a colour you own; DUGNA doubles it.', why: 'A built-up set charged with DUGNA drains an opponent fast.', niyam: 5, niyamLabel: 'Niyam 5: Kiraya & Dugna' },
  },
  { by: 'bot', action: { type: 'RESPOND_ALLOW' }, move: 'flow', caption: 'The bot must pay.' },
  { by: 'bot', action: { type: 'RESPOND_PAY', cardIds: ['money_4_0', 'money_4_1', 'money_5_0'] }, move: 'flow', caption: 'The bot pays your rent.' },
  { by: 'you', action: { type: 'END_TURN' }, move: 'flow', caption: 'End the turn.' },

  // ── Turn 10 (Bot): passes back — over the limit again, so it discards ──
  { by: 'bot', action: { type: 'DRAW' }, move: 'flow', caption: 'The bot draws.' },
  { by: 'bot', action: { type: 'END_TURN' }, move: 'flow', caption: 'The bot passes.' },
  { by: 'bot', action: { type: 'DISCARD', cardId: 'money_1_2' }, move: 'flow', caption: 'The bot discards.' },
  { by: 'bot', action: { type: 'DISCARD', cardId: 'money_2_0' }, move: 'flow', caption: 'Back to you.' },

  // ── Turn 11 (You): declare the win ──
  {
    by: 'you', action: { type: 'DECLARE_WIN' }, move: 'declare', caption: 'SAUDA! Three sets — you win.',
    cursor: { to: '[data-tut="declare"]', gesture: 'tap' },
    teach: { title: 'Declaring SAUDA', what: 'With three complete sets, declare on your turn to win.', why: "That's the whole game — get there first.", niyam: 1, niyamLabel: 'Niyam 1: Goal & Winning' },
  },
];

// The Book has this many chapters (shell/Book.tsx); every teaching beat's `niyam` must be in range. The
// tutorial test asserts this, so a beat can never link to a chapter that doesn't exist.
export const BOOK_CHAPTER_COUNT = 8;

// The result of running (or replaying) the whole script: the state AFTER each step (states[0] is the
// start, states[i+1] is after step i), and whether it finished in a human (seat 0) win. `error` names
// the first step that a rule rejected, if any — the demo must never contain an illegal move.
export interface TutorialRun {
  states: GameState[];
  finishedInHumanWin: boolean;
  error: string | null;
}

// Replay the whole script through the engine. Pure: builds a fresh crafted state and applies each step
// with `reduce`, stopping at the first rejection. The UI player and the test both use this — the UI to
// get the sequence of board states to animate between, the test to prove every step is legal.
export function runTutorial(): TutorialRun {
  let state = buildTutorialState();
  const states: GameState[] = [state];
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    const step = TUTORIAL_STEPS[i]!;
    const result = reduce(state, step.action);
    if (!result.ok) {
      return { states, finishedInHumanWin: false, error: `step ${i} (${step.move}/${step.action.type}): ${result.error.code}` };
    }
    state = result.value.state;
    states.push(state);
  }
  return {
    states,
    finishedInHumanWin: state.phase === 'gameOver' && state.winnerIndex === 0,
    error: null,
  };
}
