/**
 * The inflated, thumb-sized DROP BAND (P3, owner phone test 1 Aug). The owner's deal-breaker: a
 * legal MAKAAN onto a complete set was effectively unplaceable — the drop targets were smaller than
 * a thumb. This band shows ONLY while a card is being dragged, overlaying my property board (the
 * generous space the P1 zone law leaves in my area), and turns every eligible destination into a
 * target you can't miss:
 *   • one big slot PER ELIGIBLE SET, >=64px tall, carrying the set's own banner colour + name;
 *   • a bank strip, >=72px tall, on the right half, when the card can be banked.
 * Each slot carries the SAME data-drop id the in-place zone used, so the K1 magnet, the DOM
 * hit-test and the P3 near-miss all keep working unchanged — they just find a far bigger target.
 * While the band is up the in-place group/bank data-drop is suppressed (GroupRow/BankTray
 * suppressDrop), so there is exactly one target per zone and the magnet reads the big rect.
 */
import type { CSSProperties } from 'react';
import { SETS } from '@sauda/engine';
import type { SetId } from '@sauda/engine';
import { STAGE, INK, FONT, GLOW, LAYERS, SHADOW } from '../design/tokens';

const SLOT_MIN_H = 64; // P3: a set slot is at least a thumb tall
const BANK_MIN_H = 72; // P3: the bank strip is a touch taller still

export function DropBand({
  sets,
  bankEligible,
  hotZoneId,
}: {
  sets: SetId[]; // the eligible destination sets for the dragged card (already derived from legalActions)
  bankEligible: boolean; // the dragged card can be banked
  hotZoneId: string | null; // the zone under the pointer right now — drawn hot
}) {
  return (
    <div style={bandStyle}>
      {/* the set slots — one per eligible set, stacked so each stays a full thumb tall */}
      {sets.length > 0 && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sets.map((set) => {
            const hot = hotZoneId === `set:${set}`;
            return (
              <div key={set} data-drop={`set:${set}`} style={setSlotStyle(SETS[set].hex, hot)}>
                {SETS[set].label}
              </div>
            );
          })}
        </div>
      )}
      {/* the bank strip — the right half when sharing with set slots, else the whole band */}
      {bankEligible && (
        <div data-drop="bank" style={bankStripStyle(hotZoneId === 'bank', sets.length > 0)}>
          Bank
        </div>
      )}
    </div>
  );
}

// The band fills the property-board area (its parent is the my-area growth region, P1). It sits above
// the board but below the drag ghost (LAYERS.dropBand). The container is pointer-events:none so it
// never eats a scrub outside a slot; each slot re-enables pointer events so elementFromPoint (the
// hit-test) resolves to it.
const bandStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: LAYERS.dropBand,
  display: 'flex',
  gap: 8,
  padding: 8,
  pointerEvents: 'none',
};

// A set slot: its own banner colour as a translucent wash on the felt, a bold gold keyline, the set
// name large and readable. Hot (under the pointer) gets the one gold glow; eligible-not-hot a soft
// keyline — same "one glow" law as the rest of the board.
function setSlotStyle(hex: string, hot: boolean): CSSProperties {
  return {
    pointerEvents: 'auto',
    flex: 1,
    minHeight: SLOT_MIN_H,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    border: `2px solid ${INK.gold}`,
    // the set's banner colour, quiet, over the felt — enough to tell two slots apart at a glance
    background: `linear-gradient(0deg, ${STAGE.scrimSheet}, ${STAGE.scrimSheet}), ${hex}`,
    backgroundBlendMode: 'multiply',
    boxShadow: hot ? GLOW.hot : GLOW.soft,
    color: STAGE.cardCream,
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 15,
    textShadow: SHADOW.titleKeyline, // dark halo so the cream name stays legible over any banner colour
  };
}

function bankStripStyle(hot: boolean, sharesWithSets: boolean): CSSProperties {
  return {
    pointerEvents: 'auto',
    flex: sharesWithSets ? '0 0 46%' : '1', // the right half when sets share the band, else the whole width
    minHeight: BANK_MIN_H,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    border: `2px solid ${INK.gold}`,
    background: STAGE.scrimSheet,
    boxShadow: hot ? GLOW.hot : GLOW.soft,
    color: STAGE.accentGold,
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 16,
  };
}
