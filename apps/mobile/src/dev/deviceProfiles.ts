/**
 * Device-reality testbed (PHONE-1, owner phone test 1 Aug). The owner's first real-phone game
 * broke every lab-frame assumption (a void, cards under slabs, unhittable drops, page scroll under
 * the URL bar). The lesson: a single 360x740 desktop frame is NOT a phone. From here on, every
 * capture / measure / profile run drives this fixed set of REAL portrait profiles — four live
 * Android sizes at their real device-scale factors, plus a reduced-motion variant — so a regression
 * that only shows on a phone can't hide behind a desktop frame again.
 *
 * The profile data lives in deviceProfiles.json so the Node capture scripts (which cannot import a
 * .ts) and this typed wrapper share ONE source of truth. This file adds the types + a couple of
 * small helpers and is unit-tested; the JSON is the thing you edit to tune a size.
 */
import data from './deviceProfiles.json';

export interface DeviceProfile {
  id: string; // stable slug used in capture filenames / HUD
  label: string; // human label for the HUD picker
  width: number; // CSS px — the layout viewport width
  height: number; // CSS px — the layout viewport height
  dpr: number; // real deviceScaleFactor for the emulated device
  reducedMotion: boolean; // drive prefers-reduced-motion for this profile
}

export const DEVICE_PROFILES: DeviceProfile[] = data.profiles;

// The legacy small screen (360x740) is the tightest height budget — the layout must survive here
// with no clipping, so it stays the default subject for a single-still smoke check.
export const DEFAULT_PROFILE_ID = 'legacy-360x740';

export function profileById(id: string): DeviceProfile | undefined {
  return DEVICE_PROFILES.find((profile) => profile.id === id);
}
