/**
 * My hand as a shallow overlapping arc of real CardFace cards (A10 · §4 · F1). It measures its
 * slot and lays the cards out with the pure `fanLayout` geometry, which guarantees NOTHING CLIPS
 * (rotated cards stay inside the frame, rotation is capped shallow, and cards shrink for a dense
 * hand rather than spilling past the edge).
 *
 * Interaction is the SCRUB pickup (F1, owner playtest 30 Jul): a finger glides over the fan, the
 * card under it peeks up clear of its neighbours, sliding re-targets, lifting turns the peek into
 * a drag, and a release in the band taps (stages) the card. The gesture lives on the container
 * (see useFanGesture) so the heavy overlap never traps a card; the cards themselves are inert
 * (pointer-events:none) and purely visual. The card being dragged fades because the floating
 * preview shows it instead.
 */
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { CardFace } from './CardFace';
import { fanLayout } from '../game/fanLayout';
import { useFanGesture } from '../game/useFanGesture';
import type { DragState } from '../game/useFanGesture';
import { useMeasuredWidth } from '../game/useMeasuredWidth';
import { CARD, STAGE } from '../design/tokens';

const PEEK_LIFT_PX = 20; // the scrubbed card rises this far, clear of its neighbours
const PEEK_SCALE = 1.06; // and grows a touch so it reads as the focused card
const FAN_FALLBACK_WIDTH = 240; // before the slot is measured (and under jsdom, no layout)

export function HandFan({
  cards,
  interactiveIds,
  drag,
  eligibleZones,
  onTap,
  onDrop,
  onDragChange,
}: {
  cards: string[];
  interactiveIds: Set<string>;
  drag: DragState | null; // the merged board drag (fan or rearrange) — used only to fade the card
  eligibleZones: (cardId: string) => Set<string>;
  onTap: (cardId: string) => void;
  onDrop: (cardId: string, zoneId: string) => void;
  onDragChange: (drag: DragState | null) => void;
}) {
  const [containerRef, measured] = useMeasuredWidth<HTMLDivElement>();
  const available = measured || FAN_FALLBACK_WIDTH;
  const { cardWidth, slots } = fanLayout(cards.length, available);
  const scale = cardWidth / CARD.fullWidth;
  const cardHeight = Math.round(cardWidth * CARD.ratio);
  const active = interactiveIds.size > 0; // off-turn / no plays → the fan is inert

  // The interactive card under a client x, resolved from the layout: the top-most (highest-index)
  // card whose left edge is at or before the pointer. Only interactive cards peek/tap/drag.
  function cardAtX(clientX: number): string | null {
    const element = containerRef.current;
    if (!element) {
      return null;
    }
    const localX = clientX - element.getBoundingClientRect().left;
    let found = cards.length > 0 ? cards[0]! : null;
    for (let index = 0; index < slots.length; index++) {
      if (slots[index]!.x <= localX) {
        found = cards[index]!;
      }
    }
    return found !== null && interactiveIds.has(found) ? found : null;
  }

  const { peekCardId, drag: fanDrag, fanHandlers } = useFanGesture({ cardAtX, eligibleZones, onTap, onDrop });

  // Report the fan's drag up so the board can render the floating preview + drop-zone glow.
  useEffect(() => {
    onDragChange(fanDrag);
  }, [fanDrag, onDragChange]);

  const maxDip = Math.round(((cards.length - 1) / 2) * 1.2);
  const bandHeight = cardHeight + maxDip;

  return (
    <div
      ref={containerRef}
      // The whole fan band captures the scrub; overflow is visible so a peeked card can rise clear
      // of its neighbours without being clipped. fanLayout keeps every card inside horizontally.
      {...(active ? fanHandlers : {})}
      onContextMenu={(event) => event.preventDefault()}
      style={{ ...containerStyle(bandHeight), touchAction: active ? 'none' : 'auto' }}
    >
      {cards.length === 0 ? (
        <span style={{ color: STAGE.textOnFelt, opacity: 0.6 }}>—</span>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: bandHeight }}>
          {cards.map((id, index) => {
            const slot = slots[index]!;
            const isPeek = id === peekCardId;
            const isDragging = drag?.cardId === id;
            // The peeked card straightens, lifts, grows, and jumps to the top of the stack.
            const transform = isPeek
              ? `translateY(-${PEEK_LIFT_PX}px) scale(${PEEK_SCALE})`
              : `rotate(${slot.rotationDeg}deg)`;
            return (
              <div
                key={id}
                // Dev-only DOM marker so the Playwright capture pipeline can locate a card by id.
                {...(import.meta.env.DEV && { 'data-card-id': id })}
                style={{
                  position: 'absolute',
                  left: slot.x,
                  top: slot.y,
                  width: cardWidth,
                  height: cardHeight,
                  transform,
                  transformOrigin: 'bottom center',
                  zIndex: isPeek ? cards.length + 1 : slot.z,
                  opacity: isDragging ? 0.3 : 1,
                  pointerEvents: 'none', // the container owns the scrub; cards are purely visual
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                  <CardFace cardId={id} size="full" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const containerStyle = (bandHeight: number): CSSProperties => ({
  height: bandHeight + 10,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  overflow: 'visible',
  userSelect: 'none',
});
