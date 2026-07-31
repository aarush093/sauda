/**
 * J3 (M4b close-out): a scale-aware legibility FLOOR for the card value badge.
 *
 * The value-badge numerals ("₹N Cr") are drawn at 7 px inside the full-size face, which is then
 * transform-scaled down for the wheel / board cascades. Measured, the wheel badge lands at ~7.3
 * device px — under the owner's 10-device-px bar, and pure geometry can't reach it (H3 flag 1). So
 * below the scale where the numerals would drop under the floor, we GROW the badge (anchored at its
 * corner — the map-label pattern) so its on-screen numerals hold at exactly the floor. The full-size
 * face is untouched (the factor is 1 at full size), and the whole thing ships behind a toggle that is
 * OFF by default until the owner rules on the A/B stills.
 *
 * Both pieces here are pure so the maths is unit-testable and the toggle has one obvious source.
 */

export const BADGE_FONT_PX = 7; // the value-badge numeral size inside the full-size (132 px) face
export const BADGE_MIN_DEVICE_PX = 10; // the legibility floor the owner set for badge numerals

// The growth factor for the badge at a given face scale + device pixel ratio. On screen the numerals
// are BADGE_FONT_PX × faceScale × dpr device px; once that is at/above the floor we return 1 (no
// change — so the full-size face, faceScale 1, is always byte-identical). Below the floor we return
// the factor that lifts the numerals to exactly BADGE_MIN_DEVICE_PX. Anchored at the badge corner by
// the caller, so growing it pushes into the card, never off it.
export function badgeFloorScale(faceScale: number, dpr: number): number {
  const onScreenDevicePx = BADGE_FONT_PX * faceScale * Math.max(1, dpr);
  if (onScreenDevicePx >= BADGE_MIN_DEVICE_PX) {
    return 1; // already legible → leave the badge exactly as drawn
  }
  return BADGE_MIN_DEVICE_PX / onScreenDevicePx; // grow so the numerals land on the floor
}

// The floor ships OFF until the owner picks it from the A/B stills (J3). Flip this one constant to
// make ON the default. A `?badgeFloor=1|0` (or on|off) query param overrides it per page load, which
// is how the capture harness shoots the side-by-side ON/OFF stills without a rebuild.
export const BADGE_FLOOR_DEFAULT = false;

export function badgeFloorEnabled(): boolean {
  if (typeof window === 'undefined') {
    return BADGE_FLOOR_DEFAULT; // SSR / jsdom: honour the shipped default
  }
  const override = new URLSearchParams(window.location.search).get('badgeFloor');
  if (override === '1' || override === 'on') return true;
  if (override === '0' || override === 'off') return false;
  return BADGE_FLOOR_DEFAULT;
}
