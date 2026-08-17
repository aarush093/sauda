/**
 * Device-reality testbed — LANDSCAPE (owner landscape directive, 2 Aug). SAUDA is now a
 * landscape-only game (R0): the play screen only ever lays out with the long edge horizontal. So the
 * testbed rotates — the same four real Android devices as the PHONE-1 portrait set, width and height
 * swapped, plus a reduced-motion variant — and every capture / measure / profile run drives these,
 * so a regression that only shows on a real landscape phone can't hide behind a desktop frame.
 *
 * The binding constraint flips with the orientation: in portrait it was height; in landscape it is
 * the SHORT edge (360px tall), so the wheel + tab rail + panels must all survive that thin band.
 *
 * The profile data lives in deviceProfiles.json so the Node capture scripts (which cannot import a
 * .ts) and this typed wrapper share ONE source of truth. This file adds the types + a couple of
 * small helpers and is unit-tested; the JSON is the thing you edit to tune a size.
 */
import data from './deviceProfiles.json';

// The four safe-area insets, in CSS px. In LANDSCAPE the notch sits on the SIDE (left/right); the home
// indicator on the bottom. Non-zero only on notch/home-indicator devices (iPhone 12); a home-button
// phone (iPhone SE) has none.
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DeviceProfile {
  id: string; // stable slug used in capture filenames / HUD
  label: string; // human label for the HUD picker
  width: number; // CSS px — the layout viewport width (the LONG edge in landscape)
  height: number; // CSS px — the layout viewport height (the SHORT edge, the tight budget)
  dpr: number; // real deviceScaleFactor for the emulated device
  reducedMotion: boolean; // drive prefers-reduced-motion for this profile
  // U1 (iOS Safari): the browser chrome height (px) that eats USABLE height — the capture simulates it
  // by shrinking the viewport, since Playwright renders no real URL bar. Absent = a full-bleed profile.
  chrome?: number;
  // U1 (iOS Safari): the safe-area inset the notch/home-indicator reserves. Absent = no insets.
  safeArea?: SafeAreaInsets;
}

export const DEVICE_PROFILES: DeviceProfile[] = data.profiles;

// The usable height after browser chrome is subtracted — what visualViewport.height reports on a real
// iOS Safari once the URL bar / tab strip take their share. Full-bleed profiles (no `chrome`) keep the
// full height. This is the height the capture harness sizes its viewport to, so the app measures the
// same constrained box a real phone reports.
export function usableHeight(profile: DeviceProfile): number {
  return profile.height - (profile.chrome ?? 0);
}

// The legacy small screen (740x360) is the tightest budget in landscape — the shortest height AND
// the narrowest width — so the layout must survive here with no clipping; it stays the default
// subject for a single-still smoke check.
export const DEFAULT_PROFILE_ID = 'legacy-740x360';

export function profileById(id: string): DeviceProfile | undefined {
  return DEVICE_PROFILES.find((profile) => profile.id === id);
}
