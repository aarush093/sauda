/**
 * The BANK VIEW (R3 — owner landscape directive, 2 Aug). Tapping my bank tray opens this: every
 * banked card as a real face in a landscape grid, the total in gold. The bank is PUBLIC by the rules
 * of this genre (money notes AND banked action cards alike are face-up), so it reads whatever cards
 * the Observation carries — mine here, and an opponent's bank shows the same way inside their board
 * zoom (TableView). It decides nothing and dispatches nothing; tap off / ✕ to close.
 */
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { CardId } from '@sauda/engine';
import { ScaledCard } from './CardFace';
import { Surface } from './Surface';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

const BANK_CARD_PX = 84; // a banked card's face in the grid — fully readable (note value or action)

export function BankView({ title, cards, total, onClose }: { title: string; cards: CardId[]; total: number; onClose: () => void }) {
  // Esc closes — a keyboard is present on the web build; touch uses the backdrop + ✕.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <button type="button" onClick={onClose} style={closeXStyle} aria-label="Close">✕</button>
      <Surface style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>{title} — bank</span>
          <span style={totalStyle}>₹{total} Cr</span>
        </div>
        <div style={gridStyle} onClick={(event) => event.stopPropagation()}>
          {cards.length === 0 ? (
            <div style={emptyStyle}>The bank is empty.</div>
          ) : (
            cards.map((cardId, index) => (
              <ScaledCard key={`${cardId}-${index}`} cardId={cardId} width={BANK_CARD_PX} />
            ))
          )}
        </div>
        <div style={hintStyle}>Tap anywhere off a card — or ✕ — to close</div>
      </Surface>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: LAYERS.surface,
  background: STAGE.scrimSheet,
  backdropFilter: 'blur(3px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  padding: 14,
  overflow: 'hidden',
};
const panelStyle: CSSProperties = { flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 };
const closeXStyle: CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  zIndex: LAYERS.badge,
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: `1.5px solid ${INK.gold}`,
  background: 'transparent',
  color: STAGE.accentGold,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 15,
  lineHeight: 1,
  cursor: 'pointer',
};
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 };
const titleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 18, color: STAGE.cardCream };
const totalStyle: CSSProperties = { fontFamily: FONT.mono, fontWeight: 700, fontSize: 16, color: STAGE.accentGold };
const gridStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  alignSelf: 'stretch',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  justifyContent: 'center',
  alignContent: 'flex-start',
  overflowY: 'auto', // a big bank scrolls internally rather than clipping (modal internal scroll)
};
const emptyStyle: CSSProperties = { fontFamily: FONT.serif, fontStyle: 'italic', color: STAGE.textOnFelt, opacity: 0.8 };
const hintStyle: CSSProperties = { fontFamily: FONT.serif, fontSize: 11, color: STAGE.textOnFelt, opacity: 0.7 };
