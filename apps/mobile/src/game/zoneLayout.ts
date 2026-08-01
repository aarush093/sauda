/**
 * Zone layout v2 (P1 — owner phone test 1 Aug). The old table used PURE PERCENTAGES (21/9/28/42),
 * which on a real phone left a big dead void in the middle: the centre stage held a fixed 28% of the
 * screen whether or not anything was playing, and the board sat in a fixed-size box with felt margins
 * around it. This module replaces percentages with a CLAMPED-FLEX law that is pure and unit-tested,
 * so the layout is provable without a browser and the HUD/capture numbers match it exactly.
 *
 * The law, in one sentence: the table band is fixed; the opponent row, the centre stage and my area
 * each have a sensible min/max in px; every zone starts at its MIN, then surplus height flows to MY
 * AREA first (the thumb zone, the largest by hierarchy law A2), then the opponent boards, then the
 * stage — so an idle stage COLLAPSES toward its content and the void is gone. When height is scarce
 * we shrink in the reverse order (stage, then opponents), protecting my area last so a legal move is
 * never unreachable on the tightest screen (360x740).
 */

// Every zone dimension in px. The owner tunes the game's vertical rhythm HERE, one place.
export const ZONE_LIMITS = {
  opponentsMin: 84, // one line of opponent pills + a shallow card cascade
  opponentsMax: 150, // three opponents fully legible; more height wastes space up top
  tableBand: 52, // draw pile · turn chip · discard — a fixed slim strip
  stageMin: 110, // idle: the 2-line ticker + a small play hint — collapsed, no void
  stageMax: 210, // a played card's spotlight sits large here; beyond this it just floats
  myAreaMin: 300, // the thumb zone floor: hand wheel + groups + bank must stay generous
  myAreaMax: 480, // past this my area is comfortable; extra height should widen the stage instead
  // Hard floors used only when the screen is too short to grant every min — we dip BELOW the soft
  // mins here (stage first, opponents next) but never touch my area, so drops stay thumb-reachable.
  stageHardMin: 84,
  opponentsHardMin: 62,
} as const;

export interface ZoneHeights {
  opponents: number;
  table: number;
  stage: number;
  myArea: number;
}

// Grow `value` toward `cap` using up to `budget` of surplus; returns the new value and the surplus
// left over. A plain, readable helper so the distribution below reads as prose, not arithmetic.
function grow(value: number, cap: number, budget: number): { value: number; left: number } {
  const room = Math.max(0, cap - value);
  const used = Math.min(room, budget);
  return { value: value + used, left: budget - used };
}

// Shrink `value` toward `hardMin` to cover up to `deficit` px; returns the new value and the deficit
// still uncovered (passed on to the next zone to give up).
function shrink(value: number, hardMin: number, deficit: number): { value: number; left: number } {
  const room = Math.max(0, value - hardMin);
  const given = Math.min(room, deficit);
  return { value: value - given, left: deficit - given };
}

/**
 * Resolve the four zone heights for a given available content height (the shell height AFTER the
 * safe-area padding — the caller measures the real box, so dvh and notches are already accounted for).
 */
export function resolveZones(availablePx: number, limits = ZONE_LIMITS): ZoneHeights {
  const table: number = limits.tableBand; // fixed
  let opponents: number = limits.opponentsMin;
  let stage: number = limits.stageMin;
  let myArea: number = limits.myAreaMin;

  const floorSum = table + opponents + stage + myArea;

  if (availablePx >= floorSum) {
    // Surplus → my area first, then opponents, then the stage; any remainder stays on my area
    // (the hierarchy anchor, A2), so we always fill the screen exactly with no void.
    let surplus = availablePx - floorSum;
    ({ value: myArea, left: surplus } = grow(myArea, limits.myAreaMax, surplus));
    ({ value: opponents, left: surplus } = grow(opponents, limits.opponentsMax, surplus));
    ({ value: stage, left: surplus } = grow(stage, limits.stageMax, surplus));
    myArea += surplus; // whatever is left goes to my area, uncapped
    return { opponents, table, stage, myArea };
  }

  // Height-starved: dip below the soft mins — stage first, then opponents — but never my area, so a
  // drop target is always thumb-reachable. If it is STILL short, my area gives up the rest last.
  let deficit = floorSum - availablePx;
  ({ value: stage, left: deficit } = shrink(stage, limits.stageHardMin, deficit));
  ({ value: opponents, left: deficit } = shrink(opponents, limits.opponentsHardMin, deficit));
  myArea -= deficit; // last resort — only on an implausibly short viewport
  return { opponents, table, stage, myArea };
}
