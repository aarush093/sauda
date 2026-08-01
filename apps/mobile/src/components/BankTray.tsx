/**
 * The BANK TRAY (K4, owner reorder 31 Jul) — the bank as a first-class landing target with its own
 * visual identity, replacing the dashed ₹0 box. A vintage brass/ledger tray anchored at the right of
 * my row:
 *   • the top few banked notes as REAL mini card faces, cascaded (the bank is public by rule), and
 *     the total in gold mono;
 *   • empty state is a quiet embossed tray — no dashes;
 *   • while a bankable card is in the air the tray EXPANDS into a generous landing strip (it grows
 *     leftward toward the centre; the flex row yields) and glows soft, hot under the pointer. Because
 *     the drag controller re-reads this zone's rect every frame, the K1 magnet follows the tray as it
 *     grows — no extra wiring.
 *
 * It carries `data-drop="bank"`, so it IS the drop zone; the zone semantics are unchanged (the engine
 * only ever offers BANK_CARD for money / bankable actions, never a wildcard — A4).
 */
import type { CSSProperties } from 'react';
import { ScaledCard } from './CardFace';
import { STAGE, INK, FONT, GLOW, SHADOW } from '../design/tokens';

const NOTE_WIDTH = 22; // a banked note's mini face
const NOTE_OFFSET = 9; // how far each cascaded note steps right
const MAX_NOTES = 3; // show at most the top three faces; the total carries the rest
const COLLAPSED_MIN = 84; // the tray's resting width
const EXPANDED_MIN = 150; // the landing strip while a bankable card is dragged (fits 346 with the row)

export function BankTray({
  cards,
  total,
  eligible,
  hot,
  suppressDrop,
}: {
  cards: string[]; // the banked card ids (public); the newest are shown on top of the cascade
  total: number;
  eligible: boolean; // a bankable card is in the air → expand into a landing strip + soft glow
  hot: boolean; // the pointer is over the tray → hot glow
  // P3: while the inflated drop band is up it owns the bank strip, so the header tray drops its
  // data-drop (stays as a display of the bank total) — one bank target, thumb-sized, in the band.
  suppressDrop?: boolean | undefined;
}) {
  // Show the top few notes (most-recent last in the array → they sit on top of the cascade).
  const shown = cards.slice(-MAX_NOTES);
  const empty = cards.length === 0;

  return (
    <div data-drop={suppressDrop ? undefined : 'bank'} style={trayStyle(eligible && !suppressDrop, hot && !suppressDrop)}>
      {empty ? (
        <span style={emptyLabelStyle}>Bank</span>
      ) : (
        <div style={{ position: 'relative', width: NOTE_WIDTH + (shown.length - 1) * NOTE_OFFSET, height: Math.round(NOTE_WIDTH * 1.45), flexShrink: 0 }}>
          {shown.map((cardId, index) => (
            <div key={cardId} style={{ position: 'absolute', left: index * NOTE_OFFSET, top: 0 }}>
              <ScaledCard cardId={cardId} width={NOTE_WIDTH} />
            </div>
          ))}
        </div>
      )}
      <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, color: empty ? STAGE.textOnFelt : STAGE.accentGold, whiteSpace: 'nowrap' }}>
        ₹{total} Cr
      </span>
    </div>
  );
}

// The tray: a brass-edged, embossed ledger tray on the felt. It grows its minimum width when a bank
// drop is eligible (a generous landing strip) via a width transition; the flex row yields so it
// extends toward the centre. The one gold glow marks it soft (eligible) / hot (under the pointer).
function trayStyle(eligible: boolean, hot: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: eligible ? EXPANDED_MIN : COLLAPSED_MIN,
    height: 40,
    padding: '4px 10px',
    borderRadius: 8,
    border: `1.5px solid ${INK.gold}`, // brass edge
    background: STAGE.scrimSheet, // a dark inset well (a token) so the gold total stays readable on felt
    boxShadow: hot ? GLOW.hot : eligible ? GLOW.soft : SHADOW.ledgerSlip, // embossed at rest; glows in play
    flexShrink: 0,
    transition: 'min-width 160ms ease-out',
    overflow: 'hidden',
  };
}

const emptyLabelStyle: CSSProperties = {
  fontFamily: FONT.serif,
  fontStyle: 'italic',
  fontSize: 12,
  color: STAGE.textOnFelt,
  opacity: 0.6,
};
