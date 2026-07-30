/**
 * DEV-ONLY wheel lab (tree-shaken from prod — reached only via the `import.meta.env.DEV`-gated
 * `#/dev/wheel/<n>` route). It renders the REAL HandWheel with N cards inside a my-area-sized band
 * so the excellence pass can shoot the H3 legibility n-series (n = 2,5,7,9,11) and film the
 * re-spacing glide: tapping a card removes it, so the remaining cards glide to their new even
 * spacing exactly as they do when a real play shrinks the hand. No engine, no rules — pure geometry.
 */
import { useState } from 'react';
import { createGame } from '@sauda/engine';
import { HandWheel } from './HandWheel';
import { STAGE, INK, FONT } from '../design/tokens';

// A varied real deck (properties, wildcards, actions, money in deck order) so the wheel shows the
// true mix of faces — driven off a fixed seed so the n-series is reproducible.
function devDeck(): string[] {
  const { state } = createGame({ players: 4, seed: 424242 });
  const all: string[] = [...state.drawPile];
  for (const player of state.players) {
    all.push(...player.hand);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of all) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function DevWheel({ count }: { count: number }) {
  const [cards, setCards] = useState<string[]>(() => devDeck().slice(0, count));
  const interactive = new Set(cards);
  return (
    <div style={{ width: 360, height: 740, margin: '0 auto', background: STAGE.felt, color: STAGE.textOnFelt, position: 'relative', overflow: 'hidden', fontFamily: FONT.serif }}>
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', fontFamily: FONT.mono, fontSize: 12, opacity: 0.7 }}>
        wheel lab · n={cards.length} · tap a card to play it (glide)
      </div>
      {/* the my-area bottom band: same 8px insets as the real board, hub at bottom-centre. */}
      <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
        <div style={{ borderTop: `1px solid ${INK.agedLine}`, opacity: 0.25, marginBottom: 4 }} />
        <HandWheel
          cards={cards}
          interactiveIds={interactive}
          drag={null}
          eligibleZones={() => new Set()}
          onTap={(id) => setCards((current) => current.filter((card) => card !== id))}
          onDrop={(id) => setCards((current) => current.filter((card) => card !== id))}
          onDragChange={() => {}}
        />
      </div>
    </div>
  );
}
