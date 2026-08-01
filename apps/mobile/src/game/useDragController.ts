/**
 * The drag CONTROLLER (K1, owner reorder 31 Jul) — the single owner of "carrying a card". Every
 * drag source (the hand wheel, the rearrange token, a received card, the inspect overlay) feeds
 * this one controller, so there is exactly ONE floating preview, one spring, one magnet, one
 * fling rule. It turns the raw finger stream into the dating-app feel while leaving the oracle
 * untouched: a commit only ever fires `onCommit(cardId, zoneId)` for an ELIGIBLE zone the caller
 * derived from `legalActions`.
 *
 * ── How the carry works (the tricky bit, teaching the author) ─────────────────────────────────
 * A tiny state machine lives in a ref (`physics`), advanced by a requestAnimationFrame loop:
 *   • carrying — a critically-damped spring chases the finger; the magnet leans the render a few
 *     px toward the zone the drag is AIMED at (projection) and lights it hot early.
 *   • flinging — on a fast, single-zone flick the card keeps its release momentum and flies to
 *     that zone's centre; on arrival it commits. (Released while already over a zone → commit now.)
 *   • homing   — released over nothing, no fling: the card springs back to where it was grabbed.
 * The machine is fully RETARGETABLE (the anti-Mario law): a new `begin` mid-flight is adopted at
 * once — the same card re-grabbed keeps its position and follows the finger; a different card
 * starts fresh at the finger. Nothing locks input while a preview tweens.
 *
 * Reduced motion (`prefers-reduced-motion`) skips the loop entirely: the preview snaps to the
 * finger and a release commits-or-clears instantly. Same outcomes, no travel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { hotZoneAt } from './dropHitTest';
import { prefersReducedMotion } from '../design/motion';
import {
  DRAG_PHYSICS,
  aimedZone,
  assistOffset,
  estimateVelocity,
  flingTarget,
  springTo,
  type PointerSample,
  type Vec2,
  type ZoneGeometry,
} from './dragPhysics';

// The floating preview the board renders: which card, where (client coords), and the zone to
// light hot right now (under the finger, or the one the drag is aimed at). Same shape the old
// DragState carried, so the board's zone-glow code is unchanged.
export interface DragPreview {
  cardId: string;
  x: number;
  y: number;
  hotZoneId: string | null;
}

// What a drag source hands the controller when a carry begins: the eligible zones for this card
// and where a commit should go. Both come straight from the caller's `legalActions` mapping.
export interface CarrySpec {
  eligibleZones: (cardId: string) => Set<string>;
  onCommit: (cardId: string, zoneId: string) => void;
}

type Mode = 'carrying' | 'flinging' | 'homing';

interface Physics {
  mode: Mode;
  cardId: string;
  spec: CarrySpec;
  pos: Vec2; // the spring's current position (client coords)
  vel: Vec2; // px/ms
  finger: Vec2; // where the pointer is (the carry target)
  origin: Vec2; // where the card was grabbed (the home-spring target)
  samples: PointerSample[]; // recent finger samples, for the release-velocity estimate
  flightZoneId: string | null; // the zone a fling is committing to
  flightTarget: Vec2 | null; // that zone's centre
  flightStartT: number; // for the safety cap
  lastFrameT: number;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0;

// Read the live centre of each eligible drop zone from its [data-drop] rect. Re-read each frame
// (cheap — a handful of zones) so an animated zone, e.g. the bank tray that expands mid-drag (K4),
// magnetises to where it actually is, not where it started.
function readZoneGeometry(ids: Set<string>): ZoneGeometry[] {
  const zones: ZoneGeometry[] = [];
  ids.forEach((id) => {
    const element = document.querySelector(`[data-drop="${id}"]`);
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    zones.push({ id, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 });
  });
  return zones;
}

export function useDragController() {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const physics = useRef<Physics | null>(null);
  const rafId = useRef<number>(0);

  // Advance one frame of whichever animation is running, then reschedule until it finishes.
  const frame = useCallback(() => {
    rafId.current = 0;
    const state = physics.current;
    if (!state) {
      return;
    }
    const time = now();
    const dt = Math.min(48, time - state.lastFrameT); // clamp a long/first frame
    state.lastFrameT = time;

    if (state.mode === 'carrying') {
      const stepped = springTo(state.pos, state.vel, state.finger, dt);
      state.pos = stepped.pos;
      state.vel = stepped.vel;

      const zones = readZoneGeometry(state.spec.eligibleZones(state.cardId));
      const zoneIds = new Set(zones.map((zone) => zone.id));
      // The zone under the FINGER is authoritative for a commit (parity with the old hit-test);
      // the aimed zone only telegraphs (glow + a few px of lean) — it never commits on its own.
      const underFinger = hotZoneAt(state.finger.x, state.finger.y, zoneIds);
      const aim = underFinger ? null : aimedZone(state.pos, estimateVelocity(state.samples), zones);
      const lean = assistOffset(state.pos, aim);
      setPreview({
        cardId: state.cardId,
        x: state.pos.x + lean.x,
        y: state.pos.y + lean.y,
        hotZoneId: underFinger ?? aim?.id ?? null,
      });
      schedule();
      return;
    }

    // flinging / homing: spring toward the zone centre (fling) or the grab point (home).
    const target = state.mode === 'flinging' ? state.flightTarget! : state.origin;
    const stepped = springTo(state.pos, state.vel, target, dt);
    state.pos = stepped.pos;
    state.vel = stepped.vel;
    setPreview({
      cardId: state.cardId,
      x: state.pos.x,
      y: state.pos.y,
      hotZoneId: state.mode === 'flinging' ? state.flightZoneId : null,
    });

    const distance = Math.hypot(state.pos.x - target.x, state.pos.y - target.y);
    const speed = Math.hypot(state.vel.x, state.vel.y);
    const settled = distance < DRAG_PHYSICS.arriveDistancePx && speed < DRAG_PHYSICS.arriveSpeedPxPerMs;
    const timedOut = time - state.flightStartT > DRAG_PHYSICS.flightMaxMs;
    if (settled || timedOut) {
      const committing = state.mode === 'flinging' ? state : null;
      physics.current = null;
      setPreview(null);
      if (committing && committing.flightZoneId) {
        committing.spec.onCommit(committing.cardId, committing.flightZoneId);
      }
      return;
    }
    schedule();
  }, []);

  // Kick the loop if it isn't already running and there is something to animate.
  const schedule = useCallback(() => {
    if (rafId.current === 0 && physics.current && typeof requestAnimationFrame === 'function') {
      rafId.current = requestAnimationFrame(frame);
    }
  }, [frame]);

  // Cancel any running loop when the board unmounts, so no stray frame fires after teardown.
  useEffect(() => () => {
    if (rafId.current !== 0) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
  }, []);

  const begin = useCallback(
    (cardId: string, x: number, y: number, spec: CarrySpec) => {
      // Reduced motion: no spring, no loop — the preview simply is the finger.
      if (prefersReducedMotion()) {
        physics.current = null;
        setPreview({ cardId, x, y, hotZoneId: hotZoneAt(x, y, spec.eligibleZones(cardId)) });
        return;
      }
      const previous = physics.current;
      // Re-grabbing the SAME card mid-flight keeps its position (continuous); a different card
      // starts fresh at the finger. Either way we adopt the new carry at once (retargetable).
      const continuous = previous !== null && previous.cardId === cardId;
      physics.current = {
        mode: 'carrying',
        cardId,
        spec,
        pos: continuous ? previous.pos : { x, y },
        vel: continuous ? previous.vel : { x: 0, y: 0 },
        finger: { x, y },
        origin: { x, y },
        samples: [{ x, y, t: now() }],
        flightZoneId: null,
        flightTarget: null,
        flightStartT: 0,
        lastFrameT: now(),
      };
      schedule();
    },
    [schedule],
  );

  const move = useCallback(
    (x: number, y: number) => {
      const state = physics.current;
      if (prefersReducedMotion()) {
        // Snap the preview to the finger; keep the hot zone honest via the DOM hit-test.
        if (state ?? preview) {
          const cardId = state?.cardId ?? preview!.cardId;
          const spec = state?.spec;
          const eligible = spec ? spec.eligibleZones(cardId) : new Set<string>();
          setPreview({ cardId, x, y, hotZoneId: hotZoneAt(x, y, eligible) });
        }
        return;
      }
      if (!state || state.mode !== 'carrying') {
        return;
      }
      state.finger = { x, y };
      state.samples.push({ x, y, t: now() });
      // Keep only the samples the velocity estimate can use (a touch beyond the window).
      const cutoff = now() - DRAG_PHYSICS.velocityWindowMs * 2;
      while (state.samples.length > 2 && state.samples[0]!.t < cutoff) {
        state.samples.shift();
      }
      schedule();
    },
    [preview, schedule],
  );

  const release = useCallback((x: number, y: number) => {
    const state = physics.current;
    if (!state) {
      // Reduced-motion carry has no physics state; resolve from the standing preview.
      const standing = preview;
      if (standing) {
        setPreview(null);
      }
      return;
    }
    const zones = readZoneGeometry(state.spec.eligibleZones(state.cardId));
    const underFinger = hotZoneAt(x, y, new Set(zones.map((zone) => zone.id)));
    if (underFinger) {
      // Released over a legal zone → commit now (the card is already there; no travel needed).
      physics.current = null;
      setPreview(null);
      state.spec.onCommit(state.cardId, underFinger);
      return;
    }
    const velocity = estimateVelocity(state.samples);
    const fling = flingTarget({ x, y }, velocity, zones);
    if (fling) {
      state.mode = 'flinging';
      state.flightZoneId = fling.id;
      state.flightTarget = { x: fling.cx, y: fling.cy };
      state.vel = { x: velocity.x * DRAG_PHYSICS.flingMomentumKeep, y: velocity.y * DRAG_PHYSICS.flingMomentumKeep };
      state.flightStartT = now();
      state.lastFrameT = now();
      schedule();
      return;
    }
    // Released over nothing, no fling → spring home.
    state.mode = 'homing';
    state.flightStartT = now();
    state.lastFrameT = now();
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, schedule]);

  const cancel = useCallback(() => {
    physics.current = null;
    setPreview(null);
  }, []);

  return { preview, begin, move, release, cancel };
}
