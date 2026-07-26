/**
 * Title legibility for the Deed Card (M4 §3).
 *
 * The property title is drawn by the live layer directly on the plate's top
 * banner — and that banner is painted in the set's colour. Dark banners
 * (Purani Dilli brown, Kashi teal, Mumbai navy…) need a CREAM title with a thin
 * dark keyline; bright banners (Kolkata orange, Bangalore amber, a gold band…)
 * read better with the dark letterpress ink. So we choose the ink PER PLATE by
 * WCAG contrast against the banner colour — the title always reads, and we never
 * need a plaque behind it.
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

// Plates whose printed banner colour differs from their set colour, keyed by
// plate id. Only exceptions live here; everything else uses the set colour.
// - prop_mumbai_0: the first Marine Drive plate has a light GOLD banner, not the
//   set's navy, so its title must stay dark. (Later Mumbai art uses navy.)
const BANNER_HEX_OVERRIDES: Record<string, string> = {
  prop_mumbai_0: INK.gold,
};

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

// Pick the title inks for a property plate so its name always reads on the banner.
export function titleInkForPlate(plateId: string, set: SetId): TitleInk {
  const bannerHex = BANNER_HEX_OVERRIDES[plateId] ?? SETS[set].hex;
  const creamReadsBetter =
    contrastRatio(INK.cardCream, bannerHex) >= contrastRatio(INK.deepInk, bannerHex);
  if (creamReadsBetter) {
    return { name: INK.cardCream, sub: INK.gold, keyline: true };
  }
  return { name: INK.deepInk, sub: SUBLABEL_MUTED, keyline: false };
}
