/**
 * The hand-drag gesture (v1.2 A10 · law L3). It turns pointer events on a hand card into
 * either a TAP (released within an 8 px slop → stage the card, the A1 fallback) or a DRAG
 * (moved past the slop → the card rides the pointer; released over a legal drop zone it
 * commits, released anywhere else it springs home). Reversible until release.
 *
 * Hit-testing is `document.elementFromPoint` against the `data-drop` attribute each zone
 * carries, so which zone a release lands on is the DOM's own answer — no hand-maintained
 * geometry table to drift out of sync. The floating drag preview must be pointer-events:
 * none so it never hides the zone beneath it from elementFromPoint.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const SLOP_PX = 8; // a release moved less than this is a tap, not a drag

export interface DragState {
  cardId: string;
  x: number;
  y: number;
  hotZoneId: string | null; // the eligible drop zone currently under the pointer, if any
}

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

  function hotZoneAt(x: number, y: number, cardId: string): string | null {
    const zone = document.elementFromPoint(x, y)?.closest('[data-drop]');
    const id = zone?.getAttribute('data-drop') ?? null;
    return id && options.eligibleZones(cardId).has(id) ? id : null;
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
      hotZoneId: hotZoneAt(event.clientX, event.clientY, state.cardId),
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
    const zoneId = hotZoneAt(event.clientX, event.clientY, state.cardId);
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
