import { describe, it, expect } from 'vitest';
import { parseSeedOverride, freshSeed, parseAutostartConfig } from './seed';

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

describe('parseAutostartConfig (T1 — ?difficulty / ?bots on the autostart dev route)', () => {
  it('defaults to 3 medium bots when nothing is given', () => {
    expect(parseAutostartConfig('http://x/#/autostart')).toEqual({ difficulty: 'medium', bots: 3 });
  });

  it('reads difficulty + bots from either the pre-hash or the hash query', () => {
    expect(parseAutostartConfig('http://x/?difficulty=easy&bots=1#/autostart')).toEqual({ difficulty: 'easy', bots: 1 });
    expect(parseAutostartConfig('http://x/#/autostart?difficulty=hard&bots=2')).toEqual({ difficulty: 'hard', bots: 2 });
    expect(parseAutostartConfig('http://x/?seed=7&difficulty=easy#/autostart')).toEqual({ difficulty: 'easy', bots: 3 });
  });

  it('falls back to the defaults on an invalid tier or bot count', () => {
    expect(parseAutostartConfig('http://x/?difficulty=wizard&bots=9#/autostart')).toEqual({ difficulty: 'medium', bots: 3 });
    expect(parseAutostartConfig('http://x/?bots=0#/autostart')).toEqual({ difficulty: 'medium', bots: 3 });
  });
});
