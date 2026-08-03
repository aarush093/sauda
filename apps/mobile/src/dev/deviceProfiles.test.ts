import { describe, it, expect } from 'vitest';
import { DEVICE_PROFILES, DEFAULT_PROFILE_ID, profileById } from './deviceProfiles';

// The testbed contract — LANDSCAPE (owner landscape directive, 2 Aug). These aren't decorative
// numbers: the whole pass is judged on device-emulated evidence, so the profile set itself must stay
// honest — real landscape sizes (the PHONE-1 devices rotated), real DPRs, the legacy small screen
// present as the tight subject, and a reduced-motion variant.
describe('device profiles (landscape testbed)', () => {
  it('covers the four owner-named landscape sizes plus a reduced-motion variant', () => {
    const sizes = DEVICE_PROFILES.map((p) => `${p.width}x${p.height}`);
    expect(sizes).toContain('740x360'); // legacy small — the tightest budget (short edge 360)
    expect(sizes).toContain('800x360');
    expect(sizes).toContain('832x384');
    expect(sizes).toContain('915x412');
    expect(DEVICE_PROFILES.some((p) => p.reducedMotion)).toBe(true);
  });

  it('every profile is landscape, real-DPR, and uniquely identified', () => {
    const ids = new Set<string>();
    for (const profile of DEVICE_PROFILES) {
      expect(profile.width).toBeGreaterThan(profile.height); // landscape: long edge horizontal
      expect(profile.height).toBeGreaterThanOrEqual(360); // the short edge is the tight budget
      expect(profile.dpr).toBeGreaterThanOrEqual(2); // phones are hi-DPI; a lab 1x frame is not a phone
      expect(profile.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(profile.id)).toBe(false);
      ids.add(profile.id);
    }
  });

  it('the default profile resolves and is the legacy small landscape screen', () => {
    const profile = profileById(DEFAULT_PROFILE_ID);
    expect(profile).toBeDefined();
    expect(profile!.width).toBe(740);
    expect(profile!.height).toBe(360);
  });

  it('profileById returns undefined for an unknown id', () => {
    expect(profileById('does-not-exist')).toBeUndefined();
  });
});
