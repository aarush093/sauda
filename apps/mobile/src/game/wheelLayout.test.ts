/**
 * G2 (owner playtest 2): the hand WHEEL must keep the outer readable strip of EVERY card fully
 * inside the frame, with even angular spacing and ONE card size at every count — while lower
 * portions may run beneath the bottom edge by design. This proves the pure geometry: for every hand
 * size 1..12 at the two real board widths, no rotated card clips left / right / top, the top-28%
 * readable strip of every card sits fully inside the band, spacing is even, and the size is constant.
 */
import { describe, it, expect } from 'vitest';
import { wheelLayout, READABLE_STRIP, type WheelSlot } from './wheelLayout';

const CONTAINER_WIDTHS = [346, 436]; // board width at the 360 viewport and at the 460 cap
const HAND_SIZES = Array.from({ length: 12 }, (_, index) => index + 1); // 1..12
const EPS = 0.6; // sub-pixel rounding tolerance

// The four rotated corners of a card, mirroring exactly what the browser paints: the box is rotated
// about its bottom-centre (transform-origin 50% 100%; CSS rotate is clockwise in screen coords).
function rotatedCorners(slot: WheelSlot, cardWidth: number, cardHeight: number, topFraction = 1) {
  const radians = (slot.angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const pivotX = slot.x + cardWidth / 2;
  const pivotY = slot.y + cardHeight;
  const topEdge = -cardHeight; // the outer (readable) edge
  const bottomEdge = -cardHeight * (1 - topFraction); // topFraction<1 keeps only the top strip
  const offsets: Array<[number, number]> = [
    [-cardWidth / 2, bottomEdge],
    [cardWidth / 2, bottomEdge],
    [-cardWidth / 2, topEdge],
    [cardWidth / 2, topEdge],
  ];
  return offsets.map(([ox, oy]) => ({ x: pivotX + ox * cos - oy * sin, y: pivotY + ox * sin + oy * cos }));
}

describe('wheelLayout — the readable strip never clips, spacing stays even (G2)', () => {
  for (const containerWidth of CONTAINER_WIDTHS) {
    for (const count of HAND_SIZES) {
      it(`n=${count} @ ${containerWidth}px: no left/right/top clip, readable strip inside, even spacing, one size`, () => {
        const { cardWidth, cardHeight, height, slots } = wheelLayout(count, containerWidth);
        expect(slots).toHaveLength(count);

        // ONE card size at every count (it depends only on the container width).
        expect(cardWidth).toBe(wheelLayout(1, containerWidth).cardWidth);

        for (const slot of slots) {
          // whole card: no left / right / top clip (lower portions MAY exit the bottom by design).
          for (const corner of rotatedCorners(slot, cardWidth, cardHeight)) {
            expect(corner.x).toBeGreaterThanOrEqual(-EPS);
            expect(corner.x).toBeLessThanOrEqual(containerWidth + EPS);
            expect(corner.y).toBeGreaterThanOrEqual(-EPS); // never above the top edge
          }
          // the outer readable strip (top ~28%) is fully inside the band — including its bottom.
          for (const corner of rotatedCorners(slot, cardWidth, cardHeight, READABLE_STRIP)) {
            expect(corner.x).toBeGreaterThanOrEqual(-EPS);
            expect(corner.x).toBeLessThanOrEqual(containerWidth + EPS);
            expect(corner.y).toBeGreaterThanOrEqual(-EPS);
            expect(corner.y).toBeLessThanOrEqual(height + EPS);
          }
        }

        // even angular spacing: consecutive angle gaps are all equal.
        if (count >= 3) {
          const gaps = slots.slice(1).map((slot, index) => slot.angleDeg - slots[index]!.angleDeg);
          for (const gap of gaps) {
            expect(gap).toBeCloseTo(gaps[0]!, 5);
          }
        }
      });
    }
  }

  it('a lone card sits centred and upright (n=1)', () => {
    const { slots, hub, cardWidth } = wheelLayout(1, 346);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.angleDeg).toBe(0);
    expect(slots[0]!.x + cardWidth / 2).toBeCloseTo(hub.x, 5); // centred on the hub x
  });

  it('the arc is symmetric about vertical (extreme angles mirror)', () => {
    const { slots } = wheelLayout(9, 346);
    expect(slots[0]!.angleDeg).toBeCloseTo(-slots[slots.length - 1]!.angleDeg, 5);
    expect(slots[(slots.length - 1) / 2]!.angleDeg).toBeCloseTo(0, 5); // the middle card is upright
  });

  it('the scrub anchor increases monotonically left → right (so cardAtX is well-ordered)', () => {
    const { slots } = wheelLayout(12, 346);
    for (let index = 1; index < slots.length; index++) {
      expect(slots[index]!.anchorX).toBeGreaterThan(slots[index - 1]!.anchorX);
    }
  });

  it('the arc widens with the hand size, then caps at the max span', () => {
    const spanOf = (n: number) => {
      const { slots } = wheelLayout(n, 346);
      return slots[slots.length - 1]!.angleDeg - slots[0]!.angleDeg;
    };
    expect(spanOf(3)).toBeGreaterThan(spanOf(2)); // more cards → wider arc
    expect(spanOf(6)).toBeGreaterThan(spanOf(3));
    expect(spanOf(12)).toBeLessThanOrEqual(120 + 1e-6); // never past the near-semicircle cap
  });

  it('is deterministic — same inputs reproduce the same layout', () => {
    expect(wheelLayout(7, 346)).toEqual(wheelLayout(7, 346));
  });

  // H2b (excellence pass): the turn control (End turn / SAUDA!) must occupy ONE fixed slot that
  // overlaps NO wheel card at any hand size. Pass 2 floated End turn in the wheel band's bottom-right
  // corner; these prove that corner is NOT free — the splayed readable tops of the outer cards run
  // through it for many n — so the control was relocated to the my-area header, a band the wheel
  // never reaches (DECISIONS.md). The slot is the measured End-turn button (~84×44 floated / ~72×26
  // compact in the header).
  function bboxOf(corners: Array<{ x: number; y: number }>) {
    return { x0: Math.min(...corners.map((c) => c.x)), x1: Math.max(...corners.map((c) => c.x)), y0: Math.min(...corners.map((c) => c.y)), y1: Math.max(...corners.map((c) => c.y)) };
  }
  function overlaps(a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }) {
    return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  }
  function anyCardInSlot(count: number, containerWidth: number, slot: { x0: number; x1: number; y0: number; y1: number }) {
    const { cardWidth, cardHeight, slots } = wheelLayout(count, containerWidth);
    return slots.some((slot2) => overlaps(bboxOf(rotatedCorners(slot2, cardWidth, cardHeight)), slot));
  }

  describe('H2b — the End-turn slot never overlaps a wheel card', () => {
    it('the OLD in-band bottom-right corner slot DOES overlap a card at some n (why it moved)', () => {
      const clashes: string[] = [];
      for (const containerWidth of CONTAINER_WIDTHS) {
        for (const count of HAND_SIZES) {
          const { height } = wheelLayout(count, containerWidth);
          // pass-2 placement: an ~84×44 button at right:4, bottom:8 of the wheel band.
          const slot = { x0: containerWidth - 4 - 84, x1: containerWidth - 4, y0: height - 8 - 44, y1: height - 8 };
          if (anyCardInSlot(count, containerWidth, slot)) clashes.push(`${containerWidth}px/n=${count}`);
        }
      }
      // The corner is demonstrably NOT reserved — a control there sits over the cards. Documented so
      // no future pass re-floats a turn control into the wheel band.
      expect(clashes.length).toBeGreaterThan(0);
    });

    it('the header slot (above the band) overlaps NO wheel card at any n @ {346,436} (the fix)', () => {
      for (const containerWidth of CONTAINER_WIDTHS) {
        for (const count of HAND_SIZES) {
          // the compact End-turn button lives in the my-area header, a full row ABOVE the wheel band
          // (y < 0 in band coordinates). No card's rotated box may reach it.
          const slot = { x0: containerWidth - 4 - 72, x1: containerWidth - 4, y0: -30, y1: -4 };
          expect(anyCardInSlot(count, containerWidth, slot)).toBe(false);
        }
      }
    });
  });

  it('uses one size per container but a larger card on a wider frame', () => {
    expect(wheelLayout(5, 436).cardWidth).toBeGreaterThan(wheelLayout(5, 346).cardWidth);
  });
});
