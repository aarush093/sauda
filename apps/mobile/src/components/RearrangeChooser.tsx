/**
 * Rearrange a placed wildcard — the TAP fallback for matrix B8 (the drag is a token on the
 * board). A placed wildcard may move between the groups `legalActions` allows, free and with
 * no play spent. This compact overlay shows the wildcard and its legal destination groups as
 * glowing chips; one tap fires the exact REARRANGE_WILDCARD the engine enumerated.
 */
import type { CSSProperties } from 'react';
import type { Action, CardId } from '@sauda/engine';
import type { RearrangeTarget } from '../game/interaction';
import { ScaledCard } from './CardFace';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

export function RearrangeChooser({
  cardId,
  destinations,
  onChoose,
  onCancel,
}: {
  cardId: CardId;
  destinations: RearrangeTarget[];
  onChoose: (action: Action) => void;
  onCancel: () => void;
}) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
        <ScaledCard cardId={cardId} width={88} />
        <div style={promptStyle}>Move to which set?</div>
        <div style={chipRowStyle}>
          {destinations.map((destination) => (
            <button key={destination.set} style={chipStyle} onClick={() => onChoose(destination.action)}>
              {destination.label.replace('Move to ', '')}
            </button>
          ))}
        </div>
        <button style={cancelStyle} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: LAYERS.surface, background: STAGE.scrimSheet, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const panelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: '88vw' };
const promptStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 15, color: STAGE.cardCream };
const chipRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' };
const chipStyle: CSSProperties = {
  padding: '9px 15px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.accentGold,
  border: `1.5px solid ${INK.gold}`,
  boxShadow: STAGE.glowGold,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
const cancelStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.textOnFelt,
  border: `1px solid ${INK.agedLine}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};
