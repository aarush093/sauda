// @ts-check
/**
 * J2 (M4b close-out): build DOWNSCALED webp variants of every plate.
 *
 * The 45 source plates are 600×870. On the late-game board most cards are drawn 14–92 px wide, yet
 * each still decoded the full 600×870 bitmap — ~2 MB of RGBA apiece, ~52 MB total (measured). This
 * script derives smaller tiers so a small card can load a small file; the runtime (design/plates.ts +
 * CardFace) picks the tier that covers each card's on-screen pixels.
 *
 *   node apps/mobile/scripts/build-plate-variants.mjs      # regenerate all tiers
 *
 * Inputs  : apps/mobile/src/assets/plates/*.webp           (the owner's source plates — NEVER touched)
 * Outputs : apps/mobile/src/assets/plates/variants/<width>/<stem>.webp
 *
 * The source plates are the single source of truth; variants are pure build outputs derived from them,
 * so re-running after a plate changes just refreshes its variants. Kept in lock-step with the tiers in
 * design/plateVariants.ts (PLATE_VARIANT_WIDTHS).
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLATES_DIR = resolve(HERE, '..', 'src', 'assets', 'plates');
const VARIANTS_DIR = join(PLATES_DIR, 'variants');

// The tiers to build, in source pixels. MUST match PLATE_VARIANT_WIDTHS in design/plateVariants.ts.
const TIER_WIDTHS = [160, 320];
const WEBP_QUALITY = 82; // downscaled art — visually clean well below the source's size

async function main() {
  const sources = readdirSync(PLATES_DIR).filter((name) => name.endsWith('.webp'));
  if (sources.length === 0) {
    console.error(`build-plate-variants: no plates in ${PLATES_DIR}`);
    process.exit(1);
  }
  // Start each tier folder clean so a removed source plate can't leave a stale variant behind.
  rmSync(VARIANTS_DIR, { recursive: true, force: true });
  const perTierBytes = Object.fromEntries(TIER_WIDTHS.map((w) => [w, 0]));

  for (const width of TIER_WIDTHS) {
    const outDir = join(VARIANTS_DIR, String(width));
    mkdirSync(outDir, { recursive: true });
    for (const name of sources) {
      const outPath = join(outDir, name);
      await sharp(join(PLATES_DIR, name))
        .resize({ width, withoutEnlargement: true }) // downscale only — never upscale a source
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);
      perTierBytes[width] += statSync(outPath).size;
    }
  }

  console.log(`build-plate-variants: ${sources.length} plates → ${TIER_WIDTHS.length} tiers`);
  for (const width of TIER_WIDTHS) {
    const kb = (perTierBytes[width] / 1024).toFixed(0);
    const avg = (perTierBytes[width] / 1024 / sources.length).toFixed(1);
    console.log(`  ${String(width).padStart(4)}w  ${String(kb).padStart(6)} KB total  (avg ${avg} KB/plate)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
