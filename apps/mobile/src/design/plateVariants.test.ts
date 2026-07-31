/**
 * J2 (M4b close-out): the plate-tier SELECTION maths. Pure, so it's tested on its own — the actual
 * files it maps to are wired in plates.ts. The rule: pick the smallest built tier that still covers
 * the face's on-screen pixels (rendered width × DPR), else fall back to the full-resolution source.
 */
import { describe, it, expect } from 'vitest';
import { chooseVariantWidth, PLATE_VARIANT_WIDTHS } from './plateVariants';

describe('chooseVariantWidth (J2 plate tier selection)', () => {
  it('returns null with no rendered-width hint — a full-size face uses the source plate', () => {
    expect(chooseVariantWidth(null, 2)).toBeNull();
    expect(chooseVariantWidth(undefined, 2)).toBeNull();
    expect(chooseVariantWidth(0, 2)).toBeNull();
  });

  it('picks the smallest tier that covers rendered-width × DPR', () => {
    // board cascade ~38 px: 38×2 = 76 and 38×3 = 114 both fit inside the 160 tier
    expect(chooseVariantWidth(38, 2)).toBe(160);
    expect(chooseVariantWidth(38, 3)).toBe(160);
    // hand wheel ~69 px: 69×2 = 138 → 160; TableView 92 px: 92×2 = 184 → 320
    expect(chooseVariantWidth(69, 2)).toBe(160);
    expect(chooseVariantWidth(92, 2)).toBe(320);
  });

  it('falls back to the source plate (null) when no tier is large enough', () => {
    // stage 112 px at DPR3 = 336 > the largest 320 tier → the full 600 px source
    expect(chooseVariantWidth(112, 3)).toBeNull();
  });

  it('is exact at the tier boundary', () => {
    expect(chooseVariantWidth(80, 2)).toBe(160); // 160 exactly → 160
    expect(chooseVariantWidth(80.5, 2)).toBe(320); // 161 → next tier up
    expect(chooseVariantWidth(160, 2)).toBe(320); // 320 exactly → 320
  });

  it('never under-serves: a missing/odd DPR is floored at 1', () => {
    expect(chooseVariantWidth(150, 0)).toBe(160); // 0 treated as 1 → 150 → 160
    expect(chooseVariantWidth(150, 0.5)).toBe(160);
  });

  it('respects a custom tier list (so plates.ts can pass only the tiers that were built)', () => {
    expect(chooseVariantWidth(100, 2, [128, 256, 512])).toBe(256); // 200 → 256
    expect(chooseVariantWidth(300, 2, [128, 256])).toBeNull(); // 600 > 256 → source
    expect(chooseVariantWidth(50, 2, [])).toBeNull(); // no tiers built → source
  });

  it('ships the two documented tiers, ascending', () => {
    expect([...PLATE_VARIANT_WIDTHS]).toEqual([160, 320]);
  });
});
