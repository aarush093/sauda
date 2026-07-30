/**
 * The hand-fan SCRUB gesture (F1, owner playtest 30 Jul). One pointer glides over the whole fan
 * instead of grabbing a single overlapped card:
 *
 *   - pointerdown anywhere on the fan captures the pointer on the fan container and PEEKS the
 *     card under the pointer's x (lifted above its neighbours);
 *   - sliding horizontally re-targets the peek card by card;
 *   - lifting the pointer ~40px above the fan band turns the peek into the existing DRAG (from
 *     there it behaves exactly like the old drag — floating preview, drop-zone hit-test, commit);
 *   - releasing while still inside the band is a TAP: it stages the peeked card onto the A1 rail.
 *
 * The gesture lives on the CONTAINER (not per card) because the resting fan overlaps heavily; the
 * card under the pointer is resolved from the pure `fanLayout` geometry via `cardAtX`. DOM touch
 * comes only from the shared drop hit-test and the container rect.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { hotZoneAt } from './dropHitTest';

const LIFT_ABOVE_BAND_PX = 40; // rise this far above the fan's top to lift the peek into a drag

export interface DragState {
  cardId: string;
  x: number;
  y: number;
  hotZoneId: string | null; // the eligible drop zone currently under the pointer, if any
}

interface FanPress {
  cardId: string; // the card currently peeked / being carried
  bandTop: number; // the fan container's top edge in client coords, captured at pointerdown
  dragging: boolean; // has the pointer lifted out of the band into a drag?
}

export function useFanGesture(options: {
  cardAtX: (clientX: number) => string | null; // which interactive fan card sits under this x
  eligibleZones: (cardId: string) => Set<string>; // legal drop-zone ids for a carried card
  onTap: (cardId: string) => void; // release inside the band → stage the card (A1)
  onDrop: (cardId: string, zoneId: string) => void; // release over a legal zone → commit
}) {
  const [peekCardId, setPeekCardId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const press = useRef<FanPress | null>(null);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    const cardId = options.cardAtX(event.clientX);
    if (cardId === null) {
      return; // pressed off any interactive card (e.g. empty felt) — ignore
    }
    press.current = { cardId, bandTop: event.currentTarget.getBoundingClientRect().top, dragging: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPeekCardId(cardId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const state = press.current;
    if (!state) {
      return;
    }
    if (!state.dragging) {
      if (state.bandTop - event.clientY > LIFT_ABOVE_BAND_PX) {
        state.dragging = true; // lifted out of the band → become a drag
        setPeekCardId(null);
      } else {
        const cardId = options.cardAtX(event.clientX) ?? state.cardId; // scrub → re-target the peek
        state.cardId = cardId;
        setPeekCardId(cardId);
        return;
      }
    }
    setDrag({
      cardId: state.cardId,
      x: event.clientX,
      y: event.clientY,
      hotZoneId: hotZoneAt(event.clientX, event.clientY, options.eligibleZones(state.cardId)),
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>): void {
    const state = press.current;
    press.current = null;
    setPeekCardId(null);
    if (!state) {
      return;
    }
    if (!state.dragging) {
      setDrag(null);
      options.onTap(state.cardId); // released in the band → tap → stage (A1)
      return;
    }
    const zoneId = hotZoneAt(event.clientX, event.clientY, options.eligibleZones(state.cardId));
    setDrag(null);
    if (zoneId !== null) {
      options.onDrop(state.cardId, zoneId); // dropped on a legal zone → commit
    }
    // released on nothing → spring home (no state change), which is just clearing the drag.
  }

  function onPointerCancel(): void {
    press.current = null;
    setPeekCardId(null);
    setDrag(null);
  }

  return { peekCardId, drag, fanHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
