import { describe, it, expect } from 'vitest';
import { orientationOf, isPortrait } from './orientation';

// R0: the landscape-only rule is one pure function, so it is provable without a browser. The gate's
// whole correctness ("the game never lays out in portrait") rests on this staying honest.
describe('orientation rule (landscape-only)', () => {
  it('calls a taller-than-wide viewport portrait', () => {
    expect(orientationOf(360, 740)).toBe('portrait');
    expect(isPortrait(412, 915)).toBe(true);
  });

  it('calls a wider-than-tall viewport landscape', () => {
    expect(orientationOf(740, 360)).toBe('landscape');
    expect(isPortrait(915, 412)).toBe(false);
  });

  it('treats a perfect square as landscape (the game lays out fine at 1:1)', () => {
    // > not >= : the exact tie must NOT flip the gate on mid-rotation w===h reports.
    expect(orientationOf(500, 500)).toBe('landscape');
    expect(isPortrait(500, 500)).toBe(false);
  });

  it('flips exactly at the one-pixel boundary', () => {
    expect(orientationOf(361, 360)).toBe('landscape');
    expect(orientationOf(360, 361)).toBe('portrait');
  });

  it('matches every landscape device profile and its rotated portrait', () => {
    // The four testbed sizes are landscape; their swaps are portrait — the gate must agree.
    const landscape: [number, number][] = [
      [740, 360],
      [800, 360],
      [832, 384],
      [915, 412],
    ];
    for (const [width, height] of landscape) {
      expect(orientationOf(width, height)).toBe('landscape');
      expect(orientationOf(height, width)).toBe('portrait');
    }
  });
});
