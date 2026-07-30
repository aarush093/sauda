/**
 * Pure geometry for the hand fan (F1, owner playtest 30 Jul). Given the card count, the
 * container width, and the resting card width, it returns each card's placement so the fan
 * NEVER clips: every card's rotated bounding box stays inside the container with side padding,
 * rotation is capped shallow (|deg| <= 5 so the extremes never read jumbled), and every card
 * keeps a tappable exposed strip. When many cards can't fit at the resting width with that
 * exposure, the card width SHRINKS rather than letting anything spill past the frame — the one
 * hard invariant is "nothing clips, ever".
 *
 * DOM-free and deterministic, so it is unit-tested exhaustively (fanLayout.test.ts) instead of
 * eyeballed. The component (HandFan) only measures its slot and renders these slots.
 */
import { CARD } from '../design/tokens';

export interface FanSlot {
  x: number; // left offset within the container, px
  y: number; // top offset within the container, px (shallow arc — the ends dip down a touch)
  rotationDeg: number; // card tilt, always within [-MAX_ROTATION_DEG, MAX_ROTATION_DEG]
  z: number; // stacking order — later cards sit on top of earlier ones
}

export interface FanLayout {
  cardWidth: number; // the width every card is drawn at (< requested for a dense hand)
  slots: FanSlot[];
}

export const MAX_ROTATION_DEG = 5; // owner: cap the fan tilt so the extremes never read jumbled
const ROTATION_STEP_DEG = 1.6; // shallow per-card step; the extremes clamp to the cap
const SIDE_PADDING_PX = 8; // clear space kept at each frame edge
const MIN_EXPOSED_PX = 24; // each card must show at least this tappable strip
const MIN_CARD_WIDTH_PX = 40; // never shrink a card below this (it must stay legible)

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// The extra horizontal reach a card gains when rotated to the cap: its top corner swings out by
// about height * sin(angle). Reserving this (plus a rounding pixel) on BOTH extremes is what
// keeps a rotated card's bounding box inside the frame.
function rotationMargin(cardHeight: number): number {
  return Math.ceil(cardHeight * Math.sin((MAX_ROTATION_DEG * Math.PI) / 180)) + 2;
}

export function fanLayout(count: number, containerWidth: number, restCardWidth = 72): FanLayout {
  if (count <= 0) {
    return { cardWidth: restCardWidth, slots: [] };
  }
  if (count === 1) {
    // A lone card sits centred and upright.
    const width = Math.min(restCardWidth, containerWidth - 2 * SIDE_PADDING_PX);
    return { cardWidth: width, slots: [{ x: Math.round((containerWidth - width) / 2), y: 0, rotationDeg: 0, z: 0 }] };
  }

  // Shrink the card width until `count` cards fit with a >= MIN_EXPOSED strip inside the padded,
  // rotation-reserved width — or until we reach the legibility floor (then pack as tight as fits,
  // still never clipping). Each step recomputes: a narrower card also needs a smaller margin.
  let cardWidth = Math.min(restCardWidth, containerWidth - 2 * SIDE_PADDING_PX);
  let advance = 0;
  for (;;) {
    const cardHeight = Math.round(cardWidth * CARD.ratio);
    const usableWidth = containerWidth - 2 * SIDE_PADDING_PX - 2 * rotationMargin(cardHeight);
    const maxAdvance = Math.floor((usableWidth - cardWidth) / (count - 1));
    const preferredAdvance = Math.round(cardWidth * 0.6); // ~60% overlap at rest
    advance = Math.min(preferredAdvance, maxAdvance);
    if (advance >= MIN_EXPOSED_PX || cardWidth <= MIN_CARD_WIDTH_PX) {
      // Good exposure reached, or shrunk as far as we sensibly will. Keep the advance in a sane
      // band: at least 1px (never a perfect stack) and never wider than the card (no fan gaps).
      advance = clamp(advance, 1, cardWidth);
      break;
    }
    cardWidth -= 4;
  }

  const footprint = cardWidth + advance * (count - 1);
  const startX = Math.round((containerWidth - footprint) / 2);
  const mid = (count - 1) / 2;
  const slots: FanSlot[] = [];
  for (let index = 0; index < count; index++) {
    const rotationDeg = clamp((index - mid) * ROTATION_STEP_DEG, -MAX_ROTATION_DEG, MAX_ROTATION_DEG);
    const dip = Math.round(Math.abs(index - mid) * 1.2); // the ends sit slightly lower — a shallow arc
    slots.push({ x: startX + index * advance, y: dip, rotationDeg, z: index });
  }
  return { cardWidth, slots };
}
