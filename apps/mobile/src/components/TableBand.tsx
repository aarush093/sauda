/**
 * TABLE BAND (LANDSCAPE-2 L4). Auto-draw made the draw and discard piles display-only, and the
 * landscape rebuild then dropped them from the screen entirely — but a player still needs to READ the
 * shared table state: how many cards are left in the draw pile, and what was last discarded. This is
 * that readout and nothing more.
 *
 * It is deliberately NON-INTERACTIVE (pointer-events off, no tap, no drop): the turn-start draw is
 * automatic, so the pile is never a target — it is a gauge. It is a compact corner strip pinned over a
 * stage corner (the caller supplies the corner via `place`), on the low LAYERS.board tier so the
 * spotlight card and the drag ghost always draw above it, and it takes NO layout space (absolute), so
 * it can never push a column into a scroll.
 */
import type { CSSProperties } from 'react';
import type { CardId } from '@sauda/engine';
import { CardBack } from './CardBack';
import { ScaledCard } from './CardFace';
import { STAGE, FONT, INK, LAYERS } from '../design/tokens';

const PILE_CARD_PX = 26; // small enough to sit in a corner on the shortest (360px-tall) profile

export interface TableBandProps {
  drawCount: number;
  discardTop: CardId | undefined;
  // where in the (position:relative) parent to pin — callers pick a corner their stage leaves free.
  place: CSSProperties;
}

export function TableBand({ drawCount, discardTop, place }: TableBandProps) {
  return (
    <div data-zone="tableBand" aria-hidden style={{ ...bandStyle, ...place }}>
      {/* the face-down draw pile: one back + its remaining count, mono numerals like every other total */}
      <span style={pileStyle}>
        <CardBack width={PILE_CARD_PX} seal={false} />
        <span style={countStyle}>{drawCount}</span>
      </span>
      {/* the discard top: the last spent card, quiet under the sleep filter (or an empty slot outline) */}
      {discardTop ? (
        <span style={{ filter: STAGE.dimSleep, display: 'flex' }}>
          <ScaledCard cardId={discardTop} width={PILE_CARD_PX} />
        </span>
      ) : (
        <span style={emptyDiscardStyle} />
      )}
    </div>
  );
}

const bandStyle: CSSProperties = {
  position: 'absolute',
  zIndex: LAYERS.board, // under the spotlight card, the caption, and the drag ghost — a gauge, not a focus
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 6px',
  borderRadius: 8,
  background: STAGE.scrimSheet, // a faint inset well so the readout stays legible over any zone
  pointerEvents: 'none', // a gauge, never a target
};
const pileStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4 };
const countStyle: CSSProperties = {
  fontFamily: FONT.mono,
  fontWeight: 700,
  fontSize: 12,
  color: STAGE.cardCream,
};
const emptyDiscardStyle: CSSProperties = {
  width: PILE_CARD_PX,
  height: Math.round(PILE_CARD_PX * 1.45),
  border: `1px dashed ${INK.agedLine}`,
  borderRadius: 4,
  opacity: 0.5,
};
