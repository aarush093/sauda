import { useEffect, useState } from 'react';
import { useGame } from './game/store';
import type { SeatConfig } from './game/store';
import { Home } from './shell/Home';
import { Book } from './shell/Book';
import { markGameCompleted } from './shell/firstRun';
import { Table } from './components/Table';
import { PlateSheet } from './components/PlateSheet';
import { CardFace } from './components/CardFace';
import { DevWheel } from './components/DevWheel';
import { preloadPlates } from './design/plates';
import { Hud, hudEnabled } from './dev/Hud';
import { INK, SHADOW } from './design/tokens';

// Reactive hash — re-renders on hashchange, so NIYAM navigation and the back button drive the route
// (P8 shell). It reads the LIVE window.location.hash on every render (using the event only to force a
// re-render), so a route change that rides along with a store update — KHELO does newGame() then sets
// the hash — is picked up on the very next render, with no dependence on hashchange event timing.
function useHash(): string {
  const [, forceRerender] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const onChange = () => forceRerender((tick) => tick + 1);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return typeof window !== 'undefined' ? window.location.hash : '';
}

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
  // P1 scroll guard — now against the REAL viewport (the play screen is a fixed 100dvh shell, so a
  // correct layout keeps the document exactly the viewport height in every device profile).
  useEffect(() => {
    const root = document.documentElement;
    if (root.scrollHeight > window.innerHeight + 1) {
      console.warn(`[scroll-guard] play screen scrolls: ${root.scrollHeight}px > ${window.innerHeight}px viewport`);
    }
  });
  return state ? (
    <>
      <Table />
      {hudEnabled() && <Hud />}
    </>
  ) : null;
}

export function App() {
  const state = useGame((store) => store.state);
  const hash = useHash();

  // H4: warm every plate (fetch + async-decode) once on mount, so no card's first mid-game
  // appearance stalls on a webp decode on the target budget WebView.
  useEffect(() => {
    preloadPlates();
  }, []);

  // P8 first-run: once a game ends, the newcomer ribbon on Home never shows again.
  const phase = state?.phase;
  useEffect(() => {
    if (phase === 'gameOver') {
      markGameCompleted();
    }
  }, [phase]);

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

  // P8 shell routing. HOME is the default door; the game lives at #/play; the Book at #/niyam.
  // Home and Book each own their own fixed felt shell, so neither is wrapped in .app.
  const route = hash.split('?')[0];
  const hud = hudEnabled() ? <Hud /> : null;
  if (route === '#/niyam') {
    return (
      <>
        <Book onClose={() => { window.location.hash = '#/'; }} />
        {hud}
      </>
    );
  }
  if (route === '#/play') {
    // A reload straight to #/play with no game in the store falls back to Home.
    return (
      <>
        {state ? <Table /> : <Home />}
        {hud}
      </>
    );
  }
  return (
    <>
      <Home />
      {hud}
    </>
  );
}
