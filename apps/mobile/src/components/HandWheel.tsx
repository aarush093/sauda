/**
 * My hand as a half roulette WHEEL (G2, owner playtest 2 — replaces the old fan). It measures its
 * slot and lays the cards out with the pure `wheelLayout` geometry: every card is a spoke around a
 * hub at the bottom-centre, rotated radially, evenly spaced, ONE size at every count, and the outer
 * readable strip of every card stays inside the frame (proven in wheelLayout.test.ts).
 *
 * Interaction is the SCRUB (reused from the fan): a finger glides over the wheel, the card under the
 * pointer lifts upright and clear of its neighbours, sliding re-targets, lifting ~40px above the
 * band turns the peek into a drag, and a release in the band taps (→ INSPECT, G1). The gesture lives
 * on the container so the heavy overlap never traps a card; the cards themselves are inert.
 *
 * Motion: each card carries ONE transform-only transition (~175ms ease-out) on its OUTER layer
 * (position + spoke angle) so when the hand size changes the remaining cards GLIDE to their new even
 * spacing — the owner's "seamless readjustment", the single M4b motion carve-out. The peek lives on
 * an INNER layer with no transition, so the pickup stays instant (its dedicated ease is M4c).
 */
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { CardFace } from './CardFace';
import { wheelLayout } from '../game/wheelLayout';
import { useFanGesture } from '../game/useFanGesture';
import type { DragState } from '../game/useFanGesture';
import { useMeasuredWidth } from '../game/useMeasuredWidth';
import { CARD } from '../design/tokens';

const PEEK_LIFT_PX = 24; // the scrubbed card rises this far, clear of its neighbours
const PEEK_SCALE = 1.08; // and grows a touch so it reads as the focused card
const REDISTRIBUTE_MS = 175; // the seamless re-spacing glide when the hand size changes (carve-out)
const WHEEL_FALLBACK_WIDTH = 320; // before the slot is measured (and under jsdom, no layout)

export function HandWheel({
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
  drag: DragState | null; // the merged board drag — used only to fade the card being carried
  eligibleZones: (cardId: string) => Set<string>;
  onTap: (cardId: string) => void;
  onDrop: (cardId: string, zoneId: string) => void;
  onDragChange: (drag: DragState | null) => void;
}) {
  const [containerRef, measured] = useMeasuredWidth<HTMLDivElement>();
  const available = measured || WHEEL_FALLBACK_WIDTH;
  const { cardWidth, cardHeight, height, slots } = wheelLayout(cards.length, available);
  const scale = cardWidth / CARD.fullWidth;
  const active = interactiveIds.size > 0; // off-turn / no plays → the wheel is inert

  // The interactive card nearest the pointer's x, resolved from the layout's readable-strip anchors
  // (monotonic left→right). Only interactive cards peek/tap/drag.
  function cardAtX(clientX: number): string | null {
    const element = containerRef.current;
    if (!element) {
      return null;
    }
    const localX = clientX - element.getBoundingClientRect().left;
    let found: string | null = null;
    let bestDistance = Infinity;
    for (let index = 0; index < slots.length; index++) {
      const id = cards[index]!;
      if (!interactiveIds.has(id)) {
        continue;
      }
      const distance = Math.abs(slots[index]!.anchorX - localX);
      if (distance < bestDistance) {
        bestDistance = distance;
        found = id;
      }
    }
    return found;
  }

  const { peekCardId, drag: fanDrag, fanHandlers } = useFanGesture({ cardAtX, eligibleZones, onTap, onDrop });

  // Report the wheel's drag up so the board can render the floating preview + drop-zone glow.
  useEffect(() => {
    onDragChange(fanDrag);
  }, [fanDrag, onDragChange]);

  return (
    <div
      ref={containerRef}
      // The whole band captures the scrub; overflow is visible so a peeked card can rise clear of
      // its neighbours without clipping. wheelLayout keeps every card's readable strip inside.
      {...(active ? fanHandlers : {})}
      onContextMenu={(event) => event.preventDefault()}
      style={{ ...containerStyle(height), touchAction: active ? 'none' : 'auto' }}
    >
      {cards.length === 0 ? null : (
        cards.map((id, index) => {
          const slot = slots[index]!;
          const isPeek = id === peekCardId;
          const isDragging = drag?.cardId === id;
          return (
            <div
              key={id}
              {...(import.meta.env.DEV && { 'data-card-id': id })}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: cardWidth,
                height: cardHeight,
                // OUTER layer: position + spoke angle, with the redistribution transition. n-change
                // moves this → the card glides; a peek does NOT change it → no unwanted ease.
                transform: `translate(${slot.x}px, ${slot.y}px) rotate(${slot.angleDeg}deg)`,
                transformOrigin: 'bottom center',
                transition: `transform ${REDISTRIBUTE_MS}ms ease-out`,
                zIndex: isPeek ? cards.length + 1 : slot.z,
                opacity: isDragging ? 0.3 : 1,
                pointerEvents: 'none', // the container owns the scrub; cards are purely visual
              }}
            >
              {/* INNER layer: the peek straighten (counter the spoke angle) + lift + grow, INSTANT
                  (no transition) so the pickup doesn't ease — its dedicated ~90ms ease is M4c. */}
              <div
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  transformOrigin: 'bottom center',
                  transform: isPeek ? `rotate(${-slot.angleDeg}deg) translateY(-${PEEK_LIFT_PX}px) scale(${PEEK_SCALE})` : 'none',
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                  <CardFace cardId={id} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const containerStyle = (height: number): CSSProperties => ({
  position: 'relative',
  width: '100%',
  height,
  overflow: 'visible',
  userSelect: 'none',
});
