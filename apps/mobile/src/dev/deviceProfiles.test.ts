import { describe, it, expect } from 'vitest';
import { DEVICE_PROFILES, DEFAULT_PROFILE_ID, profileById, usableHeight } from './deviceProfiles';

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

  // U1 (first-player pass): the two iOS Safari devices the sister and other real testers hold. These
  // carry the extra reality the Android set omits — browser chrome that eats usable height, and a
  // safe-area inset that in LANDSCAPE sits on the SIDE.
  it('covers the iPhone 12 and iPhone SE landscape profiles the sister actually held', () => {
    const twelve = profileById('iphone12-844x390');
    const se = profileById('iphonese-667x375');
    expect(twelve).toBeDefined();
    expect(se).toBeDefined();
    expect(`${twelve!.width}x${twelve!.height}`).toBe('844x390');
    expect(`${se!.width}x${se!.height}`).toBe('667x375');
  });

  it('the iOS profiles simulate real browser chrome (reduced usable height)', () => {
    for (const id of ['iphone12-844x390', 'iphonese-667x375']) {
      const profile = profileById(id)!;
      expect(profile.chrome).toBeGreaterThan(0); // Safari's URL bar / tab strip take real height
      expect(usableHeight(profile)).toBeLessThan(profile.height); // so the usable box is shorter
      expect(usableHeight(profile)).toBe(profile.height - profile.chrome!);
    }
  });

  it('the notch device carries a non-zero SIDE safe-area inset (landscape notch)', () => {
    const twelve = profileById('iphone12-844x390')!;
    expect(twelve.safeArea).toBeDefined();
    // In landscape the notch is on the left OR right — a top-only pad would miss it entirely.
    expect(twelve.safeArea!.left + twelve.safeArea!.right).toBeGreaterThan(0);
    expect(twelve.safeArea!.bottom).toBeGreaterThan(0); // the home indicator
  });

  it('a full-bleed Android profile has no chrome and its usable height is the full height', () => {
    const legacy = profileById(DEFAULT_PROFILE_ID)!;
    expect(legacy.chrome).toBeUndefined();
    expect(usableHeight(legacy)).toBe(legacy.height);
  });
});
