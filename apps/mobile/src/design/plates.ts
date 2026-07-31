/// <reference types="vite/client" />
/**
 * Art-plate lookup (M4 §4.5). Plates are static raster paintings dropped into
 * src/assets/plates/{cardId}.webp by the owner's external workflow. This uses
 * Vite's import.meta.glob so that whenever a plate file appears it is picked up
 * with ZERO code changes — until then, CardFace renders the SVG fallback plate.
 */
import { chooseVariantWidth } from './plateVariants';

const PLATES = import.meta.glob('../assets/plates/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// J2: the downscaled tiers built by scripts/build-plate-variants.mjs into
// assets/plates/variants/<width>/<stem>.webp. Same zero-config glob trick — drop the files in and
// they're picked up. Indexed by tier width → stem → url. Empty until the build step has run, in which
// case plateVariantUrl transparently falls back to the full-resolution source (so the app still runs).
const VARIANT_FILES = import.meta.glob('../assets/plates/variants/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const VARIANTS: Record<number, Record<string, string>> = {};
for (const [path, url] of Object.entries(VARIANT_FILES)) {
  const match = path.match(/variants\/(\d+)\/([^/]+)\.webp$/);
  if (!match) {
    continue;
  }
  const width = Number(match[1]);
  const stem = match[2]!;
  (VARIANTS[width] ??= {})[stem] = url;
}

// H4 (excellence pass): fetch EVERY plate once at game start so no card's first mid-game appearance
// triggers a network hitch — a later `<img src>` is then a cache hit. Idempotent; runs once.
//
// We deliberately do NOT force-`decode()` all 45 up front: the plates are 600×870, so a full decode
// of every plate is ~90 MB of RGBA (≈2 MB each) — a memory spike a budget Android WebView would just
// evict, defeating the point. Instead the byte preload kills the fetch hitch (the measured cost), and
// each face's `<img decoding="async">` decodes off the main thread on first display. If decode hitches
// ever show on-device, the fix is downscaled/responsive plate variants (M4c), not a 90 MB upfront
// decode. [DECISIONS.md H4]
let platesPreloaded = false;
const preloadedImages: unknown[] = []; // retained so an in-flight fetch isn't cancelled by GC
export function preloadPlates(): void {
  if (platesPreloaded || typeof Image === 'undefined') {
    return;
  }
  platesPreloaded = true;
  // Warm the VARIANTS first (the board shows these on almost every card, so their fetch hitch is the
  // one that would actually show), then the full-resolution sources (stage / tap-to-inspect). Both go
  // into the encoded cache; decode still happens per-display, so this doesn't inflate decoded memory.
  const urls = [...Object.values(VARIANT_FILES), ...Object.values(PLATES)];
  for (const url of urls) {
    const image = new Image();
    image.src = url; // browser fetches + caches; a later <img src> is a cache hit, no network
    preloadedImages.push(image); // KEEP the reference — a GC'd Image cancels its own fetch mid-flight
  }
}

export function plateCount(): number {
  return Object.keys(PLATES).length;
}

export function plateUrl(cardId: string): string | null {
  for (const [path, url] of Object.entries(PLATES)) {
    if (path.endsWith(`/${cardId}.webp`)) {
      return url;
    }
  }
  return null;
}

export function hasPlate(cardId: string): boolean {
  return plateUrl(cardId) !== null;
}

// J2: the URL for a plate at a given ON-SCREEN rendered width (the hint ScaledCard/HandWheel pass
// down). Picks the smallest built tier covering rendered-width × DPR; if that tier or its file is
// missing (variants not built yet), it falls back to the full-resolution source — so nothing ever
// breaks, it just uses more decode memory until the build step runs. A null renderedWidth (full-size
// face) always resolves to the source plate.
export function plateVariantUrl(stem: string, renderedWidth: number | null, dpr: number): string | null {
  const tier = chooseVariantWidth(renderedWidth, dpr, Object.keys(VARIANTS).map(Number));
  if (tier !== null) {
    const url = VARIANTS[tier]?.[stem];
    if (url) {
      return url;
    }
  }
  return plateUrl(stem); // full-resolution source (or null → SVG fallback plate)
}

// The vintage card-BACK image (shown for face-down cards: draw pile, opponent hands,
// pass-and-play handoff). It lives in the same plates/ folder so the glob picks it up
// with zero config, but it is NOT a card face — no card id maps to it.
export function cardBackUrl(): string | null {
  return plateUrl('card_back');
}

// J2: the card back at a given rendered width. The back renders through its own component (CardBack),
// not CardFace, so it needs its own variant call — otherwise a 38 px draw-pile back would keep pinning
// the full 600 px bitmap (measured: ~2 MB, a third of the post-variant board memory). Same tier logic.
export function cardBackVariantUrl(renderedWidth: number): string | null {
  const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  return plateVariantUrl('card_back', renderedWidth, dpr);
}
