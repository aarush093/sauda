/**
 * Pure geometry for the hand WHEEL (G2, owner playtest 2). The hand renders as a half roulette
 * wheel: every card sits on an arc around a hub at the bottom-centre of the frame, each rotated
 * RADIALLY so its long axis points at the hub (the roulette-spoke look). ONE geometric system, ONE
 * card size at every count — no per-card special cases, no width-stepping tables.
 *
 * Even spacing always: card i sits at angle theta_i = -SPAN/2 + SPAN·i/(n-1) (theta = 0 when
 * n = 1), with SPAN = min(SPAN_MAX, (n-1)·COMFORT_STEP) — a few cards sit comfortably near
 * top-centre; more cards widen the arc toward the semicircle.
 *
 * The one hard invariant: the outer readable strip (banner + value badge, the top ~28%) of EVERY
 * card stays fully inside the frame. Lower portions converge toward the hub and may run beneath the
 * bottom edge BY DESIGN (the hand emerging from the bottom of the screen). Left / right / top
 * clipping is FORBIDDEN at every count. The radius is derived so the widest arc's extreme card fits
 * horizontally, so the invariant holds by construction — proven in wheelLayout.test.ts.
 *
 * DOM-free and deterministic. The component (HandWheel) only measures its slot and renders these.
 */
import { CARD } from '../design/tokens';

const SPAN_MAX_DEG = 120; // the widest arc — many cards approach this near-semicircle spread
const COMFORT_STEP_DEG = 12; // each extra card widens the arc by this, until SPAN_MAX
const SIDE_PAD_PX = 8; // clear space kept at the top and side frame edges
export const READABLE_STRIP = 0.28; // the top fraction (banner + value badge) that must stay visible
// H3 (excellence pass): the wheel band is capped by the my-area vertical budget (~144px at 360×740,
// the on-board group cascades taking the rest). A SHALLOWER hub makes the band shorter for a given
// card, which buys a wider card in the same budget — lifting the rendered banner text off the 9-px
// floor (measured 9.0→9.4 device px at DPR 2). 0.34 keeps a clear roulette convergence; the width
// fraction 0.21 is the largest that still passes the no-clip invariant at both board widths.
const HUB_RADIUS_RATIO = 0.34; // hub → card-bottom distance as a fraction of card height (the overlap)
const CARD_WIDTH_FRACTION = 0.21; // one card width = this fraction of the container width (clamped)
const MIN_CARD_WIDTH_PX = 58;
const MAX_CARD_WIDTH_PX = 78;

export interface WheelSlot {
  x: number; // LEFT of the card's unrotated box (px within the container)
  y: number; // TOP of the card's unrotated box (px)
  angleDeg: number; // radial spoke rotation (+ leans right), applied about the card's bottom-centre
  z: number; // stacking order — later cards sit on top, like a dealt hand
  anchorX: number; // x of the card's readable-strip centre — what the scrub gesture aims at
}

export interface WheelLayout {
  cardWidth: number; // ONE width at every count (depends only on the container width)
  cardHeight: number;
  height: number; // the band height the slots assume; the hub sits at the bottom edge
  hub: { x: number; y: number };
  slots: WheelSlot[];
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function wheelLayout(count: number, containerWidth: number): WheelLayout {
  // ONE card size at every count — it depends only on the container width, never on the hand size.
  const cardWidth = clamp(Math.round(containerWidth * CARD_WIDTH_FRACTION), MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX);
  const cardHeight = Math.round(cardWidth * CARD.ratio);
  const hubRadius = Math.round(cardHeight * HUB_RADIUS_RATIO); // hub → each card's bottom-centre
  const outerRadius = hubRadius + cardHeight; // hub → each card's top (the readable end)
  const cx = containerWidth / 2;
  const cy = outerRadius + SIDE_PAD_PX; // hub Y, chosen so the centre card's top lands at SIDE_PAD
  const height = cy; // the band bottom is the hub; the my-area clips anything the hub pushes below

  const span = count <= 1 ? 0 : Math.min(SPAN_MAX_DEG, (count - 1) * COMFORT_STEP_DEG);
  const slots: WheelSlot[] = [];
  for (let index = 0; index < count; index++) {
    const angleDeg = count <= 1 ? 0 : -span / 2 + (span * index) / (count - 1);
    const theta = (angleDeg * Math.PI) / 180;
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    // The card's bottom-centre sits on the hub circle; CSS rotates the card about that same
    // bottom-centre (transform-origin: 50% 100%), so the anchor stays on the circle as it spokes.
    const bottomCentreX = cx + hubRadius * sin;
    const bottomCentreY = cy - hubRadius * cos;
    slots.push({
      x: bottomCentreX - cardWidth / 2,
      y: bottomCentreY - cardHeight,
      angleDeg,
      z: index,
      anchorX: cx + outerRadius * sin, // = the rotated top-centre x; monotonic in i for the scrub
    });
  }
  return { cardWidth, cardHeight, height, hub: { x: cx, y: cy }, slots };
}
