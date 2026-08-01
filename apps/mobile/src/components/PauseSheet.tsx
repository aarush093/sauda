/**
 * The in-game PAUSE sheet (P8 / K8 nav). Reached from the top-left home glyph on the play screen.
 * While it is open the game is PAUSED — the caller freezes the bot timer, auto-draw, auto-resolve
 * and the turn token's auto-end drain — so nothing advances behind it (an L2 surface).
 *
 * Three choices: Resume · Niyam (the Book, opened OVER the paused game) · Home. Home is guarded by an
 * inline "Game abandoned — sure?" confirm so a mis-tap never throws a game away.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Surface } from './Surface';
import { useReducedMotion } from '../design/motion';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

export function PauseSheet({
  onResume,
  onNiyam,
  onHome,
}: {
  onResume: () => void;
  onNiyam: () => void;
  onHome: () => void;
}) {
  const [confirmingHome, setConfirmingHome] = useState(false);
  const reduced = useReducedMotion();
  return (
    <div style={backdropStyle} onClick={onResume}>
      <Surface origin="center" onClick={(event) => event.stopPropagation()} style={sheetStyle}>
        <div style={titleStyle}>Paused</div>
        {!confirmingHome ? (
          <>
            <button style={primaryButton} onClick={onResume}>Resume</button>
            <button style={secondaryButton} onClick={onNiyam}>Niyam (rules)</button>
            <button style={secondaryButton} onClick={() => setConfirmingHome(true)}>Home</button>
          </>
        ) : (
          <>
            <div style={confirmText}>Game abandoned — sure?</div>
            <button style={dangerButton} onClick={onHome}>Yes, abandon</button>
            <button style={secondaryButton} onClick={() => setConfirmingHome(false)}>Keep playing</button>
          </>
        )}
        {/* PHONE-2 Q3: a quiet, permanent disclosure — not a nag or a toast, just discoverable truth.
            When the device or browser has forced reduced motion, the player can otherwise never tell
            the animation layer was switched off (the owner's first phone session, on battery saver). */}
        {reduced && <div style={reducedNoteStyle}>Reduced motion is on — your device or browser requested it.</div>}
      </Surface>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.surface,
  background: STAGE.scrimSheet,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};
const sheetStyle: CSSProperties = {
  width: '100%',
  maxWidth: 300,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 20,
  borderRadius: 14,
  border: `1.5px solid ${INK.agedLine}`,
  background: INK.ledgerSlip,
  color: INK.deepInk,
};
const titleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 20, color: INK.deepInk, textAlign: 'center' };
const confirmText: CSSProperties = { fontFamily: FONT.serif, fontSize: 15, color: INK.deepInk, textAlign: 'center', padding: '4px 0' };
// A quiet footer line — smaller, muted, centred. Present only when reduced motion is active.
const reducedNoteStyle: CSSProperties = { fontFamily: FONT.serif, fontSize: 12, color: INK.mutedBrown, textAlign: 'center', padding: '2px 0' };

const baseButton: CSSProperties = {
  width: '100%',
  minHeight: 52,
  borderRadius: 10,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};
const primaryButton: CSSProperties = { ...baseButton, border: `2px solid ${INK.gold}`, background: STAGE.accentGold, color: INK.deepInk };
const secondaryButton: CSSProperties = { ...baseButton, border: `1.5px solid ${INK.agedLine}`, background: 'transparent', color: INK.deepInk };
const dangerButton: CSSProperties = { ...baseButton, border: `2px solid ${INK.stampRed}`, background: 'transparent', color: INK.stampRed };
