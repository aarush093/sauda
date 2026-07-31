/**
 * J3 (M4b close-out): the value-badge legibility FLOOR maths + its toggle. Pure functions, tested on
 * their own. The floor grows the badge so its on-screen numerals hold at BADGE_MIN_DEVICE_PX; at full
 * size (or when already legible, or when the toggle is off) it must be a no-op so the face is untouched.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { badgeFloorScale, badgeFloorEnabled, BADGE_FLOOR_DEFAULT, BADGE_FONT_PX, BADGE_MIN_DEVICE_PX } from './badgeFloor';

describe('badgeFloorScale (J3 badge legibility floor)', () => {
  it('leaves a legible badge untouched (factor 1) — so the full-size face stays byte-identical', () => {
    expect(badgeFloorScale(1, 2)).toBe(1); // full size: 7 × 1 × 2 = 14 device px ≥ 10
    expect(badgeFloorScale(0.85, 2)).toBe(1); // stage ~112 px: 7 × 0.85 × 2 = 11.9 ≥ 10
  });

  it('grows a too-small badge so its numerals land exactly on the floor', () => {
    const faceScale = 69 / 132; // hand wheel rest card
    const grow = badgeFloorScale(faceScale, 2); // natural 7 × 0.523 × 2 = 7.32 device px (< 10)
    expect(grow).toBeGreaterThan(1);
    // after growing, the on-screen numerals sit exactly on the floor
    expect(BADGE_FONT_PX * faceScale * 2 * grow).toBeCloseTo(BADGE_MIN_DEVICE_PX, 6);
  });

  it('grows more the smaller the face (a board cascade needs more lift than the wheel)', () => {
    const wheel = badgeFloorScale(69 / 132, 2);
    const board = badgeFloorScale(38 / 132, 2);
    expect(board).toBeGreaterThan(wheel);
  });

  it('is DPR-aware: a denser screen can already clear the floor at the same face scale', () => {
    expect(badgeFloorScale(0.523, 2)).toBeGreaterThan(1); // DPR2: 7.32 < 10 → grows
    expect(badgeFloorScale(0.523, 3)).toBe(1); // DPR3: 7 × 0.523 × 3 = 10.98 ≥ 10 → untouched
  });

  it('floors DPR at 1 so a missing ratio never under-grows', () => {
    expect(badgeFloorScale(0.3, 0)).toBe(badgeFloorScale(0.3, 1));
  });
});

describe('badgeFloorEnabled (J3 toggle)', () => {
  const originalUrl = window.location.pathname + window.location.search;
  afterEach(() => window.history.replaceState(null, '', originalUrl));

  it('ships OFF by default (the owner rules on the A/B stills first)', () => {
    expect(BADGE_FLOOR_DEFAULT).toBe(false);
    window.history.replaceState(null, '', '/');
    expect(badgeFloorEnabled()).toBe(false);
  });

  it('a ?badgeFloor=1 (or =on) query param flips it ON for a page load', () => {
    window.history.replaceState(null, '', '/?badgeFloor=1');
    expect(badgeFloorEnabled()).toBe(true);
    window.history.replaceState(null, '', '/?badgeFloor=on');
    expect(badgeFloorEnabled()).toBe(true);
  });

  it('?badgeFloor=0 (or =off) forces it OFF', () => {
    window.history.replaceState(null, '', '/?badgeFloor=0');
    expect(badgeFloorEnabled()).toBe(false);
    window.history.replaceState(null, '', '/?badgeFloor=off');
    expect(badgeFloorEnabled()).toBe(false);
  });
});
