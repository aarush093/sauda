/**
 * Always-on safety net for dropped-in art plates (M4 §4.4). Every WebP in
 * assets/plates/ must be at the 100:145 card ratio and within the size budget, so
 * a mis-exported plate is caught the moment tests run rather than looking wrong in
 * the game. The folder may be empty (art arrives in batches) — that's fine.
 *
 * WebP dimensions are read straight from the file header (no dependency) — it
 * handles the three WebP variants a converter can emit (lossy VP8, lossless VP8L,
 * extended VP8X).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'plates');
const TARGET_RATIO = 145 / 100; // height / width
const MAX_BYTES = 150 * 1024;

function webpDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a WebP file');
  }
  const fourcc = buffer.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') {
    // Lossy: 14-bit width/height little-endian after the start code.
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (fourcc === 'VP8L') {
    // Lossless: 14-bit width-1 / height-1 packed after the 0x2f signature byte.
    const b0 = buffer.readUInt8(21);
    const b1 = buffer.readUInt8(22);
    const b2 = buffer.readUInt8(23);
    const b3 = buffer.readUInt8(24);
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (fourcc === 'VP8X') {
    // Extended: 24-bit canvas width-1 / height-1.
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  throw new Error(`unknown WebP variant: ${fourcc}`);
}

const plateFiles = existsSync(PLATES_DIR)
  ? readdirSync(PLATES_DIR).filter((name) => name.endsWith('.webp'))
  : [];

describe('art plates', () => {
  it('the plates folder is scannable (may be empty between art batches)', () => {
    expect(Array.isArray(plateFiles)).toBe(true);
  });

  for (const file of plateFiles) {
    it(`${file} is a WebP at the 100:145 ratio and ≤150 KB`, () => {
      const buffer = readFileSync(join(PLATES_DIR, file));
      expect(buffer.length, `${file} exceeds 150 KB`).toBeLessThanOrEqual(MAX_BYTES);
      const { width, height } = webpDimensions(buffer);
      expect(width, `${file} has no width`).toBeGreaterThan(0);
      const ratio = height / width;
      expect(
        Math.abs(ratio - TARGET_RATIO),
        `${file} is ${width}×${height} (ratio ${ratio.toFixed(3)}, want ${TARGET_RATIO})`,
      ).toBeLessThan(0.01);
    });
  }
});
