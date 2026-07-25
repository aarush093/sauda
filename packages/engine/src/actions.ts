/**
 * The action grammar (§4.4, §5) — the complete list of things that can happen.
 *
 * `reduce` is the only mutator and consumes exactly these. `legalActions` returns
 * exactly these. Because every constraint lives in `legalActions`, and `reduce`
 * re-validates, a caller can only ever reach legal states — that is what
 * "illegal states are unrepresentable" means in this engine.
 */
import type { SetId } from './types';
import type { CardId, PlayerId } from './state';

// Parameters for PLAY_ACTION, one shape per action kind that needs targeting.
export type ActionParams =
  | { action: 'aageBadho' } // draw 2 now (§5)
  | { action: 'makaan'; set: SetId } // place on your complete set
  | { action: 'haveli'; set: SetId } // place on a complete set that has a makaan
  | { action: 'vasooli'; target: PlayerId } // charge ₹5 from one opponent
  | { action: 'shagun' } // every opponent pays ₹2
  | { action: 'kabza'; target: PlayerId; set: SetId } // take a complete set
  | { action: 'haathKiSafai'; target: PlayerId; cardId: CardId } // take one property (not from a complete set)
  | { action: 'adlaBadli'; myCardId: CardId; target: PlayerId; theirCardId: CardId }; // swap

export type Action =
  // --- turn flow ---
  | { type: 'DRAW' } // §4.4 step 2
  | { type: 'END_TURN' }
  | { type: 'DISCARD'; cardId: CardId } // §4.4 step 4: down to hand limit
  | { type: 'DECLARE_WIN' } // §4.1: own turn only
  // --- the three "plays" (§4.4 step 3) ---
  | { type: 'BANK_CARD'; cardId: CardId }
  | { type: 'PLACE_PROPERTY'; cardId: CardId; set: SetId }
  | { type: 'PLAY_ACTION'; cardId: CardId; params: ActionParams }
  // KIRAYA is its own play: choose a colour you own; DUGNA cards attach to double it.
  | { type: 'PLAY_KIRAYA'; cardId: CardId; color: SetId; target: PlayerId | null; dugnaCardIds: CardId[] }
  // --- free, own-turn only (§4.4): not a play ---
  | { type: 'REARRANGE_WILDCARD'; cardId: CardId; toSet: SetId }
  // --- responses (only legal while an interrupt is open; NAHI works off-turn) ---
  | { type: 'RESPOND_NAHI_CHALEGA'; cardId: CardId }
  | { type: 'RESPOND_ALLOW' }
  | { type: 'RESPOND_PAY'; cardIds: CardId[] }
  | { type: 'RESPOND_PLACE_RECEIVED'; cardId: CardId; set: SetId };
