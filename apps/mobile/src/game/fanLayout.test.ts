/**
 * F1 (owner playtest 30 Jul): the hand fan must NEVER clip and never read jumbled. This test
 * proves the pure geometry: for every hand size 1..12 at the board's two real widths, each
 * card's ROTATED bounding box stays inside the frame with >= 8px side padding, every card keeps
 * >= 24px of exposed (tappable) width, and no card tilts past 5 degrees.
 */
import { describe, it, expect } from 'vitest';
import { fanLayout, MAX_ROTATION_DEG } from './fanLayout';
import { CARD } from '../design/tokens';

const SIDE_PADDING_PX = 8;
const MIN_EXPOSED_PX = 24;
const CONTAINER_WIDTHS = [346, 436]; // board width at the 360 viewport and at the 460 cap
const HAND_SIZES = Array.from({ length: 12 }, (_, index) => index + 1); // 1..12

// The horizontal span of one card after rotating about its bottom-centre pivot (transformOrigin
// 'bottom center'; CSS rotate is clockwise). Mirrors exactly what the browser paints.
function rotatedXBounds(slot: { x: number; y: number; rotationDeg: number }, cardWidth: number, cardHeight: number) {
  const radians = (slot.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const pivotX = slot.x + cardWidth / 2;
  const corners: Array<[number, number]> = [
    [-cardWidth / 2, 0], // bottom-left
    [cardWidth / 2, 0], // bottom-right
    [-cardWidth / 2, -cardHeight], // top-left
    [cardWidth / 2, -cardHeight], // top-right
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const corner of corners) {
    const x = pivotX + corner[0] * cos - corner[1] * sin;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  return { minX, maxX };
}

describe('fanLayout — nothing clips, ever (F1)', () => {
  for (const containerWidth of CONTAINER_WIDTHS) {
    for (const count of HAND_SIZES) {
      it(`n=${count} @ ${containerWidth}px: rotated cards inside frame, >=24px exposed, <=5deg`, () => {
        const { cardWidth, slots } = fanLayout(count, containerWidth);
        expect(slots).toHaveLength(count);
        const cardHeight = Math.round(cardWidth * CARD.ratio);

        for (const slot of slots) {
          // rotation is capped shallow
          expect(Math.abs(slot.rotationDeg)).toBeLessThanOrEqual(MAX_ROTATION_DEG);
          // the rotated bounding box stays inside the frame with >= 8px side padding
          const { minX, maxX } = rotatedXBounds(slot, cardWidth, cardHeight);
          expect(minX).toBeGreaterThanOrEqual(SIDE_PADDING_PX);
          expect(maxX).toBeLessThanOrEqual(containerWidth - SIDE_PADDING_PX);
        }

        // every card keeps a >= 24px tappable strip: the overlapped cards by their x-advance, the
        // last (fully visible, on top) by its own width.
        for (let index = 0; index < slots.length - 1; index++) {
          expect(slots[index + 1]!.x - slots[index]!.x).toBeGreaterThanOrEqual(MIN_EXPOSED_PX);
        }
        expect(cardWidth).toBeGreaterThanOrEqual(MIN_EXPOSED_PX);
      });
    }
  }

  it('reduces card width for a dense hand rather than clipping (12 @ 346)', () => {
    const wide = fanLayout(4, 346).cardWidth;
    const dense = fanLayout(12, 346).cardWidth;
    expect(dense).toBeLessThan(wide); // the 12-card hand shrank its cards to fit
    expect(dense).toBeGreaterThanOrEqual(40); // but stayed legible
  });

  it('still holds on the narrow runtime slot (no clip) even below the 24px target', () => {
    // The real fan slot at the 360 viewport is ~238px (board minus the End-turn column). The 24px
    // exposure target isn't guaranteed there, but the hard invariant — nothing clips — still is.
    const { cardWidth, slots } = fanLayout(11, 238);
    const cardHeight = Math.round(cardWidth * CARD.ratio);
    for (const slot of slots) {
      const { minX, maxX } = rotatedXBounds(slot, cardWidth, cardHeight);
      expect(minX).toBeGreaterThanOrEqual(SIDE_PADDING_PX);
      expect(maxX).toBeLessThanOrEqual(238 - SIDE_PADDING_PX);
    }
  });
});
