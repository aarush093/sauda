import { describe, it, expect } from 'vitest';
import { DEVICE_PROFILES, DEFAULT_PROFILE_ID, profileById } from './deviceProfiles';

// The testbed contract (PHONE-1). These aren't decorative numbers — the whole pass is judged on
// device-emulated evidence, so the profile set itself must stay honest: real portrait sizes, real
// DPRs, the legacy small screen present as the tight-height subject, and a reduced-motion variant.
describe('device profiles (real-device testbed)', () => {
  it('covers the four owner-named portrait sizes plus a reduced-motion variant', () => {
    const sizes = DEVICE_PROFILES.map((p) => `${p.width}x${p.height}`);
    expect(sizes).toContain('360x740'); // legacy small — the tightest height budget
    expect(sizes).toContain('360x800');
    expect(sizes).toContain('384x832');
    expect(sizes).toContain('412x915');
    expect(DEVICE_PROFILES.some((p) => p.reducedMotion)).toBe(true);
  });

  it('every profile is portrait, real-DPR, and uniquely identified', () => {
    const ids = new Set<string>();
    for (const profile of DEVICE_PROFILES) {
      expect(profile.height).toBeGreaterThan(profile.width); // portrait
      expect(profile.width).toBeGreaterThanOrEqual(360);
      expect(profile.dpr).toBeGreaterThanOrEqual(2); // phones are hi-DPI; a lab 1x frame is not a phone
      expect(profile.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(profile.id)).toBe(false);
      ids.add(profile.id);
    }
  });

  it('the default profile resolves and is the legacy small screen', () => {
    const profile = profileById(DEFAULT_PROFILE_ID);
    expect(profile).toBeDefined();
    expect(profile!.width).toBe(360);
    expect(profile!.height).toBe(740);
  });

  it('profileById returns undefined for an unknown id', () => {
    expect(profileById('does-not-exist')).toBeUndefined();
  });
});
