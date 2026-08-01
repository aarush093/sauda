/**
 * The interrupt prompt — NAHI CHALEGA (INTERACTION_SPEC §7; STATE_MATRIX D1/D4). When an
 * action lands that I could cancel, a compact centre prompt names the threat and offers
 * "Nahi chalega!" (only when I hold the counter) and "Allow", over a light scrim with the
 * table still visible so the stakes stay visible. A slim gold timer bar drains over ten
 * seconds; on timeout the window auto-allows (D4). Legality is the engine's — the parent
 * passes `canNahi` straight from legalActions.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { InterruptView } from '@sauda/engine';
import { describeThreat } from '../game/labels';
import { Surface } from './Surface';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

const TIMEOUT_MS = 10000; // D4: the window auto-allows after ten seconds

export function InterruptPrompt({
  interrupt,
  canNahi,
  onNahi,
  onAllow,
}: {
  interrupt: InterruptView;
  canNahi: boolean;
  onNahi: () => void;
  onAllow: () => void;
}) {
  // Auto-allow on timeout (D4). A ref holds the latest callback so the ten-second timer
  // starts once when the prompt opens and is not restarted by parent re-renders; the
  // timer's life matches this prompt (cleared when I answer and it unmounts).
  const onAllowRef = useRef(onAllow);
  onAllowRef.current = onAllow;
  const [draining, setDraining] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDraining(true)); // start the bar next paint
    const timer = setTimeout(() => onAllowRef.current(), TIMEOUT_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div style={overlayStyle}>
      {/* K2: the interrupt prompt EASES in (never pops) — the owner's law for the NAHI window. */}
      <Surface style={promptStyle}>
        <div style={threatStyle}>{describeThreat(interrupt)}</div>
        <div style={buttonRowStyle}>
          {canNahi && (
            <button style={nahiButton} onClick={onNahi}>
              Nahi chalega!
            </button>
          )}
          <button style={allowButton} onClick={onAllow}>
            Allow
          </button>
        </div>
        <div style={timerTrackStyle}>
          <div style={{ height: '100%', background: STAGE.accentGold, width: draining ? '0%' : '100%', transition: `width ${TIMEOUT_MS}ms linear` }} />
        </div>
      </Surface>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.sheet,
  background: STAGE.scrimDrag, // light — the table stays visible (§7)
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const promptStyle: CSSProperties = {
  minWidth: 260,
  maxWidth: '84vw',
  background: STAGE.cardCream,
  color: INK.deepInk,
  borderRadius: 14,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  boxShadow: STAGE.glowGold,
};
const threatStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 16, textAlign: 'center' };
const buttonRowStyle: CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center' };
const nahiButton: CSSProperties = {
  minWidth: 120,
  padding: '10px 16px',
  borderRadius: 999,
  background: 'transparent',
  color: INK.deepInk,
  border: `2px solid ${INK.gold}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};
const allowButton: CSSProperties = {
  minWidth: 96,
  padding: '10px 16px',
  borderRadius: 999,
  background: 'transparent',
  color: INK.mutedBrown,
  border: `1px solid ${INK.agedLine}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};
const timerTrackStyle: CSSProperties = {
  height: 4,
  width: '100%',
  borderRadius: 2,
  background: STAGE.scrimSheet,
  overflow: 'hidden',
};
