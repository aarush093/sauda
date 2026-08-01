/**
 * The hand-card INSPECT overlay (G1, owner playtest 2). Supersedes the A1 tap→stage→rail for HAND
 * cards — the owner, playing live, read the rail as the game "asking permission" ("again it's asking
 * whether to bank or not"). Now a TAP just lets you READ the card: it rises here CENTRED and LARGE
 * (~56% of the frame width), fully readable, over a light stage scrim with the table still visible.
 *
 * There are NO buttons — inspect never dispatches an engine action. Two ways out:
 *   • TAP anywhere (off the card, or the card itself) dismisses.
 *   • DRAG the enlarged card past the 8px slop to commit it — the SAME drag system as the wheel
 *     (eligible zones glow, the zone under the pointer commits on release, a dead-space release
 *     springs home). Drag is the only commit path from hand (L3).
 *
 * If the card's canonical play (Build / Play / Charge) is currently illegal, one greyed why-line
 * teaches the rule instead of stonewalling (F7 copy). While a drag is in flight the scrim goes
 * pointer-events:none so the board's drop zones under the pointer stay hit-testable; the card keeps
 * pointer capture so it still tracks the finger.
 */
import type { CSSProperties } from 'react';
import type { Action } from '@sauda/engine';
import { ScaledCard } from './CardFace';
import { railForCard } from '../game/staging';
import { cardVerbHint } from '../game/labels';
import { useHandDrag } from '../game/useHandDrag';
import { Surface } from './Surface';
import { STAGE, INK, FONT } from '../design/tokens';

const INSPECT_CARD_PX = 200; // ~56% of the 360 frame — large and fully readable (G1)

export function InspectCard({
  cardId,
  actions,
  dragging,
  onDismiss,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  cardId: string;
  actions: Action[];
  dragging: boolean; // is this card being carried right now (from the controller) — fade + let the board's zones through
  onDismiss: () => void;
  onDragStart: (cardId: string, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onDragCancel: () => void;
}) {
  // Why-line: if the card's canonical verb isn't among its legal verbs, show the single greyed
  // reason. railForCard groups the card's legal verbs; inspect only READS it to spot the missing
  // verb — it renders no rail (the rail as a UI is retired for hand cards).
  const verbs = railForCard(actions, cardId);
  const verbHint = cardVerbHint(cardId);
  const why = verbHint && !verbs.some((verb) => verb.key === verbHint.verbKey) ? verbHint.reason : null;

  // Drag the enlarged card straight to a zone (a plain tap dismisses). Same hook the rearrange
  // token uses, so the commit path is byte-identical to a wheel drag — the controller owns the carry.
  const { cardHandlers } = useHandDrag({ onTap: onDismiss, onDragStart, onDragMove, onDragEnd, onDragCancel });

  return (
    <div onClick={onDismiss} style={{ ...overlayStyle, pointerEvents: dragging ? 'none' : 'auto' }}>
      {/* the card + optional why-line eases up from centre (K2); a tap here is the card's own
          gesture, not a scrim tap. The Surface freezes to instant under reduced motion. */}
      <Surface origin="center" onClick={(event) => event.stopPropagation()} style={columnStyle}>
        <div
          {...cardHandlers(cardId)}
          {...(import.meta.env.DEV && { 'data-card-id': cardId })}
          onContextMenu={(event) => event.preventDefault()}
          // explicit pointer-events:auto so the card keeps capture even while the scrim above is
          // pointer-events:none mid-drag (the capturing element must stay interactive).
          style={{ pointerEvents: 'auto', touchAction: 'none', cursor: 'grab', opacity: dragging ? 0.3 : 1 }}
        >
          <ScaledCard cardId={cardId} width={INSPECT_CARD_PX} />
        </div>
        {why && <div style={whyStyle}>{why}</div>}
      </Surface>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  background: STAGE.scrimDrag, // the light stage scrim — the table stays visible behind it (A5)
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
};
const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
};
// The one greyed why-line: a rule, not a wall (F7). Muted, non-interactive.
const whyStyle: CSSProperties = {
  fontFamily: FONT.serif,
  fontSize: 13,
  fontStyle: 'italic',
  color: INK.cardCream,
  opacity: 0.75,
  background: STAGE.scrimSheet,
  padding: '6px 14px',
  borderRadius: 999,
};
