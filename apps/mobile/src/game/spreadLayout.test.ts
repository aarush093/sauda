/**
 * S1 (owner playtest, 13 Aug): the hand SPREAD is a FLAT row of UPRIGHT cards — every card rotation
 * 0, bottom-anchored, evenly overlapping, ONE size at every count. This proves the pure geometry:
 * for every hand size 1..12 at the real container widths, no card clips left / right / top, every
 * card's exposed strip (banner + value badge) stays at/above the readability minimum, spacing is
 * perfectly even, the size is constant, and the output is deterministic. Replaces the retired
 * wheelLayout suite (the spread supersedes the wheel).
 */
import { describe, it, expect } from 'vitest';
import { spreadLayout, spreadCardWidth, READABLE_STRIP_FRACTION } from './spreadLayout';
import { CARD } from '../design/tokens';

// The landscape spread containers = profile width − rail(46): 740/800/832/915 → 694/754/786/869.
// The two legacy portrait widths (346, 436) are kept so the pure geometry is stress-tested at the
// tightest frames too — the spread is width-agnostic and must hold everywhere.
const CONTAINER_WIDTHS = [346, 436, 694, 754, 786, 869];
const LANDSCAPE_WIDTHS = [694, 869]; // the two profiles the owner names (740×360 and 915×412)
const HAND_SIZES = Array.from({ length: 12 }, (_, index) => index + 1); // 1..12
const EPS = 0.6; // sub-pixel rounding tolerance

describe('spreadLayout — flat upright cards, no clip, even spacing, readable strip (S1)', () => {
  for (const containerWidth of CONTAINER_WIDTHS) {
    for (const count of HAND_SIZES) {
      it(`n=${count} @ ${containerWidth}px: upright, no clip, exposed strip ≥ min, even spacing, one size`, () => {
        const cardWidth = spreadCardWidth(containerWidth);
        const layout = spreadLayout(count, containerWidth, cardWidth);
        const { cardHeight, height, step, readableStripPx, slots } = layout;
        expect(slots).toHaveLength(count);

        // ONE card size at every count (depends only on the container width).
        expect(layout.cardWidth).toBe(spreadCardWidth(containerWidth));
        expect(cardHeight).toBe(Math.round(cardWidth * CARD.ratio));
        // Upright always: a slot carries position + stacking only, never a rotation.
        for (const slot of slots) {
          expect(Object.keys(slot).sort()).toEqual(['anchorX', 'x', 'z']);
        }

        for (let index = 0; index < slots.length; index++) {
          const slot = slots[index]!;
          // No left / right clip: the whole upright card box sits inside the container.
          expect(slot.x).toBeGreaterThanOrEqual(-EPS);
          expect(slot.x + cardWidth).toBeLessThanOrEqual(containerWidth + EPS);
          // Bottom-anchored & upright → the band is exactly the card height (no top clip).
          expect(height).toBe(cardHeight);
          // Stacking order rises left→right (later cards on top).
          expect(slot.z).toBe(index);
        }

        // Even spacing: every gap between adjacent cards is identical.
        for (let index = 1; index < slots.length; index++) {
          expect(slots[index]!.x - slots[index - 1]!.x).toBeCloseTo(step, 6);
        }

        // Every exposed strip is readable: the uncovered left strip (the step, for all but the last
        // card) never drops below the readability minimum.
        if (count >= 2) {
          expect(step).toBeGreaterThanOrEqual(readableStripPx - EPS);
        }

        // The scrub anchor increases monotonically left→right, so cardAtX is well-ordered.
        for (let index = 1; index < slots.length; index++) {
          expect(slots[index]!.anchorX).toBeGreaterThan(slots[index - 1]!.anchorX);
        }
      });
    }
  }

  it('a lone card sits centred and upright (n=1)', () => {
    const width = 869;
    const cardWidth = spreadCardWidth(width);
    const { slots, step } = spreadLayout(1, width, cardWidth);
    expect(slots).toHaveLength(1);
    expect(step).toBe(0);
    expect(slots[0]!.x).toBeCloseTo((width - cardWidth) / 2, 6); // centred
  });

  it('the row is centred in the container at every count', () => {
    for (const width of LANDSCAPE_WIDTHS) {
      const cardWidth = spreadCardWidth(width);
      for (const count of HAND_SIZES) {
        const { slots, step } = spreadLayout(count, width, cardWidth);
        const footprint = cardWidth + step * (count - 1);
        const leftGap = slots[0]!.x;
        const rightGap = width - (slots[count - 1]!.x + cardWidth);
        expect(leftGap).toBeCloseTo(rightGap, 4); // symmetric margins
        expect(leftGap).toBeGreaterThanOrEqual(-EPS);
        expect(footprint).toBeLessThanOrEqual(width + EPS);
      }
    }
  });

  it('low n sits nearly side-by-side (comfortable step); high n overlaps more (squeezed step)', () => {
    const width = 869;
    const cardWidth = spreadCardWidth(width);
    const few = spreadLayout(3, width, cardWidth).step;
    const many = spreadLayout(12, width, cardWidth).step;
    expect(few).toBeGreaterThan(many); // more cards → tighter overlap
    expect(few).toBeCloseTo(Math.round(cardWidth * 0.8), 6); // low n uses the comfortable step
  });

  it('the size-up actually uses the landscape width (≈96 px at the 915 profile, up from the wheel)', () => {
    expect(spreadCardWidth(869)).toBeGreaterThanOrEqual(92); // 915 − rail
    expect(spreadCardWidth(869)).toBeLessThanOrEqual(100);
    expect(spreadCardWidth(694)).toBeGreaterThan(74); // 740 − rail, still bigger than the old ~69
    expect(spreadCardWidth(320)).toBe(68); // narrow fallback clamps to the min, never absurdly small
  });

  it('the exposed strip clears the readability minimum with margin at both landscape widths, n≤12', () => {
    for (const width of LANDSCAPE_WIDTHS) {
      const cardWidth = spreadCardWidth(width);
      const min = Math.round(cardWidth * READABLE_STRIP_FRACTION);
      for (const count of HAND_SIZES) {
        const { step } = spreadLayout(count, width, cardWidth);
        if (count >= 2) {
          expect(step).toBeGreaterThanOrEqual(min);
        }
      }
    }
  });

  it('a wider frame yields a wider (or equal) card — the size scales with the container', () => {
    expect(spreadCardWidth(869)).toBeGreaterThanOrEqual(spreadCardWidth(694));
    expect(spreadCardWidth(694)).toBeGreaterThanOrEqual(spreadCardWidth(346));
  });

  it('is deterministic — same inputs reproduce the same layout', () => {
    const a = spreadLayout(9, 869, spreadCardWidth(869));
    const b = spreadLayout(9, 869, spreadCardWidth(869));
    expect(a).toEqual(b);
  });

  it('never returns a NaN or negative coordinate at any count/width', () => {
    for (const width of CONTAINER_WIDTHS) {
      const cardWidth = spreadCardWidth(width);
      for (const count of HAND_SIZES) {
        for (const slot of spreadLayout(count, width, cardWidth).slots) {
          expect(Number.isFinite(slot.x)).toBe(true);
          expect(Number.isFinite(slot.anchorX)).toBe(true);
          expect(slot.x).toBeGreaterThanOrEqual(-EPS);
        }
      }
    }
  });
});
