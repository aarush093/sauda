import { useEffect } from 'react';
import { useGame } from './game/store';
import type { SeatConfig } from './game/store';
import { Home } from './components/Home';
import { Table } from './components/Table';
import { PlateSheet } from './components/PlateSheet';
import { CardFace } from './components/CardFace';
import { DevWheel } from './components/DevWheel';
import { preloadPlates } from './design/plates';
import { INK, SHADOW } from './design/tokens';

// Dev-only: a solo game that starts itself for the 360x740 capture frame. A fixed seed
// keeps the deal reproducible across captures, and a scroll guard warns if the play screen
// ever exceeds the one portrait screen (A2 — zero scrolling in play).
const FRAME_SEATS: SeatConfig[] = [
  { kind: 'human' },
  { kind: 'bot', difficulty: 'medium' },
  { kind: 'bot', difficulty: 'medium' },
  { kind: 'bot', difficulty: 'medium' },
];

function AutoStartTable() {
  const state = useGame((store) => store.state);
  const newGame = useGame((store) => store.newGame);
  useEffect(() => {
    if (!state) {
      newGame({ seats: FRAME_SEATS, seed: 424242 });
    }
  }, [state, newGame]);
  useEffect(() => {
    const root = document.documentElement;
    if (root.scrollHeight > window.innerHeight + 1) {
      console.warn(`[frame360] play screen scrolls: ${root.scrollHeight}px > ${window.innerHeight}px viewport`);
    }
  });
  return state ? <Table /> : null;
}

export function App() {
  const state = useGame((store) => store.state);
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  // H4: warm every plate (fetch + async-decode) once on mount, so no card's first mid-game
  // appearance stalls on a webp decode on the target budget WebView.
  useEffect(() => {
    preloadPlates();
  }, []);

  // Dev-only routes for M4 art / layout review.
  if (hash.startsWith('#/dev/card/')) {
    const cardId = hash.slice('#/dev/card/'.length);
    return (
      <div style={{ minHeight: '100vh', background: INK.tableIndigo, padding: 32 }}>
        <div style={{ transform: 'scale(3)', transformOrigin: 'top left' }}>
          <CardFace cardId={cardId} />
        </div>
      </div>
    );
  }
  if (hash === '#/dev/plates') {
    return <PlateSheet />;
  }
  // Dev-only (tree-shaken from prod): the hand WHEEL in isolation at N cards, in a my-area-sized
  // band, for the H3 legibility n-series stills + the re-spacing glide clip. `#/dev/wheel/5` etc.
  if (import.meta.env.DEV && hash.startsWith('#/dev/wheel/')) {
    const n = Math.max(1, Math.min(12, Number(hash.slice('#/dev/wheel/'.length)) || 5));
    return <DevWheel count={n} />;
  }
  if (hash === '#/autostart') {
    return <AutoStartTable />;
  }
  if (hash === '#/dev/frame360') {
    // The live play screen inside an exact 360x740 box — an iframe, so the board's vw/vh
    // resolve to the frame and not the desktop viewport. Neutral surround for captures.
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: INK.deepInk }}>
        <iframe title="frame360" src={`${window.location.pathname}#/autostart`} style={{ width: 360, height: 740, border: 'none', borderRadius: 16, boxShadow: SHADOW.dragLift }} />
      </div>
    );
  }

  return <div className="app">{state === null ? <Home /> : <Table />}</div>;
}
