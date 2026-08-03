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

export interface DeviceProfile {
  id: string; // stable slug used in capture filenames / HUD
  label: string; // human label for the HUD picker
  width: number; // CSS px — the layout viewport width (the LONG edge in landscape)
  height: number; // CSS px — the layout viewport height (the SHORT edge, the tight budget)
  dpr: number; // real deviceScaleFactor for the emulated device
  reducedMotion: boolean; // drive prefers-reduced-motion for this profile
}

export const DEVICE_PROFILES: DeviceProfile[] = data.profiles;

// The legacy small screen (740x360) is the tightest budget in landscape — the shortest height AND
// the narrowest width — so the layout must survive here with no clipping; it stays the default
// subject for a single-still smoke check.
export const DEFAULT_PROFILE_ID = 'legacy-740x360';

export function profileById(id: string): DeviceProfile | undefined {
  return DEVICE_PROFILES.find((profile) => profile.id === id);
}
