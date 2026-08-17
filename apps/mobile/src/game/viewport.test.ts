import { describe, it, expect } from 'vitest';
import { contentBox, fitToBox, MIN_PLAYABLE_BOX } from './viewport';
import type { ViewportBox } from './viewport';
import { resolveMyTurn, resolveSpectate, LANDSCAPE } from './landscapeLayout';
import { DEVICE_PROFILES, usableHeight } from '../dev/deviceProfiles';

// U1 (the iPhone 12 cut-off). The whole point of the measured-box system is a single promise: whatever
// space actually exists at that instant, the board fits inside it and NOTHING is placed outside the
// measured box — the hand is never clipped off the bottom, there is never a page scroll. These tests
// prove that promise on pure geometry, no browser needed: fitToBox never overflows the box and always
// stays legible (>= the min box), and the landscape zone maths, run on the fitted layout box and scaled
// back down, always land every element inside the measured content box — even on short, chrome-reduced
// screens well below the min playable box.

const EPS = 1e-6;

// Build a ViewportBox from a device profile: the visible height is the height AFTER browser chrome (what
// visualViewport reports on a real iOS Safari), and the insets are the profile's safe area.
function boxFromProfile(profile: (typeof DEVICE_PROFILES)[number]): ViewportBox {
  const safe = profile.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    width: profile.width,
    height: usableHeight(profile),
    offsetTop: 0,
    scale: 1,
    insetTop: safe.top,
    insetRight: safe.right,
    insetBottom: safe.bottom,
    insetLeft: safe.left,
  };
}

// Every element the MY-TURN layout places, once scaled, must sit inside the measured content box.
function myTurnFitsInside(contentWidth: number, contentHeight: number): boolean {
  const fit = fitToBox(contentWidth, contentHeight);
  const zones = resolveMyTurn(fit.layoutWidth, fit.layoutHeight);
  // Rows: the top row and the wheel band tile the layout height exactly (no void, no overflow).
  const rowsExact = Math.abs(zones.topRow + zones.wheelBand - fit.layoutHeight) < EPS;
  // Columns: rail + two side columns + centre + the three gutters never exceed the layout width.
  const columnsWidth = zones.rail + zones.leftCol + zones.centre + zones.rightCol + LANDSCAPE.gap * 3;
  const columnsFit = columnsWidth <= fit.layoutWidth + EPS;
  const wheelFits = zones.wheelContainer <= fit.layoutWidth + EPS;
  // Scaled back down, the whole layout box lands inside the measured content box.
  const scaledFits =
    fit.layoutWidth * fit.scale <= contentWidth + EPS && fit.layoutHeight * fit.scale <= contentHeight + EPS;
  return rowsExact && columnsFit && wheelFits && scaledFits && zones.topRow >= 0 && zones.wheelBand > 0;
}

// Every element the SPECTATE layout places, once scaled, must sit inside the measured content box.
function spectateFitsInside(contentWidth: number, contentHeight: number): boolean {
  const fit = fitToBox(contentWidth, contentHeight);
  const zones = resolveSpectate(fit.layoutWidth, fit.layoutHeight);
  const columnsWidth = zones.rail + LANDSCAPE.gap + zones.acting + zones.mine;
  const columnsFit = columnsWidth <= fit.layoutWidth + EPS;
  const scaledFits =
    fit.layoutWidth * fit.scale <= contentWidth + EPS && fit.layoutHeight * fit.scale <= contentHeight + EPS;
  return columnsFit && scaledFits && zones.acting > 0 && zones.mine >= 0;
}

describe('fitToBox (U1 measured-box fit)', () => {
  it('at or above the min box, lays out 1:1 (scale 1, layout === content)', () => {
    for (const [w, h] of [
      [MIN_PLAYABLE_BOX.width, MIN_PLAYABLE_BOX.height],
      [740, 360],
      [915, 412],
      [750, 325], // iPhone 12 content box (844 - 47*2 wide, 390 - 44 chrome - 21 bottom tall)
      [667, 331], // iPhone SE content box (667 wide, 375 - 44 chrome tall)
    ]) {
      const fit = fitToBox(w!, h!);
      expect(fit.scale).toBe(1);
      expect(fit.layoutWidth).toBe(w);
      expect(fit.layoutHeight).toBe(h);
    }
  });

  it('below the min box, scales the WHOLE board down to fit — never clips', () => {
    // A range of genuinely small / short / chrome-reduced boxes.
    for (const [w, h] of [
      [560, 300],
      [600, 260],
      [520, 240],
      [667, 250], // SE-height with extra chrome eaten
      [480, 220],
      [400, 300],
    ]) {
      const fit = fitToBox(w!, h!);
      expect(fit.scale).toBeGreaterThan(0);
      expect(fit.scale).toBeLessThan(1); // it had to shrink
      // The layout box stays at least the min box in BOTH dimensions, so it never lays out cramped.
      expect(fit.layoutWidth).toBeGreaterThanOrEqual(MIN_PLAYABLE_BOX.width - EPS);
      expect(fit.layoutHeight).toBeGreaterThanOrEqual(MIN_PLAYABLE_BOX.height - EPS);
      // Scaled back down, it lands EXACTLY on (never outside) the measured box.
      expect(fit.layoutWidth * fit.scale).toBeLessThanOrEqual(w! + EPS);
      expect(fit.layoutHeight * fit.scale).toBeLessThanOrEqual(h! + EPS);
    }
  });

  it('never scales the board UP past 1 on a large box', () => {
    expect(fitToBox(2000, 1200).scale).toBe(1);
  });

  it('contentBox carves the safe-area insets off every edge (side notch in landscape)', () => {
    const box: ViewportBox = {
      width: 844,
      height: 346,
      offsetTop: 0,
      scale: 1,
      insetTop: 0,
      insetRight: 47,
      insetBottom: 21,
      insetLeft: 47,
    };
    const content = contentBox(box);
    expect(content.width).toBe(844 - 47 - 47); // the landscape notch is on the SIDES
    expect(content.height).toBe(346 - 21);
  });
});

describe('layout never places an element outside the measured box (U1 invariant)', () => {
  it('holds for every device profile — including the iOS ones with chrome + side insets', () => {
    for (const profile of DEVICE_PROFILES) {
      const content = contentBox(boxFromProfile(profile));
      expect(myTurnFitsInside(content.width, content.height), `${profile.id} my-turn`).toBe(true);
      expect(spectateFitsInside(content.width, content.height), `${profile.id} spectate`).toBe(true);
    }
  });

  it('holds across a dense sweep of boxes — wide, narrow, and short chrome-reduced', () => {
    // Widths and heights spanning generous phones down to boxes well below the min playable box, so the
    // scale-down path is exercised hard. The invariant must hold at every single one.
    for (let width = 360; width <= 960; width += 20) {
      for (let height = 200; height <= 440; height += 20) {
        expect(myTurnFitsInside(width, height), `my-turn ${width}x${height}`).toBe(true);
        expect(spectateFitsInside(width, height), `spectate ${width}x${height}`).toBe(true);
      }
    }
  });
});
