/**
 * Drag physics (K1, owner reorder 31 Jul) — the "dating-app feel": choose a card in one
 * motion, place it in a second. This module is the PURE, DOM-free heart of that feel and the
 * ONE place the owner tunes it. It layers ON TOP of the existing contract (tap = inspect,
 * drag = commit, `legalActions` the only oracle): every function here only ever sees the
 * ELIGIBLE zones the caller already derived from `legalActions`, so an illegal zone can never
 * attract, never accept, and never win a fling — the oracle is untouched.
 *
 * Four small ideas, each unit-tested:
 *   1. estimateVelocity — how fast/where the finger is going, from the tail of the samples.
 *   2. springTo         — a critically-damped follow so the card feels attached but alive.
 *   3. aimedZone / assistOffset — magnetic assist: telegraph + a few px of help toward the aim.
 *   4. flingTarget      — a fast flick at exactly one zone commits without landing on it.
 *
 * The React glue (rAF loop, DOM zone geometry, the carry state machine) lives in
 * useDragController.ts; keeping the maths here means the feel is provable without a browser.
 */

// A 2-D vector in client (screen) pixels. Velocities are px per MILLISECOND throughout this
// module, to match the pointer-event timestamps we sample — never px/second, so no unit drift.
export interface Vec2 {
  x: number;
  y: number;
}

// One timestamped pointer position. `t` is a monotonic clock in ms (performance.now()).
export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

// A drop zone's live centre in client coords, read from its [data-drop] rect by the controller.
export interface ZoneGeometry {
  id: string;
  cx: number;
  cy: number;
}

/**
 * The single tunables block. Every feel constant lives here and nowhere else, so owner tuning
 * is a one-file edit. Units are stated on every line; keep them (px, ms, px/ms, 1/ms, degrees).
 */
export const DRAG_PHYSICS = {
  // ── Follow spring — the card stays glued to the finger, but with life ──────────────────────
  // Natural frequency ω of a critically-damped spring, in 1/ms. The steady-state lag while
  // dragging is ≈ 2·speed/ω, so ω = 0.1 keeps the card within ~20px of the finger at a brisk
  // 1 px/ms (1000 px/s) drag, and closer when slower. Critically damped ⇒ it never overshoots
  // the finger, so it reads as "attached", not "wobbly".
  followFrequency: 0.1, // 1/ms
  subStepMs: 8, // integrate the spring in ≤8ms slices, so a throttled 32ms frame can't blow it up

  // ── Magnetic assist — telegraph the aim, help a few px, never yank ─────────────────────────
  projectionMs: 120, // project the card this far ahead along its velocity to find what it's aimed at
  attractionRadiusPx: 90, // a zone "catches" the aim once the projection lands within this of its centre
  assistFraction: 0.18, // lean this fraction of the remaining gap toward the aimed zone's centre…
  assistMaxPx: 10, // …but never more than this — subtle assist, so a slow deliberate drag feels untouched

  // ── Fling-to-commit — flick at one zone and let go early ──────────────────────────────────
  flingSpeedPxPerMs: 0.6, // a release slower than this (600 px/s) never flings — a conservative floor
  flingConeDeg: 30, // the half-angle of the aim cone; the fling only commits if ONE zone sits inside it
  flingMomentumKeep: 1, // fraction of the release velocity carried into the flight (1 = keep all of it)

  // ── Near-miss forgiveness (P3, owner phone test 1 Aug) — the fix for the MAKAAN rage ─────────
  // A slow release that lands just OUTSIDE the one eligible zone still commits to it, as long as
  // exactly ONE eligible zone is within this radius of the release point (two or more = ambiguous,
  // so we don't guess). With the inflated thumb-sized zones this makes a legal drop practically
  // unmissable, while staying unambiguous. Larger than attractionRadius (that only telegraphs).
  nearMissRadiusPx: 120, // px from the release point to the zone's centre

  // ── Arrival / settle — when a flight or a spring-home is "done" ────────────────────────────
  arriveDistancePx: 6, // a flight/home has arrived once this close to its target…
  arriveSpeedPxPerMs: 0.15, // …and this slow (so it settles, not just grazes past)
  flightMaxMs: 420, // safety cap: a flight always resolves within this, even if it never fully settles

  velocityWindowMs: 80, // estimate velocity over the last ~80ms of pointer samples (the K1 spec window)

  // ── Lift assist (P5, owner phone test 1 Aug) — "a slight pull toward the card section" ───────
  // The instant a peeked card is lifted into a drag, seed the spring with a small velocity toward
  // its nearest eligible zone, so the card visibly leans that way and the K1 projection magnet takes
  // it from there. Tiny and capped — it nudges, it does not launch (a fling is 0.6+ px/ms).
  liftAssistPxPerMs: 0.35, // the seed speed toward the nearest eligible zone at lift-off
} as const;

/**
 * Estimate the pointer's velocity (px/ms) from the tail of the sample buffer. We measure the
 * displacement across every sample newer than `windowMs` and divide by the time it spanned —
 * averaging a short window instead of trusting the last two events, so one jittery sample can't
 * fake a fling. Returns a zero vector when there isn't enough to measure.
 */
export function estimateVelocity(
  samples: PointerSample[],
  windowMs: number = DRAG_PHYSICS.velocityWindowMs,
): Vec2 {
  if (samples.length < 2) {
    return { x: 0, y: 0 };
  }
  const newest = samples[samples.length - 1]!;
  // Walk back to the oldest sample STILL inside the window. Stop before adopting one that is
  // already too old, so a long-ago resting sample can't stretch the time span and fake a slow drag.
  let oldest = newest;
  for (let index = samples.length - 2; index >= 0; index--) {
    const candidate = samples[index]!;
    if (newest.t - candidate.t > windowMs) {
      break;
    }
    oldest = candidate;
  }
  const elapsed = newest.t - oldest.t;
  if (elapsed <= 0) {
    return { x: 0, y: 0 };
  }
  return { x: (newest.x - oldest.x) / elapsed, y: (newest.y - oldest.y) / elapsed };
}

/**
 * Advance a critically-damped spring one frame toward `target`, returning the next position and
 * velocity. This is the plain spring equation — restoring pull ω²·(offset) plus damping 2ω·v —
 * integrated with explicit Euler. Explicit Euler needs a small step to stay stable, so we
 * sub-step in ≤8ms slices; that keeps it rock-solid even on a long (CPU-throttled) frame while
 * staying junior-readable (no closed-form magic). Critical damping (damping = 2ω) is the fastest
 * approach that never overshoots the finger.
 */
export function springTo(
  pos: Vec2,
  vel: Vec2,
  target: Vec2,
  dtMs: number,
  config: typeof DRAG_PHYSICS = DRAG_PHYSICS,
): { pos: Vec2; vel: Vec2 } {
  const omega = config.followFrequency; // 1/ms
  const damping = 2 * omega; // critical damping — no overshoot
  let px = pos.x;
  let py = pos.y;
  let vx = vel.x; // px/ms
  let vy = vel.y;
  let remaining = dtMs;
  while (remaining > 0) {
    const step = Math.min(config.subStepMs, remaining);
    const accelX = -omega * omega * (px - target.x) - damping * vx;
    const accelY = -omega * omega * (py - target.y) - damping * vy;
    vx += accelX * step;
    vy += accelY * step;
    px += vx * step;
    py += vy * step;
    remaining -= step;
  }
  return { pos: { x: px, y: py }, vel: { x: vx, y: vy } };
}

/**
 * The zone the card is currently AIMED at: project its position ~120ms ahead along its velocity
 * and return the nearest eligible zone whose centre lands within the attraction radius of that
 * projection. Null when the aim doesn't clearly point at any zone (the common case for a slow,
 * still drag — the projection barely moves, so nothing catches).
 */
export function aimedZone(
  pos: Vec2,
  velocity: Vec2,
  zones: ZoneGeometry[],
  config: typeof DRAG_PHYSICS = DRAG_PHYSICS,
): ZoneGeometry | null {
  const projected = {
    x: pos.x + velocity.x * config.projectionMs,
    y: pos.y + velocity.y * config.projectionMs,
  };
  let best: ZoneGeometry | null = null;
  let bestDistance: number = config.attractionRadiusPx;
  for (const zone of zones) {
    const distance = Math.hypot(projected.x - zone.cx, projected.y - zone.cy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = zone;
    }
  }
  return best;
}

/**
 * The small assist lean toward an aimed zone: ease a fraction of the remaining gap toward its
 * centre, capped at a few px so it only ever helps — never yanks a deliberate slow drag off
 * course. Applied to the RENDERED position only (a visual telegraph); it never moves the commit
 * hit-test, which stays on the real finger. Zero when nothing is aimed at.
 */
export function assistOffset(
  pos: Vec2,
  zone: ZoneGeometry | null,
  config: typeof DRAG_PHYSICS = DRAG_PHYSICS,
): Vec2 {
  if (!zone) {
    return { x: 0, y: 0 };
  }
  let offsetX = (zone.cx - pos.x) * config.assistFraction;
  let offsetY = (zone.cy - pos.y) * config.assistFraction;
  const magnitude = Math.hypot(offsetX, offsetY);
  if (magnitude > config.assistMaxPx) {
    const scale = config.assistMaxPx / magnitude;
    offsetX *= scale;
    offsetY *= scale;
  }
  return { x: offsetX, y: offsetY };
}

/**
 * Near-miss forgiveness (P3). A slow release (no fling) that lands NEAR exactly one eligible zone
 * commits to it. Returns that single zone, or null when zero zones are near (a real miss) or two or
 * more are near (ambiguous — don't guess). This is what makes a legal MAKAAN/place practically
 * unmissable with a thumb, without ever committing to the wrong set. `zones` holds only eligible
 * zones, so a near-miss can never land on anything illegal.
 */
export function nearMissZone(
  pos: Vec2,
  zones: ZoneGeometry[],
  config: typeof DRAG_PHYSICS = DRAG_PHYSICS,
): ZoneGeometry | null {
  let winner: ZoneGeometry | null = null;
  let withinRadius = 0;
  for (const zone of zones) {
    const distance = Math.hypot(pos.x - zone.cx, pos.y - zone.cy);
    if (distance <= config.nearMissRadiusPx) {
      withinRadius += 1;
      winner = zone;
    }
  }
  return withinRadius === 1 ? winner : null;
}

/**
 * Lift-assist impulse (P5). Returns a small velocity (px/ms) pointed at the nearest eligible zone,
 * to seed the spring at the moment of lift so the card leans toward where it can go. Zero when there
 * are no eligible zones (nothing to lean toward). The magnitude is a fixed small constant — a nudge,
 * never a launch — and the K1 projection magnet does the rest.
 */
export function liftImpulse(
  pos: Vec2,
  zones: ZoneGeometry[],
  config: typeof DRAG_PHYSICS = DRAG_PHYSICS,
): Vec2 {
  let nearest: ZoneGeometry | null = null;
  let bestDistance = Infinity;
  for (const zone of zones) {
    const distance = Math.hypot(zone.cx - pos.x, zone.cy - pos.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = zone;
    }
  }
  if (!nearest || bestDistance === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: ((nearest.cx - pos.x) / bestDistance) * config.liftAssistPxPerMs,
    y: ((nearest.cy - pos.y) / bestDistance) * config.liftAssistPxPerMs,
  };
}

/**
 * Fling eligibility. A release commits by fling only when it is BOTH fast enough AND pointed
 * within the aim cone of EXACTLY ONE eligible zone. Zero zones in the cone (aimless) or two or
 * more (ambiguous) ⇒ no fling, and the normal release rules apply. Because `zones` holds only
 * eligible zones, a fling can land on nothing illegal. Returns the single winning zone, or null.
 */
export function flingTarget(
  pos: Vec2,
  velocity: Vec2,
  zones: ZoneGeometry[],
  config: typeof DRAG_PHYSICS = DRAG_PHYSICS,
): ZoneGeometry | null {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < config.flingSpeedPxPerMs) {
    return null; // too slow to be a deliberate flick
  }
  const coneCosine = Math.cos((config.flingConeDeg * Math.PI) / 180);
  const dirX = velocity.x / speed;
  const dirY = velocity.y / speed;
  let winner: ZoneGeometry | null = null;
  let insideCone = 0;
  for (const zone of zones) {
    const toZoneX = zone.cx - pos.x;
    const toZoneY = zone.cy - pos.y;
    const distance = Math.hypot(toZoneX, toZoneY);
    if (distance === 0) {
      continue;
    }
    // cosine of the angle between the velocity and the direction to this zone
    const cosine = (dirX * toZoneX + dirY * toZoneY) / distance;
    if (cosine >= coneCosine) {
      insideCone += 1;
      winner = zone;
    }
  }
  return insideCone === 1 ? winner : null;
}
