/**
 * JUST-IN-TIME ONBOARDING — the trigger engine (W2, first-player pass; supersedes the U3 watch-only
 * demo). The owner's model, in his words: like Temple Run teaching "swipe up to jump" the instant the
 * first obstacle arrives. The player plays THEIR OWN first game; the game teaches each mechanic in the
 * moment it first becomes relevant. This module is the pure BRAIN of that — given the human's live
 * `legalActions` and `Observation`, it answers "which mechanic just became available to teach?" It reads
 * ONLY the engine's own offer; it never decides a rule, never alters `legalActions`, and never plays a
 * move. That guarantee is what keeps onboarding honest: a coach mark can only ever point at a move the
 * engine already offered (proven in onboarding.test.ts).
 *
 * The UI layer (CoachMark + useCoachMark) owns teach-once persistence, the on-screen card, the gesture
 * ghost, the Book link, and the "two dismissals → go quiet" rule. This file decides no pixels and holds
 * no state.
 */
import { SETS } from '@sauda/engine';
import type { Action, CardId, Observation, SetId } from '@sauda/engine';

// The mechanics the onboarding teaches, each ONCE, at its first natural moment (the owner's list).
export type Mechanic =
  | 'bank' // banking money
  | 'place' // placing a real property
  | 'complete' // completing a set
  | 'wildcard' // placing a wildcard
  | 'building' // MAKAAN / HAVELI on a complete set
  | 'action' // playing an untargeted action card (SHAGUN / AAGE BADHO)
  | 'target' // a targeted action (choose an opponent / property)
  | 'lagaan' // charging rent
  | 'dugna' // attaching DUGNA to double a charge
  | 'rearrange' // the free wildcard rearrange (the arrange nudge)
  | 'pay' // being charged and paying
  | 'nahi' // holding NAHI CHALEGA under attack
  | 'discard' // the hand-limit discard step
  | 'declare'; // declaring the win

// Priority when more than one mechanic is available at the same instant (only ONE coach mark shows at a
// time). Time-sensitive RESPONSES come first (a pay / NAHI / discard window can pass); the win next; then
// the turn plays in the owner's teaching order. This is the tie-break, not a schedule — each mechanic
// still only fires the first time it is genuinely available.
export const MECHANIC_PRIORITY: Mechanic[] = [
  'pay',
  'nahi',
  'declare',
  'discard',
  'bank',
  'place',
  'complete',
  'wildcard',
  'building',
  'action',
  'target',
  'lagaan',
  'dugna',
  'rearrange',
];

// Card-id classification, from the deck's `<category>_…` id scheme (deck.ts). Pure string checks — no
// state needed, so the predicates stay a pure function of the Observation + the offered actions.
function isWildcard(cardId: CardId): boolean {
  return cardId.startsWith('wild_');
}

// The largest group I already hold in a colour (real + wild cards), 0 if none. Used to spot the moment a
// set is exactly one property short — i.e. the moment "completing a set" first becomes a thing to teach.
function largestGroupSize(observation: Observation, set: SetId): number {
  let largest = 0;
  for (const group of observation.myProperties[set]) {
    if (group.cards.length > largest) {
      largest = group.cards.length;
    }
  }
  return largest;
}

// A play of a PLAY_ACTION whose kind matches — the small helper the action/target/building checks share.
function hasActionKind(actions: Action[], kinds: readonly string[]): boolean {
  return actions.some((action) => action.type === 'PLAY_ACTION' && kinds.includes(action.params.action));
}

const TARGETED_ACTIONS = ['vasooli', 'kabza', 'haathKiSafai', 'adlaBadli'] as const;
const UNTARGETED_ACTIONS = ['shagun', 'aageBadho'] as const;
const BUILDING_ACTIONS = ['makaan', 'haveli'] as const;

/**
 * The set of mechanics available to teach RIGHT NOW, returned in MECHANIC_PRIORITY order. Pure: derived
 * only from the engine's offer (`actions` = the human's legalActions) and public/own facts in the
 * Observation. The caller filters out the already-taught ones and shows the first survivor.
 *
 * Each predicate answers "could the player do this move now?" — never "should they". The predicates are
 * deliberately simple string/shape checks over the offered actions so they can never disagree with the
 * engine about what is legal.
 */
export function availableMechanics(observation: Observation, actions: Action[]): Mechanic[] {
  const present = new Set<Mechanic>();

  for (const action of actions) {
    switch (action.type) {
      case 'BANK_CARD':
        present.add('bank');
        break;
      case 'PLACE_PROPERTY':
        present.add(isWildcard(action.cardId) ? 'wildcard' : 'place');
        // Completing a set: this placement lands in a colour I already hold exactly one short of full.
        // Heuristic on my own board (pure) — if it ever fires a touch early it only teaches sooner; it
        // can never change what is legal. SETS[set].size is the engine's own required size.
        if (largestGroupSize(observation, action.set) === SETS[action.set].size - 1) {
          present.add('complete');
        }
        break;
      case 'REARRANGE_WILDCARD':
        present.add('rearrange');
        break;
      case 'PLAY_KIRAYA':
        present.add('lagaan');
        if (action.dugnaCardIds.length > 0) {
          present.add('dugna'); // a DUGNA can attach to this charge — teach the doubling
        }
        break;
      case 'DISCARD':
        present.add('discard');
        break;
      case 'DECLARE_WIN':
        present.add('declare');
        break;
      case 'RESPOND_NAHI_CHALEGA':
        present.add('nahi');
        break;
      default:
        break;
    }
  }

  // Action-card kinds (grouped so "play an action" and "choose a target" teach as distinct moments).
  if (hasActionKind(actions, BUILDING_ACTIONS)) {
    present.add('building');
  }
  if (hasActionKind(actions, TARGETED_ACTIONS)) {
    present.add('target');
  }
  if (hasActionKind(actions, UNTARGETED_ACTIONS)) {
    present.add('action');
  }

  // Being charged and paying: a charge is open on me and I actually hold value to pay with (the
  // nothing-to-pay C4 case auto-resolves with no sheet, so there is no move to teach there).
  const canPay = actions.some((action) => action.type === 'RESPOND_PAY');
  if (canPay && observation.interrupt !== null && observation.myBankTotal > 0) {
    present.add('pay');
  }

  return MECHANIC_PRIORITY.filter((mechanic) => present.has(mechanic));
}

// ── the coach-mark CONTENT (copy + where it points) ─────────────────────────────────────────────────
// One entry per mechanic: the short teaching line, the gesture to show, the Book chapter it links to, and
// the DOM anchor the mark sits beside + the ghost travels to. Anchors are the board's production-safe
// `data-drop` zones (always rendered) or a `data-coach` hook; a missing anchor falls back to a sensible
// spot (see CoachMark), so the mark is never lost. Chapter numbers match shell/Book.tsx (1..8).

export type Gesture = 'drag' | 'tap' | 'point';

export interface CoachContent {
  mechanic: Mechanic;
  title: string;
  line: string; // one short instruction — names the action + the gesture
  gesture: Gesture;
  niyam: number; // Book chapter (1-based)
  niyamLabel: string;
  anchor: string | null; // where the mark sits + the ghost ends (a CSS selector), or null → fallback
  from: string | null; // the ghost's start for a drag (defaults to the hand band)
}

const HAND_ANCHOR = '[data-coach="hand"]'; // the wheel band — a drag ghost starts here
const FIRST_SET = '[data-drop^="set:"]'; // the first colour group on the board
const PLAY_ZONE = '[data-drop="play"]';

const CONTENT: Record<Mechanic, Omit<CoachContent, 'mechanic'>> = {
  bank: {
    title: 'Bank some money',
    line: 'Drag a money card down to your bank — you pay rent with cash, not property.',
    gesture: 'drag',
    niyam: 4,
    niyamLabel: 'Niyam 4: Money & Payment',
    anchor: '[data-drop="bank"]',
    from: HAND_ANCHOR,
  },
  place: {
    title: 'Place a property',
    line: 'Drag a property onto its colour group — collecting colours is how you win.',
    gesture: 'drag',
    niyam: 3,
    niyamLabel: 'Niyam 3: Properties & Wildcards',
    anchor: FIRST_SET,
    from: HAND_ANCHOR,
  },
  complete: {
    title: 'Complete a set',
    line: 'Add the last property to finish a colour — three finished colours wins the game.',
    gesture: 'drag',
    niyam: 1,
    niyamLabel: 'Niyam 1: Goal & Winning',
    anchor: FIRST_SET,
    from: HAND_ANCHOR,
  },
  wildcard: {
    title: 'Place a wildcard',
    line: 'A wildcard counts as any of its printed colours — drop it where it helps most.',
    gesture: 'drag',
    niyam: 3,
    niyamLabel: 'Niyam 3: Properties & Wildcards',
    anchor: FIRST_SET,
    from: HAND_ANCHOR,
  },
  building: {
    title: 'Build on a set',
    line: 'Drop a MAKAAN or HAVELI on a complete set to raise the rent it charges.',
    gesture: 'drag',
    niyam: 6,
    niyamLabel: 'Niyam 6: Action Cards',
    anchor: FIRST_SET,
    from: HAND_ANCHOR,
  },
  action: {
    title: 'Play an action card',
    line: 'Drag an action card to the centre to play it.',
    gesture: 'drag',
    niyam: 6,
    niyamLabel: 'Niyam 6: Action Cards',
    anchor: PLAY_ZONE,
    from: HAND_ANCHOR,
  },
  target: {
    title: 'Pick a target',
    line: 'This action hits an opponent — play it, then tap the glowing target.',
    gesture: 'drag',
    niyam: 6,
    niyamLabel: 'Niyam 6: Action Cards',
    anchor: PLAY_ZONE,
    from: HAND_ANCHOR,
  },
  lagaan: {
    title: 'Charge rent',
    line: 'Play LAGAAN to charge rent for a colour you own.',
    gesture: 'drag',
    niyam: 5,
    niyamLabel: 'Niyam 5: Kiraya & Dugna',
    anchor: PLAY_ZONE,
    from: HAND_ANCHOR,
  },
  dugna: {
    title: 'Double it with DUGNA',
    line: 'Attach a DUGNA to a rent charge to double what the opponent owes.',
    gesture: 'point',
    niyam: 5,
    niyamLabel: 'Niyam 5: Kiraya & Dugna',
    anchor: PLAY_ZONE,
    from: null,
  },
  rearrange: {
    title: 'Rearrange a wildcard',
    line: 'Drag a placed wildcard to another colour — it is free and never costs a play.',
    gesture: 'drag',
    niyam: 3,
    niyamLabel: 'Niyam 3: Properties & Wildcards',
    anchor: FIRST_SET,
    from: null,
  },
  pay: {
    title: 'Pay the charge',
    line: 'Pick cards from your bank to cover it — no change is given, so pay tight.',
    gesture: 'tap',
    niyam: 4,
    niyamLabel: 'Niyam 4: Money & Payment',
    anchor: null,
    from: null,
  },
  nahi: {
    title: 'Cancel it — NAHI CHALEGA',
    line: 'You hold a NAHI CHALEGA — play it to cancel the action played against you.',
    gesture: 'tap',
    niyam: 7,
    niyamLabel: 'Niyam 7: Nahi Chalega',
    anchor: null,
    from: null,
  },
  discard: {
    title: 'Discard down',
    line: 'You are over the hand limit — tap a card to bury it under the pile.',
    gesture: 'tap',
    niyam: 2,
    niyamLabel: 'Niyam 2: Your Turn',
    anchor: null,
    from: null,
  },
  declare: {
    title: 'Declare SAUDA!',
    line: 'Three complete sets — tap the turn token to declare and win.',
    gesture: 'tap',
    niyam: 1,
    niyamLabel: 'Niyam 1: Goal & Winning',
    anchor: '[data-coach="turn"]',
    from: null,
  },
};

// The full coach-mark content for a mechanic (copy + gesture + anchor + Book link).
export function coachFor(mechanic: Mechanic): CoachContent {
  return { mechanic, ...CONTENT[mechanic] };
}

// The Book has this many chapters (shell/Book.tsx); every coach mark's `niyam` must be in range. The
// onboarding test asserts this, so a coach can never link to a chapter that doesn't exist.
export const BOOK_CHAPTER_COUNT = 8;
