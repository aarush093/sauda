/**
 * The over-the-limit DISCARD overlay (G3, owner playtest 2 · STATE_MATRIX A8/A9). At end-turn with
 * hand > 7 the wheel vanishes and the table dims + blurs behind a static scrim; ALL hand cards
 * spread as REAL full CardFaces at readable size (a wrapping grid — two rows if needed) under the
 * heading "Over the limit — tap N to discard". Tapping a card buries it face-down UNDER the draw
 * pile (house rule 813f1cd — the engine routes it there and emits the ticker line); when the hand
 * reaches 7 the overlay dismisses itself and the wheel returns.
 *
 * A full L2 surface: it covers the board, so nothing else is interactive while it is open.
 */
import type { CSSProperties } from 'react';
import { ScaledCard } from './CardFace';
import { Surface } from './Surface';
import { GLOW, STAGE, INK, FONT } from '../design/tokens';

const HAND_LIMIT = 7; // §4.4 / Niyam Card 3
const DISCARD_CARD_PX = 82; // readable, and small enough that up to ~11 cards fit in two rows at 360

export function DiscardOverlay({ cards, onDiscard }: { cards: string[]; onDiscard: (cardId: string) => void }) {
  const over = cards.length - HAND_LIMIT; // the count-down: how many still to bury
  return (
    <div style={overlayStyle}>
      {/* K2: the discard spread eases in (was a hard cut) — the dim/blur backdrop stays static. */}
      <Surface style={panelStyle}>
        <div style={headingStyle}>Over the limit — tap {over} to discard</div>
        <div style={gridStyle}>
          {cards.map((id) => (
            <div
              key={id}
              onClick={() => onDiscard(id)}
              {...(import.meta.env.DEV && { 'data-card-id': id })}
              style={cardStyle}
            >
              <ScaledCard cardId={id} width={DISCARD_CARD_PX} />
            </div>
          ))}
        </div>
        <div style={subStyle}>Buried cards slide face-down under the draw pile — out of reach for a long time.</div>
      </Surface>
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  maxWidth: '100%',
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 6, // above the board turn-flow, below the response sheets (payment/prompt at z10)
  background: STAGE.scrimSheet, // the static dim
  backdropFilter: 'blur(3px)', // the static blur — no animation (M4c owns motion)
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  padding: 16,
};
const headingStyle: CSSProperties = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 18,
  color: STAGE.accentGold,
  textAlign: 'center',
};
const gridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  justifyContent: 'center',
  alignContent: 'center',
  maxWidth: '92%',
};
// each card reads as a discard target — the one gold glow (GLOW.soft) marks it tappable.
const cardStyle: CSSProperties = {
  borderRadius: 8,
  cursor: 'pointer',
  boxShadow: GLOW.soft,
};
const subStyle: CSSProperties = {
  fontFamily: FONT.serif,
  fontStyle: 'italic',
  fontSize: 12,
  color: INK.cardCream,
  opacity: 0.8,
  textAlign: 'center',
  maxWidth: '80%',
};
