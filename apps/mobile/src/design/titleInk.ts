/**
 * Title legibility for the Deed Card (M4 §3).
 *
 * The property title is drawn by the live layer directly on the plate's top
 * banner — and that banner is painted in the set's colour. Dark banners
 * (Purani Dilli brown, Mumbai navy, Kolkata royal violet…) need a CREAM title
 * with a thin dark keyline; bright banners (Chennai chrome yellow, Bangalore
 * azure, Kashi kesari saffron…) read better with the dark letterpress ink. So we
 * choose the ink PER PLATE by WCAG contrast against the banner colour — the title
 * always reads, and we never need a plaque behind it.
 *
 * The banner colour is normally the set colour. A few early plates were painted
 * with a different banner colour; those are listed in BANNER_HEX_OVERRIDES so the
 * set colour doesn't mis-predict their contrast.
 */
import { SETS } from '@sauda/engine';
import type { SetId } from '@sauda/engine';
import { INK } from './tokens';

// Muted brown used for the locality sublabel when the title is dark ink (matches
// the existing card-face sublabel colour).
const SUBLABEL_MUTED = '#5b5344';

// Plates whose printed banner colour differs from their set colour, keyed by plate
// id. Only exceptions would live here; everything else uses the set colour.
//
// EMPTY — every property plate now carries its locked set-colour banner (M4a art
// complete). The last three gold-band early editions (mumbai_0, jaipur_0, jaipur_1)
// were regenerated to solid navy/magenta banners, so their pins were removed. Kept
// as the extension point should any future plate ever be painted off-convention.
const BANNER_HEX_OVERRIDES: Record<string, string> = {};

export interface TitleInk {
  name: string; // colour for the property name
  sub: string; // colour for the locality sublabel
  keyline: boolean; // draw a thin dark halo so cream text lifts off the banner
}

// WCAG relative luminance of an sRGB #rrggbb colour (0 = black, 1 = white).
function relativeLuminance(hex: string): number {
  const linear = (eightBit: number): number => {
    const channel = eightBit / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

// WCAG contrast ratio between two #rrggbb colours (1 = identical … 21 = black/white).
function contrastRatio(hexA: string, hexB: string): number {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (lighter + 0.05) / (darker + 0.05);
}

// The core contrast pick: choose the ink family that reads best on a banner colour.
// Shared by property titles and the action-card label, so the rule lives in one place.
export function inkForBanner(bannerHex: string): TitleInk {
  const creamReadsBetter =
    contrastRatio(INK.cardCream, bannerHex) >= contrastRatio(INK.deepInk, bannerHex);
  if (creamReadsBetter) {
    return { name: INK.cardCream, sub: INK.gold, keyline: true };
  }
  return { name: INK.deepInk, sub: SUBLABEL_MUTED, keyline: false };
}

// Pick the title inks for a property plate so its name always reads on the banner.
export function titleInkForPlate(plateId: string, set: SetId): TitleInk {
  const bannerHex = BANNER_HEX_OVERRIDES[plateId] ?? SETS[set].hex;
  return inkForBanner(bannerHex);
}

// Action cards (§5) share one flat DEEP-CRIMSON banner; the "ACTION" label is drawn
// on it and picks its ink by the same contrast rule (cream + keyline on crimson).
// The SVG fallback leaves the banner area cream, where the original red stamp reads.
export const ACTION_BANNER_HEX = '#8C1D1D';

// Empty now that kabza uses the crimson banner; retained for any future action plate
// painted off the crimson spec (mirrors BANNER_HEX_OVERRIDES for properties).
const ACTION_BANNER_OVERRIDES: Record<string, string> = {};

// The banner colour behind an action card's "ACTION" label: crimson on a raster
// plate (or the pinned legacy colour), cream when only the SVG fallback is present.
export function actionBannerHex(plateId: string, hasRasterPlate: boolean): string {
  if (!hasRasterPlate) {
    return INK.cardCream;
  }
  return ACTION_BANNER_OVERRIDES[plateId] ?? ACTION_BANNER_HEX;
}
