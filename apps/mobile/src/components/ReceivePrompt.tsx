/**
 * The received-wildcard chooser (STATE_MATRIX C7). When a wildcard reaches me as payment,
 * the engine pauses in `awaitingReceive` and offers one RESPOND_PLACE_RECEIVED per legal
 * set (its placeableSets). This compact cream prompt shows the card and its legal groups
 * as buttons; tapping one lands it there. Legality is the engine's — we render exactly the
 * options it gives and dispatch the chosen one back.
 */
import type { CSSProperties } from 'react';
import { SETS } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { CardFace } from './CardFace';
import { STAGE, INK, FONT } from '../design/tokens';

type PlaceReceived = Extract<Action, { type: 'RESPOND_PLACE_RECEIVED' }>;

export function ReceivePrompt({
  cardId,
  options,
  onChoose,
}: {
  cardId: string;
  options: PlaceReceived[];
  onChoose: (action: PlaceReceived) => void;
}) {
  return (
    <div style={overlayStyle}>
      <div style={promptStyle}>
        <div style={titleStyle}>Keep this where?</div>
        <CardFace cardId={cardId} size="mid" />
        <div style={buttonColumnStyle}>
          {options.map((option) => (
            <button key={option.set} style={optionButton} onClick={() => onChoose(option)}>
              {SETS[option.set].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10,
  background: STAGE.scrimSheet,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const promptStyle: CSSProperties = {
  minWidth: 240,
  maxWidth: '84vw',
  background: STAGE.cardCream,
  color: INK.deepInk,
  borderRadius: 14,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  boxShadow: STAGE.glowGold,
};
const titleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 16, textAlign: 'center' };
const buttonColumnStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' };
const optionButton: CSSProperties = {
  minWidth: 120,
  padding: '10px 16px',
  borderRadius: 999,
  background: 'transparent',
  color: INK.deepInk,
  border: `1.5px solid ${INK.gold}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};
