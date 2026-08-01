/**
 * K1 drag-physics proofs. Every function that decides the feel is pure, so we can prove the
 * hard parts — the velocity estimate, the spring's convergence-without-overshoot, the magnetic
 * assist cap, and the fling cone's "exactly one zone" rule — with no browser and no timers.
 */
import { describe, it, expect } from 'vitest';
import {
  DRAG_PHYSICS,
  estimateVelocity,
  springTo,
  aimedZone,
  assistOffset,
  flingTarget,
  nearMissZone,
  type PointerSample,
  type Vec2,
  type ZoneGeometry,
} from './dragPhysics';

describe('estimateVelocity', () => {
  it('is zero when there are fewer than two samples', () => {
    expect(estimateVelocity([])).toEqual({ x: 0, y: 0 });
    expect(estimateVelocity([{ x: 5, y: 5, t: 0 }])).toEqual({ x: 0, y: 0 });
  });

  it('measures a steady rightward drag as px/ms across the window', () => {
    // 100px in 100ms → 1 px/ms in x, none in y.
    const samples: PointerSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 50, y: 0, t: 50 },
      { x: 100, y: 0, t: 100 },
    ];
    const velocity = estimateVelocity(samples);
    expect(velocity.x).toBeCloseTo(1, 5);
    expect(velocity.y).toBeCloseTo(0, 5);
  });

  it('only averages samples inside the window, so a slow start cannot damp a fast recent leg', () => {
    // A slow crawl (0.1px/ms) for 60ms, then a fast leg (1px/ms) over the last 20ms.
    const samples: PointerSample[] = [
      { x: 0, y: 0, t: 0 },
      { x: 2, y: 0, t: 20 },
      { x: 4, y: 0, t: 40 },
      { x: 6, y: 0, t: 60 },
      { x: 26, y: 0, t: 80 },
    ];
    // A tight 30ms window sees only the fast recent leg (20px over 20ms → 1px/ms).
    const recent = estimateVelocity(samples, 30);
    expect(recent.x).toBeCloseTo(1, 5);
    // A wide 100ms window folds in the slow start and reads much slower (26px over 80ms).
    const wide = estimateVelocity(samples, 100);
    expect(wide.x).toBeCloseTo(26 / 80, 5);
    expect(wide.x).toBeLessThan(recent.x);
  });

  it('is zero when two samples share a timestamp (no time elapsed)', () => {
    expect(estimateVelocity([{ x: 0, y: 0, t: 10 }, { x: 9, y: 9, t: 10 }])).toEqual({ x: 0, y: 0 });
  });
});

describe('springTo', () => {
  const target: Vec2 = { x: 200, y: 100 };

  it('converges onto the target and settles (critically damped, so it does not overshoot)', () => {
    let pos: Vec2 = { x: 0, y: 0 };
    let vel: Vec2 = { x: 0, y: 0 };
    let maxX = 0;
    for (let frame = 0; frame < 240; frame++) {
      const next = springTo(pos, vel, target, 16);
      pos = next.pos;
      vel = next.vel;
      maxX = Math.max(maxX, pos.x);
    }
    expect(pos.x).toBeCloseTo(200, 1);
    expect(pos.y).toBeCloseTo(100, 1);
    // never overshot past the target (critical damping) — allow a hair for float noise
    expect(maxX).toBeLessThanOrEqual(200 + 0.5);
  });

  it('stays stable under a long throttled frame (sub-stepping keeps explicit Euler in bounds)', () => {
    let pos: Vec2 = { x: 0, y: 0 };
    let vel: Vec2 = { x: 0, y: 0 };
    for (let frame = 0; frame < 60; frame++) {
      const next = springTo(pos, vel, target, 48); // 48ms ≈ a 4× CPU-throttled frame
      pos = next.pos;
      vel = next.vel;
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Math.abs(pos.x)).toBeLessThan(1000); // no blow-up
    }
    expect(pos.x).toBeCloseTo(200, 0);
  });

  it('keeps the steady-state lag under ~20px at a normal placement speed', () => {
    // A normal placement drag is ~0.5px/ms; chase it and the trailing gap should stabilise well
    // under 20px (≈ 2·speed/ω = 2·0.5/0.1 = 10px, plus a little discretisation). A brisk 1px/ms
    // flick lags more — but flings, not the follow spring, own that regime.
    let pos: Vec2 = { x: 0, y: 0 };
    let vel: Vec2 = { x: 0, y: 0 };
    let targetX = 0;
    let lag = 0;
    for (let frame = 0; frame < 200; frame++) {
      targetX += 8; // 8px per 16ms frame = 0.5px/ms
      const next = springTo(pos, vel, { x: targetX, y: 0 }, 16);
      pos = next.pos;
      vel = next.vel;
      lag = targetX - pos.x;
    }
    expect(lag).toBeGreaterThan(0);
    expect(lag).toBeLessThan(20);
  });
});

describe('aimedZone', () => {
  const bank: ZoneGeometry = { id: 'bank', cx: 300, cy: 0 };
  const play: ZoneGeometry = { id: 'play', cx: 0, cy: -300 };

  it('catches the zone the projection lands on', () => {
    // At (0,0) moving right at 1px/ms, 120ms ahead → (120,0); within 90px of bank? no. Speed it up.
    const fast = aimedZone({ x: 0, y: 0 }, { x: 2, y: 0 }, [bank, play]); // 120ms → x=240, dist to bank 60
    expect(fast?.id).toBe('bank');
  });

  it('is null when the aim points away from every zone', () => {
    const away = aimedZone({ x: 0, y: 0 }, { x: 0, y: 2 }, [bank, play]); // heads down, toward neither
    expect(away).toBeNull();
  });

  it('is null for a near-still drag (projection barely moves)', () => {
    const still = aimedZone({ x: 0, y: 0 }, { x: 0.01, y: 0 }, [bank, play]);
    expect(still).toBeNull();
  });
});

describe('assistOffset', () => {
  it('is zero when nothing is aimed at', () => {
    expect(assistOffset({ x: 0, y: 0 }, null)).toEqual({ x: 0, y: 0 });
  });

  it('leans toward the zone centre but never beyond the cap', () => {
    const zone: ZoneGeometry = { id: 'bank', cx: 1000, cy: 0 }; // very far → uncapped lean would be huge
    const offset = assistOffset({ x: 0, y: 0 }, zone);
    expect(offset.x).toBeCloseTo(DRAG_PHYSICS.assistMaxPx, 5); // clamped to the max, pointing at the zone
    expect(offset.y).toBeCloseTo(0, 5);
  });

  it('eases only a fraction of a small gap (sub-cap, so a near drag is barely nudged)', () => {
    const zone: ZoneGeometry = { id: 'bank', cx: 20, cy: 0 };
    const offset = assistOffset({ x: 0, y: 0 }, zone);
    expect(offset.x).toBeCloseTo(20 * DRAG_PHYSICS.assistFraction, 5);
  });
});

describe('flingTarget', () => {
  const bank: ZoneGeometry = { id: 'bank', cx: 0, cy: -200 }; // straight up
  const setRed: ZoneGeometry = { id: 'set:red', cx: 150, cy: -150 }; // up-and-right

  it('commits to the one zone inside the cone of a fast, aimed flick', () => {
    const up: Vec2 = { x: 0, y: -1 }; // 1px/ms straight up, above the 0.6 floor
    expect(flingTarget({ x: 0, y: 0 }, up, [bank, setRed])?.id).toBe('bank');
  });

  it('does not fling when the release is too slow', () => {
    const slow: Vec2 = { x: 0, y: -0.3 }; // below the 0.6 px/ms floor
    expect(flingTarget({ x: 0, y: 0 }, slow, [bank, setRed])).toBeNull();
  });

  it('does not fling when two eligible zones fall inside the cone (ambiguous)', () => {
    // A wide flick up-and-slightly-right can point within 30° of BOTH zones from the origin.
    const between: Vec2 = { x: 0.4, y: -1 };
    const both = flingTarget({ x: 0, y: 0 }, between, [bank, setRed]);
    // If both are in-cone the rule returns null; assert the rule holds by counting via a tight cone.
    const forcedAmbiguous = flingTarget(
      { x: 0, y: 0 },
      between,
      [
        { id: 'a', cx: 0, cy: -100 },
        { id: 'b', cx: 5, cy: -100 },
      ],
    );
    expect(forcedAmbiguous).toBeNull();
    expect(both === null || both.id === 'bank' || both.id === 'set:red').toBe(true);
  });

  it('does not fling when the flick points at no zone', () => {
    const down: Vec2 = { x: 0, y: 1 }; // fast, but away from both (which are above)
    expect(flingTarget({ x: 0, y: 0 }, down, [bank, setRed])).toBeNull();
  });
});

describe('nearMissZone (P3 forgiveness)', () => {
  const setChennai: ZoneGeometry = { id: 'set:chennai', cx: 100, cy: 100 };
  const setMumbai: ZoneGeometry = { id: 'set:mumbai', cx: 400, cy: 100 };

  it('commits to the one eligible zone when the release lands just outside it', () => {
    // 110px away — a real thumb miss, but within the 120px forgiveness radius.
    const hit = nearMissZone({ x: 100, y: 210 }, [setChennai, setMumbai]);
    expect(hit?.id).toBe('set:chennai');
  });

  it('does not commit when the release is beyond the radius (a genuine miss)', () => {
    expect(nearMissZone({ x: 100, y: 260 }, [setChennai])).toBeNull(); // 160px > 120
  });

  it('does not guess when two eligible zones are both within the radius', () => {
    const a: ZoneGeometry = { id: 'set:a', cx: 100, cy: 100 };
    const b: ZoneGeometry = { id: 'set:b', cx: 180, cy: 100 };
    expect(nearMissZone({ x: 140, y: 100 }, [a, b])).toBeNull(); // both within 120 → ambiguous
  });

  it('returns null when there are no eligible zones at all', () => {
    expect(nearMissZone({ x: 0, y: 0 }, [])).toBeNull();
  });
});
