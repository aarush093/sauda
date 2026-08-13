/**
 * J2 (M4b close-out): plate VARIANT selection. The 45 source plates are 600×870 — decoding one
 * costs ~2 MB of RGBA, so a late-game board full of small cards pinned ~52 MB of decoded bitmaps
 * (measured), most of it for cards drawn 14–38 px wide. A build step (scripts/build-plate-variants.mjs)
 * derives downscaled webp tiers; this module picks WHICH tier a given on-screen size needs.
 *
 * The faces are drawn at 132 px then transform-scaled, so `srcset`/`sizes` can't respond (the browser
 * only sees the 132-px `<img>` box, not the outer transform). Selection is therefore an EXPLICIT hint:
 * ScaledCard/HandSpread know the real rendered width and pass it down; we pick the smallest tier whose
 * pixel width still covers rendered-width × devicePixelRatio. This file is pure (no Vite glob) so the
 * selection maths is unit-testable on its own; plates.ts wires it to the actual built files.
 */

// The built tier widths, in source pixels. Chosen from the measured rendered widths on the board:
//   • 14–38 px cards (opponent strips, my board cascades) → need ≤ 114 px @ DPR3 → the 160 tier.
//   • ~69–92 px cards (hand wheel, TableView) → need ≤ 276 px @ DPR3 → the 320 tier.
//   • ~112 px stage + tap-to-inspect → fall through to the full-resolution source (600).
// Two tiers keep the pipeline (and the story) small while covering every scaled surface.
export const PLATE_VARIANT_WIDTHS = [160, 320] as const;

// Pick the smallest variant width that still covers the pixels this face occupies on screen
// (renderedWidth CSS px × the device pixel ratio). Returns null when no hint is given (a full-size
// face — inspect, stage-at-full, the dev routes) or when even the largest tier is too small; the
// caller then uses the full-resolution source plate. `dpr` is floored at 1 so a missing/odd value
// never picks a tier that's too small.
export function chooseVariantWidth(
  renderedWidth: number | null | undefined,
  dpr: number,
  variantWidths: readonly number[] = PLATE_VARIANT_WIDTHS,
): number | null {
  if (renderedWidth == null || renderedWidth <= 0) {
    return null; // no hint → full-resolution source
  }
  const neededPx = Math.ceil(renderedWidth * Math.max(1, dpr));
  const ascending = [...variantWidths].sort((a, b) => a - b);
  for (const width of ascending) {
    if (width >= neededPx) {
      return width; // smallest tier that fully covers the on-screen pixels
    }
  }
  return null; // nothing covers it → full-resolution source
}
