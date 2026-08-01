/**
 * My hand as a half roulette WHEEL (G2, owner playtest 2 — replaces the old fan). It measures its
 * slot and lays the cards out with the pure `wheelLayout` geometry: every card is a spoke around a
 * hub at the bottom-centre, rotated radially, evenly spaced, ONE size at every count, and the outer
 * readable strip of every card stays inside the frame (proven in wheelLayout.test.ts).
 *
 * Interaction is the SCRUB (reused from the fan): a finger glides over the wheel, the card under the
 * pointer lifts upright and clear of its neighbours, sliding re-targets, lifting ~40px above the
 * band lifts the peek into a drag, and a release in the band taps (→ INSPECT, G1). Once a drag
 * begins the shared drag CONTROLLER (K1) owns the carry; this component just reports the gesture up
 * and fades whichever card is currently in the air.
 *
 * Motion: each card carries ONE transform-only transition (~175ms ease-out) on its OUTER layer
 * (position + spoke angle) so when the hand size changes the remaining cards GLIDE to their new even
 * spacing — the owner's "seamless readjustment". The peek lives on an INNER layer with no
 * transition, so the pickup stays instant.
 */
import type { CSSProperties } from 'react';
import { CardFace } from './CardFace';
import { wheelLayout } from '../game/wheelLayout';
import { useFanGesture } from '../game/useFanGesture';
import { useMeasuredWidth } from '../game/useMeasuredWidth';
import { CARD } from '../design/tokens';

const PEEK_LIFT_PX = 26; // the scrubbed card rises this far, clear of its neighbours
const PEEK_SCALE = 1.15; // P5: grows more so the chosen card reads unmistakably (was 1.08)
const REDISTRIBUTE_MS = 175; // the seamless re-spacing glide when the hand size changes (carve-out)
const WHEEL_FALLBACK_WIDTH = 320; // before the slot is measured (and under jsdom, no layout)

// P5: the parting "gap wave" — the peeked card's immediate neighbours slide slightly AWAY from it
// so the chosen card sits in a clear gap. Decreases with distance; rides the redistribute glide so
// it eases open and closes crisply. Returns the lateral px offset for a card `distance` slots from
// the peek (signed by which side it's on). Containment holds — these are small, and wheelLayout
// keeps every card's readable strip inside the frame regardless.
function partOffsetPx(distanceFromPeek: number): number {
  const steps = Math.abs(distanceFromPeek);
  if (steps === 0) return 0; // the peek itself lifts on the inner layer, it does not part
  const magnitude = steps === 1 ? 11 : steps === 2 ? 4 : 0;
  return Math.sign(distanceFromPeek) * magnitude;
}

export function HandWheel({
  cards,
  interactiveIds,
  carriedCardId,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  cards: string[];
  interactiveIds: Set<string>;
  carriedCardId: string | null; // the card currently in the air (from the controller) — faded here
  onTap: (cardId: string) => void;
  onDragStart: (cardId: string, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onDragCancel: () => void;
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

  const { peekCardId, fanHandlers } = useFanGesture({ cardAtX, onTap, onDragStart, onDragMove, onDragEnd, onDragCancel });

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
          const isDragging = id === carriedCardId;
          // P5 parting: shift this card away from the peek (0 when nothing is peeked).
          const peekIndex = peekCardId ? cards.indexOf(peekCardId) : -1;
          const partX = peekIndex >= 0 ? partOffsetPx(index - peekIndex) : 0;
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
                // OUTER layer: position + spoke angle + P5 part offset, with the redistribution
                // transition. n-change or a new peek moves this → the card glides (the gap wave); a
                // steady peek does not, so the pickup itself stays instant (inner layer).
                transform: `translate(${slot.x + partX}px, ${slot.y}px) rotate(${slot.angleDeg}deg)`,
                transformOrigin: 'bottom center',
                transition: `transform ${REDISTRIBUTE_MS}ms ease-out`,
                zIndex: isPeek ? cards.length + 1 : slot.z,
                opacity: isDragging ? 0.3 : 1,
                pointerEvents: 'none', // the container owns the scrub; cards are purely visual
              }}
            >
              {/* INNER layer: the peek straighten (counter the spoke angle) + lift + grow, INSTANT
                  (no transition) so the pickup doesn't ease. */}
              <div
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  transformOrigin: 'bottom center',
                  transform: isPeek ? `rotate(${-slot.angleDeg}deg) translateY(-${PEEK_LIFT_PX}px) scale(${PEEK_SCALE})` : 'none',
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                  {/* the wheel scales the face inline (not via ScaledCard), so pass the rendered width
                      explicitly — the plate loads its tier (J2) and the badge can hold its floor (J3). */}
                  <CardFace cardId={id} renderedWidth={cardWidth} />
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
