/**
 * The spectate STAGE CAPTION (R2 — owner landscape directive, 2 Aug). PHONE flag: bot-play text was
 * rendering BEHIND the card on centre stage (the hidden-text bug). The fix is to move the label OUT
 * from under the card to a short caption BESIDE it, pinned ABOVE the stage on the shared LAYERS scale
 * so nothing can ever occlude it. Format is "B2 · Chennai Central" — a gold seat chip + a short name
 * (built by shortLabel in labels.ts) — bright cream on indigo, one line, never wrapping.
 *
 * It is presentational only: it renders whatever caption string the board hands it (or nothing).
 */
import type { CSSProperties } from 'react';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

// Split a "B2 · Chennai Central" caption into its seat chip and the rest. If there is no separator we
// render the whole thing as the label (defensive — shortLabel always includes the chip).
function splitCaption(text: string): { seat: string | null; rest: string } {
  const separator = text.indexOf(' · ');
  if (separator === -1) {
    return { seat: null, rest: text };
  }
  return { seat: text.slice(0, separator), rest: text.slice(separator + 3) };
}

export function StageCaption({ text }: { text: string | null }) {
  if (!text) {
    return null;
  }
  const { seat, rest } = splitCaption(text);
  return (
    <div style={captionStyle}>
      {seat && <span style={seatChipStyle}>{seat}</span>}
      <span style={labelStyle}>{rest}</span>
    </div>
  );
}

// Pinned to the TOP of the stage cell, above the card (LAYERS.badge — the same "over its card art"
// tier the pinned badges use), so it can never sit behind the spotlight card again. pointer-events off
// (it is a read-out, not a target).
const captionStyle: CSSProperties = {
  position: 'absolute',
  top: 4,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: LAYERS.badge,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  maxWidth: '96%',
  padding: '3px 8px',
  borderRadius: 999,
  background: STAGE.scrimSheet, // a dark inset well so the cream label stays legible over any card
  pointerEvents: 'none',
};
const seatChipStyle: CSSProperties = {
  flexShrink: 0,
  padding: '0 6px',
  borderRadius: 999,
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 11,
  lineHeight: '16px',
};
const labelStyle: CSSProperties = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 13,
  color: STAGE.cardCream,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
