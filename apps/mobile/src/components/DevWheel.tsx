/**
 * DEV-ONLY spread lab (tree-shaken from prod — reached only via the `import.meta.env.DEV`-gated
 * `#/dev/wheel/<n>` route; the route name is kept so the existing capture scripts still resolve, but
 * it now renders the SPREAD that retired the wheel — S1). It renders the REAL HandSpread with N cards
 * inside a my-area-sized band so the legibility n-series (n = 5,8,11) and the re-spacing glide can be
 * shot: tapping a card removes it, so the remaining cards glide to their new even spacing exactly as
 * they do when a real play shrinks the hand. No engine, no rules — pure geometry.
 */
import { useState } from 'react';
import { createGame } from '@sauda/engine';
import { HandSpread } from './HandSpread';
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
  // S1: the lab fills the LANDSCAPE viewport (the game is landscape-only now) with the spread in a
  // bottom band spanning the width minus the rail + gap, so it measures the same container the real
  // my-area gives it — the n-series stills then show the true rest size at each profile.
  return (
    <div style={{ width: '100vw', height: '100dvh', background: STAGE.felt, color: STAGE.textOnFelt, position: 'relative', overflow: 'hidden', fontFamily: FONT.serif }}>
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', fontFamily: FONT.mono, fontSize: 12, opacity: 0.7 }}>
        spread lab · n={cards.length} · tap a card to play it (glide)
      </div>
      {/* the my-area bottom band: rail (46) + gutter (8) on the left, 8px on the right, matching the
          real wheelContainer so the measured width — and the derived card size — are true to the game. */}
      <div style={{ position: 'absolute', left: 54, right: 8, bottom: 8 }}>
        <div style={{ borderTop: `1px solid ${INK.agedLine}`, opacity: 0.25, marginBottom: 4 }} />
        <HandSpread
          cards={cards}
          interactiveIds={interactive}
          carriedCardId={null}
          onTap={(id) => setCards((current) => current.filter((card) => card !== id))}
          onDragStart={() => {}}
          onDragMove={() => {}}
          onDragEnd={() => {}}
          onDragCancel={() => {}}
        />
      </div>
    </div>
  );
}
