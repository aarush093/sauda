/**
 * Legal-verb grouping for a hand card (v1.2 A1; STATE_MATRIX rows B1-B19). Given the engine's
 * legalActions and a hand card, it groups that card's legal moves into the small set of VERBS it
 * offers (Place / Build / Play / Charge / Bank). It decides NOTHING about legality — it only
 * regroups legalActions for display. All rules stay in @sauda/engine.
 *
 * NOTE (G1, owner playtest 2): the tap→stage→RAIL UI these verbs once drove is RETIRED — a tapped
 * hand card now INSPECTS (read-only), and drag is the only commit path. This grouping survives as
 * the source of truth the inspect why-line reads to tell whether a card's canonical verb is
 * currently offered (InspectCard) — and stays unit-tested (staging.test.ts) as pure logic.
 *
 * The tricky bit — why a verb carries a LIST of options:
 * one card can offer the same verb in several concrete forms. A wildcard "Place"s in two
 * colours; a LAGAAN "Charge"s several colour/target/doubling combinations; a KABZA can
 * hit several sets. So each verb holds an `options` list — one entry per concrete engine
 * action. A verb with a single option commits on one tap; a verb with several drills down
 * to labelled option chips, still exactly one engine action per chip. The verb set stays
 * tiny (Place / Build / Play / Charge / Bank); the multiplicity lives in the drill-down,
 * matching the mockup's terse rail.
 */
import { SETS } from '@sauda/engine';
import type { Action, ActionParams } from '@sauda/engine';
import { actionCardId, cardValue, describeCard } from './labels';

export interface RailOption {
  key: string; // stable React key + identity for the option chip
  label: string; // the concise differentiator (a colour, a target, a steal)
  action: Action; // the exact engine action dispatched when this option commits
}

export interface RailVerb {
  key: string; // 'place' | 'build' | 'play' | 'charge' | 'bank'
  label: string; // the verb button text, e.g. "Place" or "Bank ₹4 Cr"
  primary: boolean; // exactly one verb is the gold-filled primary (A1)
  options: RailOption[]; // one option → commit on tap; several → drill to chips
}

// Build the rail for one staged hand card: its legal verbs, in a stable order, with
// exactly one marked primary. Only the four "play" action kinds become rail verbs;
// DRAW / END_TURN / DISCARD / REARRANGE / responses are handled elsewhere.
export function railForCard(actions: Action[], cardId: string): RailVerb[] {
  const place: RailOption[] = [];
  const build: RailOption[] = [];
  const play: RailOption[] = [];
  const charge: RailOption[] = [];
  let bankAction: Action | null = null;

  for (const action of actions) {
    if (actionCardId(action) !== cardId) {
      continue;
    }
    switch (action.type) {
      case 'BANK_CARD':
        bankAction = action;
        break;
      case 'PLACE_PROPERTY':
        place.push({ key: `place-${action.set}`, label: SETS[action.set].label, action });
        break;
      case 'PLAY_ACTION':
        addPlayOrBuildOption(action, play, build);
        break;
      case 'PLAY_KIRAYA':
        charge.push({ key: chargeKey(action), label: chargeLabel(action), action });
        break;
      default:
        break; // not a rail play (DISCARD / REARRANGE / turn-flow / responses)
    }
  }

  // Effect verbs first (the card's reason to exist); Bank last as the money option.
  const verbs: RailVerb[] = [];
  if (place.length > 0) {
    verbs.push({ key: 'place', label: 'Place', primary: false, options: place });
  }
  if (build.length > 0) {
    verbs.push({ key: 'build', label: 'Build', primary: false, options: build });
  }
  if (play.length > 0) {
    verbs.push({ key: 'play', label: 'Play', primary: false, options: play });
  }
  if (charge.length > 0) {
    verbs.push({ key: 'charge', label: 'Charge', primary: false, options: charge });
  }
  if (bankAction !== null) {
    const value = cardValue(cardId) ?? 0;
    verbs.push({
      key: 'bank',
      label: `Bank ₹${value} Cr`,
      primary: false,
      options: [{ key: 'bank', label: 'Bank', action: bankAction }],
    });
  }

  // A1: exactly one gold-filled primary — the first verb (the effect, or Bank when that
  // is all the card offers, e.g. a money card).
  const firstVerb = verbs[0];
  if (firstVerb) {
    firstVerb.primary = true;
  }
  return verbs;
}

// Route a PLAY_ACTION to the Build verb (makaan/haveli attach to your own sets) or the
// Play verb (every other action), and give it a concise label for its drill-down chip.
function addPlayOrBuildOption(
  action: Extract<Action, { type: 'PLAY_ACTION' }>,
  play: RailOption[],
  build: RailOption[],
): void {
  const params = action.params;
  switch (params.action) {
    case 'makaan':
    case 'haveli':
      build.push({ key: `build-${params.action}-${params.set}`, label: SETS[params.set].label, action });
      return;
    default:
      play.push({ key: playKey(params), label: playLabel(params), action });
      return;
  }
}

// A short label naming the target of a play, shown on its drill-down chip.
function playLabel(params: ActionParams): string {
  switch (params.action) {
    case 'aageBadho':
      return 'Draw 2';
    case 'shagun':
      return 'All opponents';
    case 'vasooli':
      return `Player ${params.target}`;
    case 'kabza':
      return `Player ${params.target} · ${SETS[params.set].label}`;
    case 'haathKiSafai':
      return `Player ${params.target} · ${describeCard(params.cardId)}`;
    case 'adlaBadli':
      return `${describeCard(params.myCardId)} ⇄ P${params.target} ${describeCard(params.theirCardId)}`;
    default:
      return 'Play';
  }
}

function playKey(params: ActionParams): string {
  switch (params.action) {
    case 'vasooli':
      return `play-vasooli-${params.target}`;
    case 'kabza':
      return `play-kabza-${params.target}-${params.set}`;
    case 'haathKiSafai':
      return `play-hks-${params.target}-${params.cardId}`;
    case 'adlaBadli':
      return `play-adla-${params.myCardId}-${params.target}-${params.theirCardId}`;
    default:
      return `play-${params.action}`;
  }
}

// A LAGAAN charge names its colour, any ×2/×4 doubling, and its target — "all" opponents
// for a paired card, one chosen opponent for the wild card (B14/B15).
function chargeLabel(action: Extract<Action, { type: 'PLAY_KIRAYA' }>): string {
  const doubling = action.dugnaCardIds.length > 0 ? ` ×${2 ** action.dugnaCardIds.length}` : '';
  const who = action.target === null ? 'all' : `Player ${action.target}`;
  return `${SETS[action.color].label}${doubling} · ${who}`;
}

function chargeKey(action: Extract<Action, { type: 'PLAY_KIRAYA' }>): string {
  return `charge-${action.color}-${action.target ?? 'all'}-${action.dugnaCardIds.length}`;
}
