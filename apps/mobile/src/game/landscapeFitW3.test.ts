import { describe, it, expect } from 'vitest';
import { contentBox, fitToBox } from './viewport';
import type { ViewportBox } from './viewport';
import { resolveMyTurn, resolveSpectate, LANDSCAPE } from './landscapeLayout';
import { spreadCardWidth, spreadLayout } from './spreadLayout';
import { DEVICE_PROFILES, usableHeight, profileById } from '../dev/deviceProfiles';
import type { DeviceProfile } from '../dev/deviceProfiles';

// W3 (first-player pass) — re-verify the measured-box landscape fit AFTER W1 removed the portrait
// fallback. W1 made the board's landscape path lay out at the full measured box (no portrait branch),
// so this locks the two owner iPhone profiles at 1:1 and adds the one check the U1 suite never made:
// the hand CARD (a real upright card, cardHeight = cardWidth × 1.45) fits INSIDE its wheel band, so an
// 11-card hand is never clipped at the bottom — the exact failure mode the owner rejected in portrait.

const EPS = 1e-6;
const MAX_HAND = 11; // the hand-limit-plus-a-draw worst case the owner's evidence viewports must survive

function boxFromProfile(profile: DeviceProfile): ViewportBox {
  const safe = profile.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    width: profile.width,
    height: usableHeight(profile), // height AFTER browser chrome — what iOS Safari's visualViewport reports
    offsetTop: 0,
    scale: 1,
    insetTop: safe.top,
    insetRight: safe.right,
    insetBottom: safe.bottom,
    insetLeft: safe.left,
  };
}

// The full zone-height table for one content box — the numbers the W3 report pastes.
function zoneTable(contentWidth: number, contentHeight: number) {
  const fit = fitToBox(contentWidth, contentHeight);
  const my = resolveMyTurn(fit.layoutWidth, fit.layoutHeight);
  const spectate = resolveSpectate(fit.layoutWidth, fit.layoutHeight);
  const cardWidth = spreadCardWidth(my.wheelContainer);
  const spread = spreadLayout(MAX_HAND, my.wheelContainer, cardWidth);
  return { fit, my, spectate, cardWidth, cardHeight: spread.height, spread };
}

describe('W3 — landscape fit at the owner iPhone profiles (with chrome + insets)', () => {
  for (const id of ['iphone12-844x390', 'iphonese-667x375']) {
    const profile = profileById(id)!;
    it(`${profile.label}: lays out 1:1, tiles exactly, and the 11-card hand never clips`, () => {
      const content = contentBox(boxFromProfile(profile));
      const t = zoneTable(content.width, content.height);

      // A real device is above the min playable box, so the board lays out 1:1 — no shrink, no letterbox.
      expect(t.fit.scale).toBe(1);
      expect(t.fit.layoutWidth).toBe(content.width);
      expect(t.fit.layoutHeight).toBe(content.height);

      // Rows tile the height EXACTLY: no page scroll (sum > box) and no empty dead zone (sum < box).
      expect(Math.abs(t.my.topRow + t.my.wheelBand - content.height)).toBeLessThan(EPS);
      expect(t.my.topRow).toBeGreaterThan(0);

      // Columns (rail + two side columns + centre + three gutters) fit the width — nothing clipped right.
      const columns = t.my.rail + t.my.leftCol + t.my.centre + t.my.rightCol + LANDSCAPE.gap * 3;
      expect(columns).toBeLessThanOrEqual(content.width + EPS);

      // THE W3 CHECK: the real upright hand card fits inside the wheel band — the hand is not clipped
      // off the bottom (the owner's portrait failure). cardHeight = cardWidth × 1.45.
      expect(t.cardHeight).toBeLessThanOrEqual(t.my.wheelBand + EPS);

      // The whole 11-card spread fits the wheel container width, centred, with a readable strip on each.
      const totalWidth = t.cardWidth + t.spread.step * (MAX_HAND - 1);
      expect(totalWidth).toBeLessThanOrEqual(t.my.wheelContainer + EPS);
      expect(t.spread.step).toBeGreaterThanOrEqual(t.spread.readableStripPx - EPS);

      // Spectate (a bot's turn) also tiles the width — rail + gutter + acting + mine == the box.
      const spectateWidth = t.spectate.rail + LANDSCAPE.gap + t.spectate.acting + t.spectate.mine;
      expect(spectateWidth).toBeLessThanOrEqual(content.width + EPS);
      expect(t.spectate.acting).toBeGreaterThan(0);
      expect(t.spectate.mine).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('W3 — the hand card fits its wheel band on EVERY landscape profile', () => {
  it('holds for all profiles (an 11-card hand is never clipped vertically)', () => {
    for (const profile of DEVICE_PROFILES) {
      const content = contentBox(boxFromProfile(profile));
      const t = zoneTable(content.width, content.height);
      const layoutBand = t.my.wheelBand; // in LAYOUT px (the card is measured in the same space)
      expect(t.cardHeight, `${profile.id} card ${t.cardHeight} > band ${layoutBand}`).toBeLessThanOrEqual(
        layoutBand + EPS,
      );
    }
  });
});
