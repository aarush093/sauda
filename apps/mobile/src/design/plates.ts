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
