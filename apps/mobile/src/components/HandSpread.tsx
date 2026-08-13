/**
 * My hand as a flat SPREAD (S1, owner playtest 13 Aug — retires the roulette wheel). It measures its
 * slot and lays the cards out with the pure `spreadLayout` geometry: a flat row of UPRIGHT cards
 * (rotation 0 always), bottom-anchored, evenly overlapping, ONE size at every count, with every card's
 * exposed strip (banner + value badge) kept readable (proven in spreadLayout.test.ts).
 *
 * Interaction is the SCRUB (reused from the fan/wheel): a finger glides over the row, the card under
 * the pointer PRESSES — sliding STRAIGHT UP ~40% of its height and growing ~1.12×, so the whole card
 * clears its neighbours; sliding re-targets card by card; lifting ~40 px above the band lifts the peek
 * into a DRAG (shared controller, K1); a release in the band taps (→ INSPECT, G1). No rotation maths
 * anywhere — the cards are already upright.
 *
 * Motion: each card carries ONE transform-only transition (~175 ms ease-out) on its OUTER layer
 * (position) so when the hand size changes the remaining cards GLIDE to their new even spacing — the
 * owner's "seamless readjustment", carried over unchanged from the wheel. The press lives on an INNER
 * layer with no transition, so the pickup stays instant.
 */
import type { CSSProperties } from 'react';
import { CardFace } from './CardFace';
import { spreadLayout, spreadCardWidth } from '../game/spreadLayout';
import { useFanGesture } from '../game/useFanGesture';
import { useMeasuredWidth } from '../game/useMeasuredWidth';
import { CARD } from '../design/tokens';

const PRESS_LIFT_FRACTION = 0.4; // the pressed card slides straight up this fraction of its height
const PRESS_SCALE = 1.12; // …and grows this much, so it reads unmistakably above its neighbours
const REDISTRIBUTE_MS = 175; // the seamless re-spacing glide when the hand size changes (carry-over)
const SPREAD_FALLBACK_WIDTH = 320; // before the slot is measured (and under jsdom, no layout)

// The parting "gap wave": the pressed card's immediate neighbours slide slightly AWAY so it sits in a
// clear gap. Decreases with distance; rides the redistribute glide so it eases open and closes
// crisply. Containment holds — these are small, and the row is centred with margin to spare.
function partOffsetPx(distanceFromPress: number): number {
  const steps = Math.abs(distanceFromPress);
  if (steps === 0) return 0; // the pressed card itself lifts on the inner layer, it does not part
  const magnitude = steps === 1 ? 11 : steps === 2 ? 4 : 0;
  return Math.sign(distanceFromPress) * magnitude;
}

export function HandSpread({
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
  const available = measured || SPREAD_FALLBACK_WIDTH;
  const cardWidth = spreadCardWidth(available);
  const { cardHeight, height, slots } = spreadLayout(cards.length, available, cardWidth);
  const scale = cardWidth / CARD.fullWidth;
  const pressLift = Math.round(cardHeight * PRESS_LIFT_FRACTION);
  const active = interactiveIds.size > 0; // off-turn / no plays → the spread is inert

  // The interactive card nearest the pointer's x, resolved from the layout's exposed-strip anchors
  // (monotonic left→right). Only interactive cards press/tap/drag.
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
      // The whole band captures the scrub; overflow is visible so a pressed card can rise clear of its
      // neighbours (and above the band) without clipping. spreadLayout keeps every resting card inside.
      {...(active ? fanHandlers : {})}
      onContextMenu={(event) => event.preventDefault()}
      style={{ ...containerStyle(height), touchAction: active ? 'none' : 'auto' }}
    >
      {cards.length === 0 ? null : (
        cards.map((id, index) => {
          const slot = slots[index]!;
          const isPeek = id === peekCardId;
          const isDragging = id === carriedCardId;
          // Parting: shift this card away from the pressed one (0 when nothing is pressed).
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
                // OUTER layer: horizontal position + the parting offset, with the redistribution
                // transition. An n-change or a new press moves this → the card glides; a steady press
                // does not, so the pickup itself stays instant (inner layer).
                transform: `translateX(${slot.x + partX}px)`,
                transition: `transform ${REDISTRIBUTE_MS}ms ease-out`,
                zIndex: isPeek ? cards.length + 1 : slot.z,
                opacity: isDragging ? 0.3 : 1,
                pointerEvents: 'none', // the container owns the scrub; cards are purely visual
              }}
            >
              {/* INNER layer: the press slides the upright card STRAIGHT UP + grows it, INSTANT (no
                  transition) so the pickup doesn't ease. No rotation — the card is already upright. */}
              <div
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  transformOrigin: 'bottom center',
                  transform: isPeek ? `translateY(-${pressLift}px) scale(${PRESS_SCALE})` : 'none',
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                  {/* the spread scales the face inline (not via ScaledCard), so pass the rendered width
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
