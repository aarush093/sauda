/**
 * The per-element drag gesture (v1.2 A10 · law L3), used now for the placed-wildcard REARRANGE
 * token (B8) — the hand fan uses the container scrub in useFanGesture. It turns pointer events on
 * one element into either a TAP (released within an 8 px slop → stage / open the chooser) or a
 * DRAG (moved past the slop → the token rides the pointer; released over a legal group it commits,
 * released anywhere else it springs home). Reversible until release.
 *
 * Hit-testing is the shared `hotZoneAt` (elementFromPoint against each zone's `data-drop` id), so
 * which zone a release lands on is the DOM's own answer — no hand-maintained geometry table. The
 * floating drag preview must be pointer-events:none so it never hides the zone from elementFromPoint.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { hotZoneAt } from './dropHitTest';
import type { DragState } from './useFanGesture';

export type { DragState };

const SLOP_PX = 8; // a release moved less than this is a tap, not a drag

interface PressState {
  cardId: string;
  startX: number;
  startY: number;
  dragging: boolean;
}

export function useHandDrag(options: {
  eligibleZones: (cardId: string) => Set<string>; // the drop-zone ids this card may land on
  onTap: (cardId: string) => void;
  onDrop: (cardId: string, zoneId: string) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const press = useRef<PressState | null>(null);

  function hotZoneFor(x: number, y: number, cardId: string): string | null {
    return hotZoneAt(x, y, options.eligibleZones(cardId));
  }

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
    }
    setDrag({
      cardId: state.cardId,
      x: event.clientX,
      y: event.clientY,
      hotZoneId: hotZoneFor(event.clientX, event.clientY, state.cardId),
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const state = press.current;
    press.current = null;
    if (!state) {
      return;
    }
    if (!state.dragging) {
      setDrag(null);
      options.onTap(state.cardId); // a tap → stage (A1)
      return;
    }
    const zoneId = hotZoneFor(event.clientX, event.clientY, state.cardId);
    setDrag(null);
    if (zoneId) {
      options.onDrop(state.cardId, zoneId); // dropped on a legal zone → commit
    }
    // released on nothing → spring home (no state change), which is just clearing `drag`.
  }

  function onPointerCancel() {
    press.current = null;
    setDrag(null);
  }

  const cardHandlers = (cardId: string) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => onPointerDown(cardId, event),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  });

  return { drag, cardHandlers };
}
