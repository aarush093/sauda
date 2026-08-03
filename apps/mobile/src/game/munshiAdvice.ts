/**
 * The Munshi advice COMPOSER (R6 — owner landscape directive, 2 Aug). The old advice lines
 * (labels.munshiAdviceLine) read generic — one templated sentence per recommendation `reason`, with
 * no read of the actual board. This composer keeps the bot's DECISION (which move + why, the frozen
 * @sauda/bots recommendation) but writes the SENTENCE in the UI layer from that recommendation PLUS
 * concrete facts drawn from the PUBLIC observation: set progress, a visible rival threat, bank
 * pressure, plays left.
 *
 * The rule, enforced by the tests: every line NAMES the move and cites at least one CONCRETE fact
 * derived from public state — and NEVER references hidden information (opponent hands, deck order).
 * Set progress, rival boards, bank totals, plays remaining and card values are all public. Opponent
 * HAND CONTENTS are not, and are never read here. packages/bots stays byte-identical — this is copy.
 */
import { SETS, SET_IDS } from '@sauda/engine';
import type { Action, Observation, SetId } from '@sauda/engine';
import type { MunshiAdvice } from '@sauda/bots';
import { actionCardId, cardValue, describeCard, describeThreat } from './labels';

// The set a placing / seizing / rearranging move concerns, or null (public, from the action itself).
function moveSet(action: Action): SetId | null {
  switch (action.type) {
    case 'PLACE_PROPERTY':
      return action.set;
    case 'RESPOND_PLACE_RECEIVED':
      return action.set;
    case 'REARRANGE_WILDCARD':
      return action.toSet;
    case 'PLAY_ACTION':
      return action.params.action === 'kabza' ? action.params.set : null;
    default:
      return null;
  }
}

// How many of a colour I would hold after placing one more, and the colour's size (public — my board
// is face-up). A set completes on card COUNT (properties + wildcards); buildings don't count toward it.
function setProgressAfterPlacing(observation: Observation, set: SetId): { after: number; size: number } {
  const size = SETS[set].size;
  let held = 0;
  for (const group of observation.myProperties[set]) {
    held = Math.max(held, group.cards.length);
  }
  return { after: Math.min(held + 1, size), size };
}

// The nearest rival one card from completing a colour — a public read of their face-up board. Returns
// a ready phrase or null. Scans in set order for stable, testable output.
export function nearestRivalThreat(observation: Observation): string | null {
  for (const opponent of observation.opponents) {
    for (const set of SET_IDS) {
      for (const group of opponent.properties[set]) {
        if (group.cards.length > 0 && group.cards.length === SETS[set].size - 1) {
          return `Bot ${opponent.id} is one card from a full ${SETS[set].label}`;
        }
      }
    }
  }
  return null;
}

// A short name for the recommended move — names WHAT to do (public, from the action).
function moveName(action: Action): string {
  switch (action.type) {
    case 'PLACE_PROPERTY':
      return `Place it in ${SETS[action.set].label}`;
    case 'BANK_CARD':
      return `Bank ${describeCard(action.cardId)}`;
    case 'PLAY_ACTION':
    case 'PLAY_KIRAYA':
      return `Play ${describeCard(action.cardId)}`;
    case 'REARRANGE_WILDCARD':
      return `Move your wildcard to ${SETS[action.toSet].label}`;
    case 'DECLARE_WIN':
      return 'Declare SAUDA!';
    case 'END_TURN':
      return 'End your turn';
    default:
      return 'Make this play';
  }
}

// Lowercase the first letter of a threat sentence so it reads inside a clause.
function inClause(sentence: string): string {
  return sentence.length > 0 ? sentence[0]!.toLowerCase() + sentence.slice(1) : sentence;
}

/**
 * Compose the advice line from the recommendation + the observation. Each branch names the move and
 * cites one concrete public fact. This is what the advice card shows (MunshiChip).
 */
export function composeMunshiAdvice(advice: MunshiAdvice, observation: Observation): string {
  switch (advice.reason) {
    case 'completesSet': {
      const set = moveSet(advice.action);
      if (set) {
        const { after, size } = setProgressAfterPlacing(observation, set);
        const label = SETS[set].label;
        return after >= size
          ? `Place it in ${label} — that makes ${after} of ${size}, a full set toward the three you need to win.`
          : `Place it in ${label} — that makes ${after} of ${size} toward the colour.`;
      }
      return 'Play this — it completes a set toward the three you need to win.';
    }

    case 'deniesSet': {
      const action = advice.action;
      if (action.type === 'PLAY_ACTION' && action.params.action === 'kabza') {
        const label = SETS[action.params.set].label;
        return `Play Kabza on Bot ${action.params.target}'s ${label} — you seize a finished colour and set their run at the win back.`;
      }
      return 'Play Kabza on that finished set — you seize a whole colour and set their run back.';
    }

    case 'protectsSet': {
      const threat = observation.interrupt ? describeThreat(observation.interrupt) : null;
      return threat
        ? `Play Nahi Chalega — ${inClause(threat)} That threat is worth spending your counter on.`
        : 'Play Nahi Chalega to cancel this — the threat is worth spending your counter on.';
    }

    case 'bestValue': {
      const cardId = actionCardId(advice.action);
      const value = cardId ? cardValue(cardId) : null;
      const name = cardId ? describeCard(cardId) : 'this';
      return value !== null
        ? `Take ${name} now — at ₹${value} Cr it is the best value on the board, so grab it before an opponent can.`
        : 'Take this now — it is the best value on the board, so grab it first.';
    }

    case 'preservesCounter': {
      const threat = nearestRivalThreat(observation);
      return threat
        ? `Let this one through — save your Nahi Chalega for a bigger threat (${threat}).`
        : 'Let this one through — no opponent is one card from a full set yet, so hold your Nahi Chalega for a bigger threat.';
    }

    case 'generic': {
      const plays = observation.playsRemaining;
      const playClause = `you have ${plays} play${plays === 1 ? '' : 's'} left this turn`;
      return `${moveName(advice.action)} — the soundest move on the board, and ${playClause}.`;
    }
  }
}
