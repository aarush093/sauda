/**
 * Pure geometry for the hand SPREAD (S1 — owner playtest, 13 Aug; supersedes the retired wheel). The
 * hand is a FLAT row of UPRIGHT cards: rotation is 0 for every card, always. Cards are bottom-anchored
 * and overlap evenly, later cards on top (a dealt hand). ONE card size at every count — it depends on
 * the container width, not the hand size (the owner's "reasonable size, understandable without
 * tapping").
 *
 * Even spacing always: the step between adjacent cards is `min(comfortable, (container − cardWidth) /
 * (n − 1))`. At low n the container clause is huge, so the step is the comfortable one and cards sit
 * nearly side-by-side; at high n the container clamps the step so all n fit, and cards overlap more.
 *
 * The one hard invariant: EVERY card keeps a readable exposed strip — the leftmost `step` px of each
 * card (banner + value badge) stays uncovered by its right-hand neighbour, and never falls below
 * READABLE_STRIP_PX. Left/right/top clipping is forbidden at every count: the row is centred and its
 * total width never exceeds the container, so it holds by construction (proven in spreadLayout.test.ts).
 *
 * DOM-free and deterministic. The component (HandSpread) only measures its slot and renders these.
 */
import { CARD } from '../design/tokens';

// Size-up (owner: "reasonable size, understandable without tapping"). The rest card is this fraction
// of the container width, clamped — so it actually USES the landscape width. At the 915 profile the
// spread container is 915 − rail(46) = 869 px, giving round(869 × 0.115) = 100 → clamped 96..100; at
// the 740 profile (container 694) it is ~80. The old wheel capped at 78 (measured ~69), so this is a
// real step up in legibility (see the device-px table in DECISIONS "S1").
const CARD_WIDTH_FRACTION = 0.115;
const MIN_CARD_WIDTH_PX = 68;
const MAX_CARD_WIDTH_PX = 100;

// The comfortable step at low n: 80% of a card width, so a small hand reads as a neat, barely
// overlapping row ("nearly side-by-side"), not a tight stack.
const COMFORT_STEP_FRACTION = 0.8;

// The minimum uncovered strip on each card's left edge — enough to show the value badge (top-left)
// and the start of the name banner. 32% of a card width; the wide landscape container keeps the
// actual step well above this even at n = 12, so the invariant has real margin.
export const READABLE_STRIP_FRACTION = 0.32;

export interface SpreadSlot {
  x: number; // LEFT of the (upright) card box, px within the container
  z: number; // stacking order — later cards sit on top, like a dealt hand
  anchorX: number; // centre-x of this card's exposed strip — what the scrub gesture aims at (monotonic)
}

export interface SpreadLayout {
  cardWidth: number; // ONE width at every count (depends only on the container width)
  cardHeight: number;
  height: number; // the band height the slots assume — the cards are upright, so exactly cardHeight
  step: number; // the even spacing between adjacent card left edges
  readableStripPx: number; // the minimum exposed strip the layout guarantees for this card size
  slots: SpreadSlot[];
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// The one rest card width for a given container — exported so the size-up formula is unit-testable
// and the component and tests agree on it.
export function spreadCardWidth(containerWidth: number): number {
  return clamp(Math.round(containerWidth * CARD_WIDTH_FRACTION), MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX);
}

export function spreadLayout(count: number, containerWidth: number, cardWidth: number): SpreadLayout {
  const cardHeight = Math.round(cardWidth * CARD.ratio);
  const readableStripPx = Math.round(cardWidth * READABLE_STRIP_FRACTION);
  const comfortStep = Math.round(cardWidth * COMFORT_STEP_FRACTION);

  // The step: comfortable when there is room, else squeezed so all n cards fit the container width.
  const step = count <= 1 ? 0 : Math.min(comfortStep, (containerWidth - cardWidth) / (count - 1));

  // Centre the whole row: its total footprint is one card plus (n−1) steps. When the step is squeezed
  // to the container clause the footprint equals the container exactly (startX 0); when comfortable it
  // is narrower and sits centred. Either way no card exits the left or right edge.
  const totalWidth = cardWidth + step * Math.max(0, count - 1);
  const startX = (containerWidth - totalWidth) / 2;

  const slots: SpreadSlot[] = [];
  for (let index = 0; index < count; index++) {
    const x = startX + index * step;
    // The exposed strip is the leftmost `step` px (the neighbour covers the rest); the last card is
    // fully visible. Aim the scrub at the middle of whatever strip shows — monotonic left→right.
    const exposed = index === count - 1 ? cardWidth : step;
    slots.push({ x, z: index, anchorX: x + exposed / 2 });
  }

  return { cardWidth, cardHeight, height: cardHeight, step, readableStripPx, slots };
}
