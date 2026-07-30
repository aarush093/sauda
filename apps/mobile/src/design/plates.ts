/// <reference types="vite/client" />
/**
 * Art-plate lookup (M4 §4.5). Plates are static raster paintings dropped into
 * src/assets/plates/{cardId}.webp by the owner's external workflow. This uses
 * Vite's import.meta.glob so that whenever a plate file appears it is picked up
 * with ZERO code changes — until then, CardFace renders the SVG fallback plate.
 */
const PLATES = import.meta.glob('../assets/plates/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

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
  for (const url of Object.values(PLATES)) {
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

// The vintage card-BACK image (shown for face-down cards: draw pile, opponent hands,
// pass-and-play handoff). It lives in the same plates/ folder so the glob picks it up
// with zero config, but it is NOT a card face — no card id maps to it.
export function cardBackUrl(): string | null {
  return plateUrl('card_back');
}
