import { describe, it, expect } from 'vitest';
import { parseSeedOverride, freshSeed } from './seed';

describe('seed (S6a — fresh seed per game, explicit override for tooling)', () => {
  it('reads ?seed from the pre-hash query on any route', () => {
    expect(parseSeedOverride('http://x/?seed=7#/play')).toBe(7);
    expect(parseSeedOverride('http://x/?hud=1&seed=99#/autostart')).toBe(99);
  });

  it('reads ?seed from the hash route query', () => {
    expect(parseSeedOverride('http://x/#/play?seed=123')).toBe(123);
    expect(parseSeedOverride('http://x/#/autostart?foo=1&seed=0')).toBe(0);
  });

  it('returns null when no seed is present, so the caller draws a fresh one', () => {
    expect(parseSeedOverride('http://x/#/play')).toBeNull();
    expect(parseSeedOverride('http://x/?hud=1#/autostart')).toBeNull();
    expect(parseSeedOverride('http://x/')).toBeNull();
  });

  it('rejects a non-integer / negative / empty seed (falls back to fresh)', () => {
    expect(parseSeedOverride('http://x/?seed=abc')).toBeNull();
    expect(parseSeedOverride('http://x/?seed=1.5')).toBeNull();
    expect(parseSeedOverride('http://x/?seed=-4')).toBeNull();
    expect(parseSeedOverride('http://x/?seed=')).toBeNull();
  });

  it('clamps a valid override into the uint32 seed domain', () => {
    expect(parseSeedOverride('http://x/?seed=424242')).toBe(424242);
    expect(parseSeedOverride('http://x/?seed=0')).toBe(0);
  });

  it('freshSeed draws a uint32 and does not repeat the fixed 424242 deal', () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const s = freshSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
      seeds.add(s);
    }
    // Fresh means fresh: 200 crypto draws must not collapse to a single value (the old bug).
    expect(seeds.size).toBeGreaterThan(190);
  });
});
