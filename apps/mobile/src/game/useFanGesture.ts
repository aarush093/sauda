/**
 * The hand SCRUB gesture (F1, owner playtest 30 Jul; now drives the G2 wheel). One pointer glides
 * over the whole hand instead of grabbing a single overlapped card:
 *
 *   - pointerdown anywhere on the band captures the pointer on the container and PEEKS the card
 *     under the pointer's x (lifted above its neighbours);
 *   - sliding horizontally re-targets the peek card by card;
 *   - lifting the pointer ~40px above the band turns the peek into a DRAG — from there the shared
 *     drag CONTROLLER (K1) owns the carry: the floating preview springs, magnetises and can be
 *     flung. This hook just reports start / move / end / cancel to it;
 *   - releasing while still inside the band is a TAP → the card rises to INSPECT (G1).
 *
 * The gesture lives on the CONTAINER (not per card) because the resting hand overlaps heavily; the
 * card under the pointer is resolved from the pure layout geometry via the caller's `cardAtX`. This
 * hook decides tap-vs-drag and which card; it does NOT hit-test zones or commit — the controller
 * owns that, so the oracle (`legalActions`) contract is unchanged.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const LIFT_ABOVE_BAND_PX = 40; // rise this far above the fan's top to lift the peek into a drag

interface FanPress {
  cardId: string; // the card currently peeked / being carried
  bandTop: number; // the fan container's top edge in client coords, captured at pointerdown
  dragging: boolean; // has the pointer lifted out of the band into a drag?
}

export function useFanGesture(options: {
  cardAtX: (clientX: number) => string | null; // which interactive fan card sits under this x
  onTap: (cardId: string) => void; // release inside the band → stage the card (A1)
  onDragStart: (cardId: string, x: number, y: number) => void; // peek lifted into a carry
  onDragMove: (x: number, y: number) => void; // finger moved while carrying
  onDragEnd: (x: number, y: number) => void; // finger lifted while carrying → controller resolves it
  onDragCancel: () => void; // pointer cancelled mid-carry
}) {
  const [peekCardId, setPeekCardId] = useState<string | null>(null);
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
        options.onDragStart(state.cardId, event.clientX, event.clientY);
      } else {
        const cardId = options.cardAtX(event.clientX) ?? state.cardId; // scrub → re-target the peek
        state.cardId = cardId;
        setPeekCardId(cardId);
      }
      return;
    }
    options.onDragMove(event.clientX, event.clientY);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>): void {
    const state = press.current;
    press.current = null;
    setPeekCardId(null);
    if (!state) {
      return;
    }
    if (!state.dragging) {
      options.onTap(state.cardId); // released in the band → tap → stage (A1)
      return;
    }
    options.onDragEnd(event.clientX, event.clientY); // the controller decides commit / fling / home
  }

  function onPointerCancel(): void {
    const state = press.current;
    press.current = null;
    setPeekCardId(null);
    if (state?.dragging) {
      options.onDragCancel();
    }
  }

  return { peekCardId, fanHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
