/**
 * The interaction reducer (v1.2 A10). PURE and DOM-free: given the engine's
 * `legalActions` and a UI intent — a hand card dropped on a zone, a target tapped, a
 * placed wildcard dragged — it returns the exact engine `Action` to dispatch (or nothing
 * when the intent is illegal). It decides NO rules: every action it hands back was
 * already enumerated by `legalActions`, so the drag path and the tap rail (`staging.ts`)
 * fire byte-identical actions (parity), and an illegal drop produces nothing (law L5).
 *
 * Why a separate module: the drag layer and the tap rail are two roads to the same moves.
 * Putting the single "intent → engine action" mapping here, unit-tested without a DOM,
 * makes that guarantee mechanical instead of eyeballed across two components.
 */
import { SETS } from '@sauda/engine';
import type { Action, CardId, Observation, PlayerId, SetId } from '@sauda/engine';
import { recommend } from '@sauda/bots';
import type { Difficulty } from '@sauda/bots';
import { actionCardId, cardValue, describeCard } from './labels';

// A concrete PLAY_ACTION / PLAY_KIRAYA, narrowed for the target builders below.
type PlayActionMove = Extract<Action, { type: 'PLAY_ACTION' }>;
type KirayaMove = Extract<Action, { type: 'PLAY_KIRAYA' }>;

// ---------------------------------------------------------------------------
// Drop zones — dragging a HAND card onto the table.
// ---------------------------------------------------------------------------

export type DropZoneKind = 'bank' | 'set' | 'play';

export interface DropZone {
  kind: DropZoneKind;
  set?: SetId; // present on 'set' zones (place a property/wildcard, or build on a set)
  label: string; // the hover label shown before release, e.g. "Bank ₹4 Cr"
  action: Action | null; // fire on drop; null ⇒ the drop opens TARGETING (a pick follows)
}

// The legal drop zones for one dragged hand card, derived only from legalActions (L5).
// A wildcard never yields a bank zone because the engine never offers BANK_CARD for one
// (A4 · legal.ts:166) — so "no wildcard is bankable" holds here by construction, not by a
// hardcoded rule.
export function dropZonesForCard(actions: Action[], cardId: CardId): DropZone[] {
  const mine = actions.filter((action) => actionCardId(action) === cardId);
  const zones: DropZone[] = [];

  const bank = mine.find((action) => action.type === 'BANK_CARD');
  if (bank) {
    zones.push({ kind: 'bank', label: `Bank ₹${cardValue(cardId) ?? 0} Cr`, action: bank });
  }

  // Place: one set zone per legal colour (a property's own set, or each wildcard colour).
  for (const action of mine) {
    if (action.type === 'PLACE_PROPERTY') {
      zones.push({ kind: 'set', set: action.set, label: `Place · ${SETS[action.set].label}`, action });
    }
  }

  // Build: MAKAAN / HAVELI drop onto one of my complete sets (matrix B19).
  for (const action of mine) {
    if (action.type === 'PLAY_ACTION' && (action.params.action === 'makaan' || action.params.action === 'haveli')) {
      const verb = action.params.action === 'makaan' ? 'MAKAAN' : 'HAVELI';
      zones.push({ kind: 'set', set: action.params.set, label: `Build ${verb} · ${SETS[action.params.set].label}`, action });
    }
  }

  // Play: the centre zone for actions/kiraya that resolve there. Exactly one candidate
  // fires on drop; several (a target or colour still to pick) open TARGETING (action=null).
  const candidates = centrePlayCandidates(mine);
  if (candidates.length === 1) {
    zones.push({ kind: 'play', label: playLabel(candidates[0]!), action: candidates[0]! });
  } else if (candidates.length > 1) {
    zones.push({ kind: 'play', label: playLabel(candidates[0]!), action: null });
  }

  return zones;
}

// The moves that resolve on the centre PLAY zone: every PLAY_ACTION except the two that
// build on my own sets (those are 'set' zones), plus every PLAY_KIRAYA.
function centrePlayCandidates(mine: Action[]): Action[] {
  return mine.filter(
    (action) =>
      (action.type === 'PLAY_ACTION' && action.params.action !== 'makaan' && action.params.action !== 'haveli') ||
      action.type === 'PLAY_KIRAYA',
  );
}

function playLabel(action: Action): string {
  return action.type === 'PLAY_KIRAYA' ? 'Charge LAGAAN' : 'Play';
}

// ---------------------------------------------------------------------------
// Targeting — a played action still needs a target (glow only legal ones, tap to fire).
// ---------------------------------------------------------------------------

export type TargetRef =
  | { kind: 'opponent'; player: PlayerId } // VASOOLI, wild LAGAAN
  | { kind: 'opponentSet'; player: PlayerId; set: SetId } // KABZA
  | { kind: 'property'; player: PlayerId; cardId: CardId }; // HAATH KI SAFAI, ADLA-BADLI

export interface TargetChoice {
  key: string; // stable React key / identity
  ref: TargetRef; // the board element to glow
  label: string;
  action?: Action; // fire this if the pick completes the play
  next?: TargetStep; // otherwise, the next pick's glowing choices
}

export interface TargetStep {
  prompt: string;
  choices: TargetChoice[];
}

// The first targeting step for a played ACTION card (kiraya has its own plan below). One
// pick for VASOOLI/KABZA/HAATH KI SAFAI; two for ADLA-BADLI (mine, then theirs). Returns
// null when there is nothing to pick (a single candidate fired on drop).
export function actionTargeting(actions: Action[], cardId: CardId, me: PlayerId): TargetStep | null {
  const play = actions.filter(
    (action): action is PlayActionMove =>
      action.type === 'PLAY_ACTION' &&
      actionCardId(action) === cardId &&
      action.params.action !== 'makaan' &&
      action.params.action !== 'haveli',
  );
  if (play.length <= 1) {
    return null;
  }
  switch (play[0]!.params.action) {
    case 'vasooli':
      return vasooliStep(play);
    case 'kabza':
      return kabzaStep(play);
    case 'haathKiSafai':
      return haathKiSafaiStep(play);
    case 'adlaBadli':
      return adlaBadliStep(play, me);
    default:
      return null; // SHAGUN / AAGE BADHO are untargeted and never reach here
  }
}

function vasooliStep(play: PlayActionMove[]): TargetStep {
  return {
    prompt: 'Charge which opponent?',
    choices: play.flatMap((action) => {
      if (action.params.action !== 'vasooli') return [];
      const target = action.params.target;
      return [{ key: `p${target}`, ref: { kind: 'opponent', player: target }, label: `Player ${target}`, action }];
    }),
  };
}

function kabzaStep(play: PlayActionMove[]): TargetStep {
  return {
    prompt: 'Seize which set?',
    choices: play.flatMap((action) => {
      if (action.params.action !== 'kabza') return [];
      const { target, set } = action.params;
      return [{ key: `p${target}-${set}`, ref: { kind: 'opponentSet', player: target, set }, label: `P${target} · ${SETS[set].label}`, action }];
    }),
  };
}

function haathKiSafaiStep(play: PlayActionMove[]): TargetStep {
  return {
    prompt: 'Take which property?',
    choices: play.flatMap((action) => {
      if (action.params.action !== 'haathKiSafai') return [];
      const { target, cardId } = action.params;
      return [{ key: `p${target}-${cardId}`, ref: { kind: 'property', player: target, cardId }, label: `P${target} · ${describeCard(cardId)}`, action }];
    }),
  };
}

// ADLA-BADLI: pick one of MY properties, then one of THEIRS to swap it for.
function adlaBadliStep(play: PlayActionMove[], me: PlayerId): TargetStep {
  const myCardIds = distinct(
    play.flatMap((action) => (action.params.action === 'adlaBadli' ? [action.params.myCardId] : [])),
  );
  return {
    prompt: 'Give which of your properties?',
    choices: myCardIds.map((myCardId) => ({
      key: `mine-${myCardId}`,
      ref: { kind: 'property', player: me, cardId: myCardId },
      label: describeCard(myCardId),
      next: {
        prompt: 'Take which of theirs?',
        choices: play.flatMap((action) => {
          if (action.params.action !== 'adlaBadli' || action.params.myCardId !== myCardId) return [];
          const { target, theirCardId } = action.params;
          return [{ key: `theirs-p${target}-${theirCardId}`, ref: { kind: 'property', player: target, cardId: theirCardId }, label: `P${target} · ${describeCard(theirCardId)}`, action }];
        }),
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// S3 ASSIST — the difficulty-gated best-target hint (owner-directed).
// ---------------------------------------------------------------------------

// The KEY of the target choice the frozen full-strength recommend() favours for THIS card — the UI
// bounces / brightens it as a gentle hint on easy/medium tables. READ-ONLY: it never changes what is
// targetable (legalActions is untouched), so BAD_TARGET stays unreachable. Returns null on the HARD
// tier (no hint), and when there is nothing to single out (one target, or no clear best). recommendFn
// is injectable for the unit test. Determinism/strength: recommend is called at full strength ('hard')
// so the hint is the BEST target; the tier gates only whether the hint is SHOWN.
export function assistHintKey(
  observation: Observation,
  actions: Action[],
  cardId: CardId,
  me: PlayerId,
  difficulty: Difficulty,
  recommendFn: typeof recommend = recommend,
): string | null {
  if (difficulty === 'hard') {
    return null; // hard: no hint — the player reads the board unaided (already-locked decision)
  }
  // Only THIS card's targeted plays — recommend ranks among them to find its preferred target.
  const subset = actions.filter(
    (action) =>
      (action.type === 'PLAY_ACTION' &&
        actionCardId(action) === cardId &&
        action.params.action !== 'makaan' &&
        action.params.action !== 'haveli') ||
      (action.type === 'PLAY_KIRAYA' && action.cardId === cardId),
  );
  if (subset.length <= 1) {
    return null; // a single target fires without a pick → nothing to hint
  }
  const best = recommendFn(observation, subset, 'hard').action; // full-strength BEST target
  if (best.type === 'PLAY_KIRAYA') {
    return best.color; // the LAGAAN colour choice is keyed by its SetId
  }
  const step = actionTargeting(actions, cardId, me);
  if (!step) {
    return null;
  }
  // The choice whose action IS `best` (same object, both filtered from `actions`), or — for the
  // two-step ADLA-BADLI — the first-step choice whose sub-step contains it.
  for (const choice of step.choices) {
    if (choice.action === best) {
      return choice.key;
    }
    if (choice.next && choice.next.choices.some((c) => c.action === best)) {
      return choice.key;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// LAGAAN plan — colour + (paired: all / wild: one opponent) + DUGNA attach (L6, B14/B15).
// ---------------------------------------------------------------------------

export interface DugnaOption {
  count: number; // how many DUGNA cards attach (0, 1, 2)
  label: string; // "×1" / "×2" / "×4"
  cardIds: CardId[]; // the canonical DUGNA card ids the engine expects for this count
}

export interface KirayaColorChoice {
  color: SetId;
  label: string;
}

export interface KirayaPlan {
  colors: KirayaColorChoice[]; // owned colours this LAGAAN may charge
  dugna: DugnaOption[]; // the ×1/×2/×4 attach chips (L6)
  targeted: boolean; // wild LAGAAN charges ONE chosen opponent; paired charges ALL
  opponents: PlayerId[]; // legal opponents when targeted
  // The exact engine PLAY_KIRAYA for a finished set of picks, or undefined if illegal.
  resolve: (color: SetId, dugnaCount: number, target: PlayerId | null) => Action | undefined;
}

// Build the LAGAAN staging plan from the enumerated PLAY_KIRAYA moves, or null if this
// card is not a kiraya with any legal charge. `resolve` only ever returns a move the
// engine already enumerated, so BAD_TARGET / COLOR_NOT_OWNED are unreachable from the UI.
export function kirayaPlan(actions: Action[], cardId: CardId): KirayaPlan | null {
  const charges = actions.filter(
    (action): action is KirayaMove => action.type === 'PLAY_KIRAYA' && action.cardId === cardId,
  );
  if (charges.length === 0) {
    return null;
  }

  const colors = distinct(charges.map((charge) => charge.color)).map((color) => ({ color, label: SETS[color].label }));
  const targeted = charges.some((charge) => charge.target !== null);
  const opponents = distinct(
    charges.flatMap((charge) => (charge.target === null ? [] : [charge.target])),
  );

  const dugnaCounts = distinct(charges.map((charge) => charge.dugnaCardIds.length)).sort((a, b) => a - b);
  const dugna: DugnaOption[] = dugnaCounts.map((count) => {
    const sample = charges.find((charge) => charge.dugnaCardIds.length === count)!;
    return { count, label: `×${2 ** count}`, cardIds: sample.dugnaCardIds };
  });

  const resolve = (color: SetId, dugnaCount: number, target: PlayerId | null): Action | undefined =>
    charges.find(
      (charge) => charge.color === color && charge.dugnaCardIds.length === dugnaCount && charge.target === target,
    );

  return { colors, dugna, targeted, opponents, resolve };
}

// ---------------------------------------------------------------------------
// Rearrange a PLACED wildcard (free, own turn — matrix B8).
// ---------------------------------------------------------------------------

export interface RearrangeTarget {
  set: SetId;
  label: string;
  action: Action;
}

export function rearrangeDestinations(actions: Action[], cardId: CardId): RearrangeTarget[] {
  const out: RearrangeTarget[] = [];
  for (const action of actions) {
    if (action.type === 'REARRANGE_WILDCARD' && action.cardId === cardId) {
      out.push({ set: action.toSet, label: `Move to ${SETS[action.toSet].label}`, action });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Turn-flow auto-resolves (L1 / L4).
// ---------------------------------------------------------------------------

// The DRAW to auto-play at turn start (L4), or null when it is not offered.
export function autoDrawAction(actions: Action[]): Action | null {
  return actions.find((action) => action.type === 'DRAW') ?? null;
}

// F2 (owner playtest 30 Jul — an A10/L4 refinement): the turn auto-ends only when END_TURN is
// the SOLE legal move. When the human has used their plays and holds no free move, the engine
// offers exactly [END_TURN]; the UI then moves the turn on itself instead of making the player
// tap a button that reads as "asking permission". Anything else legal — a play, a declarable
// DECLARE_WIN, a free REARRANGE_WILDCARD — keeps End turn MANUAL so it is never eaten.
export function shouldAutoEndTurn(actions: Action[]): boolean {
  return actions.length === 1 && actions[0]!.type === 'END_TURN';
}

// Bot pacing as ONE constant table (H5, RAISED in P4 — owner "bots tooo fast" on the phone). A bot's
// turn plays as a run of beats (draw · each play · end), each held long enough to be watchable (I1).
// These are COMPREHENSION timings, NOT decoration: they are plain setTimeout delays, so they are the
// SAME whether motion is full or reduced — the reveal HOLD and the turn beats persist under
// prefers-reduced-motion (only the transforms go instant, in motion.ts). The FIRST beat holds
// longest ("here comes the bot"); later beats are quicker; as a turn nears its cap the beats trim
// toward a floor so a long turn never drags — but every card is still SHOWN (we slow, never skip).
// The owner tunes these on-device; raised from 700/450/350/3000 which still read as too fast.
export const BOT_PACING = {
  firstBeatMs: 900, // the opening beat of a bot's turn — longest, so the turn's start reads
  beatMs: 600, // each subsequent beat within the same turn
  floorMs: 400, // never faster than this — a card must still be seen
  turnCapMs: 4000, // soft cap: once a turn has shown this much, beats trim toward the floor
} as const;

// The delay BEFORE the next beat of a bot's turn, given how many beats this turn has already shown
// (beatIndex, 0-based) and how much presentation time they have taken (elapsedMs). Pure + unit-tested.
export function botBeatDelayMs(beatIndex: number, elapsedMs: number, pacing = BOT_PACING): number {
  if (beatIndex === 0) {
    return pacing.firstBeatMs;
  }
  // Trim evenly toward the floor as the turn's ~3s budget is consumed, so a long turn tightens up
  // instead of dragging — but never below the floor (a beat is always long enough to be seen).
  const remaining = pacing.turnCapMs - elapsedMs;
  return Math.max(pacing.floorMs, Math.min(pacing.beatMs, remaining));
}

// C4: a charge I cannot pay anything toward. The engine still opens a payment step whose
// ONLY legal move is an empty RESPOND_PAY (suggestPayment returns [] iff the table is
// worth nothing). Returns that move to auto-submit — no interactive sheet — or null.
export function zeroPayableResponse(actions: Action[], payableCount: number): Action | null {
  if (payableCount > 0) {
    return null;
  }
  const pay = actions.find((action) => action.type === 'RESPOND_PAY');
  if (pay && pay.type === 'RESPOND_PAY' && pay.cardIds.length === 0) {
    return pay;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Coverage helper — every engine move a hand card offers, reachable via drag.
// The parity test asserts this equals the tap rail's reachable set and legalActions.
// ---------------------------------------------------------------------------

export function reachableActionsForCard(actions: Action[], cardId: CardId, me: PlayerId): Action[] {
  const out: Action[] = [];

  for (const zone of dropZonesForCard(actions, cardId)) {
    if (zone.action) {
      out.push(zone.action);
    }
  }

  const step = actionTargeting(actions, cardId, me);
  if (step) {
    out.push(...flattenStep(step));
  }

  const plan = kirayaPlan(actions, cardId);
  if (plan) {
    for (const { color } of plan.colors) {
      for (const { count } of plan.dugna) {
        const targets: (PlayerId | null)[] = plan.targeted ? plan.opponents : [null];
        for (const target of targets) {
          const action = plan.resolve(color, count, target);
          if (action) {
            out.push(action);
          }
        }
      }
    }
  }

  return out;
}

function flattenStep(step: TargetStep): Action[] {
  const out: Action[] = [];
  for (const choice of step.choices) {
    if (choice.action) {
      out.push(choice.action);
    }
    if (choice.next) {
      out.push(...flattenStep(choice.next));
    }
  }
  return out;
}

function distinct<T>(values: T[]): T[] {
  return [...new Set(values)];
}
