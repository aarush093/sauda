/**
 * /dev/plates — a developer sheet that renders every distinct card FACE at all
 * three sizes (FULL · MID · CHIP) and tags whether a raster plate exists yet or
 * the SVG fallback is being used. This is the M4a review artefact and the way art
 * plates are checked in as they arrive (the tag flips to "plate" with no code change).
 */
import { CardFace } from './CardFace';
import { representativeCardIds } from '../design/cardData';
import { hasPlate } from '../design/plates';
import { FONT, INK } from '../design/tokens';

export function PlateSheet() {
  const ids = representativeCardIds();
  const plateCount = ids.filter(hasPlate).length;

  return (
    <div style={{ minHeight: '100vh', background: INK.tableIndigo, color: INK.cardCream, padding: 16 }}>
      <h1 style={{ fontFamily: FONT.display, margin: '4px 0' }}>SAUDA — plate sheet</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, opacity: 0.85 }}>
        {ids.length} distinct faces · {plateCount} with a raster plate · {ids.length - plateCount} on
        the SVG fallback. Each shown FULL · MID · CHIP.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
        {ids.map((id) => (
          <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <CardFace cardId={id} size="full" />
              <CardFace cardId={id} size="mid" heldCount={1} />
              <CardFace cardId={id} size="chip" heldCount={1} />
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11 }}>
              {id} · <span style={{ color: hasPlate(id) ? INK.gold : INK.lavender }}>{hasPlate(id) ? 'plate' : 'fallback'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
