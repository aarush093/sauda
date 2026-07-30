/**
 * /dev/plates — a developer sheet that renders every distinct card FACE full, then scaled to a
 * table size and a tiny size (the same ScaledCard the board uses — G4: one real face everywhere),
 * and tags whether a raster plate exists yet or the SVG fallback is being used. This is the M4a
 * review artefact and the way art plates are checked in as they arrive (the tag flips with no code).
 */
import { CardFace, ScaledCard } from './CardFace';
import { cardById, plateKey, representativeCardIds } from '../design/cardData';
import { hasPlate } from '../design/plates';
import { FONT, INK } from '../design/tokens';

// Does a raster plate exist for this card face? (action cards share a per-kind plate)
function facePlated(id: string): boolean {
  const card = cardById(id);
  return card ? hasPlate(plateKey(card)) : false;
}

export function PlateSheet() {
  const ids = representativeCardIds();
  const plateCount = ids.filter(facePlated).length;

  return (
    <div style={{ minHeight: '100vh', background: INK.tableIndigo, color: INK.cardCream, padding: 16 }}>
      <h1 style={{ fontFamily: FONT.display, margin: '4px 0' }}>SAUDA — plate sheet</h1>
      <p style={{ fontFamily: FONT.body, fontSize: 13, opacity: 0.85 }}>
        {ids.length} distinct faces · {plateCount} with a raster plate · {ids.length - plateCount} on
        the SVG fallback. Each shown full, then scaled to table + tiny size.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
        {ids.map((id) => (
          <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <CardFace cardId={id} />
              <ScaledCard cardId={id} width={76} />
              <ScaledCard cardId={id} width={46} />
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11 }}>
              {id} · <span style={{ color: facePlated(id) ? INK.gold : INK.lavender }}>{facePlated(id) ? 'plate' : 'fallback'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
