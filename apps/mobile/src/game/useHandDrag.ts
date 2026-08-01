/**
 * The per-element drag gesture (v1.2 A10 · law L3), used for the placed-wildcard REARRANGE token
 * (B8), a received card awaiting a set (G6), and the inspect overlay's enlarged card (G1). The
 * hand fan uses the container scrub in useFanGesture; this drives single, non-overlapping elements.
 *
 * It turns pointer events on one element into either a TAP (released within an 8px slop) or a DRAG
 * (moved past the slop). Once it is a drag, the shared drag CONTROLLER (K1) owns the carry — the
 * floating preview springs, magnetises and can be flung. This hook only reports start / move / end
 * / cancel and decides tap-vs-drag; it does NOT hit-test zones or commit, so the oracle contract
 * (`legalActions` the only source of legal zones) is unchanged. Reversible until release.
 */
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const SLOP_PX = 8; // a release moved less than this is a tap, not a drag

interface PressState {
  cardId: string;
  startX: number;
  startY: number;
  dragging: boolean;
}

export function useHandDrag(options: {
  onTap: (cardId: string) => void;
  onDragStart: (cardId: string, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onDragCancel: () => void;
}) {
  const press = useRef<PressState | null>(null);

  function onPointerDown(cardId: string, event: ReactPointerEvent<HTMLElement>) {
    press.current = { cardId, startX: event.clientX, startY: event.clientY, dragging: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = press.current;
    if (!state) {
      return;
    }
    if (!state.dragging) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < SLOP_PX) {
        return; // still within the tap slop
      }
      state.dragging = true;
      options.onDragStart(state.cardId, event.clientX, event.clientY);
    }
    options.onDragMove(event.clientX, event.clientY);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const state = press.current;
    press.current = null;
    if (!state) {
      return;
    }
    if (!state.dragging) {
      options.onTap(state.cardId); // a tap → stage / inspect / open the chooser (A1)
      return;
    }
    options.onDragEnd(event.clientX, event.clientY); // the controller decides commit / fling / home
  }

  function onPointerCancel() {
    const state = press.current;
    press.current = null;
    if (state?.dragging) {
      options.onDragCancel();
    }
  }

  const cardHandlers = (cardId: string) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => onPointerDown(cardId, event),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  });

  return { cardHandlers };
}
