import { useEffect, useState } from 'react';
import { useGame } from './game/store';
import type { SeatConfig } from './game/store';
import { resolveSeed, resolveAutostartConfig } from './game/seed';
import { Home } from './shell/Home';
import { Book } from './shell/Book';
import { RotateGate } from './shell/RotateGate';
import { useOrientation } from './game/orientation';
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

// Dev-only: a solo game that starts itself, both for the capture frame and as the tunnel entry the
// owner plays. S6a: it draws a FRESH seed each mount (resolveSeed) instead of a fixed 424242, so the
// owner stops replaying one identical deal; determinism for captures is preserved because every
// capture harness re-deals through `window.__replay(seed, …)` right after load (and `?seed=<n>` pins
// a deal on demand). T1: the bot table is `?difficulty=easy|medium|hard` (default medium) + `?bots=1..3`
// (default 3), so the owner can test any tier from the tunnel link. A scroll guard warns if the play
// screen ever exceeds one screen (A2).
function autostartSeats(): SeatConfig[] {
  const { difficulty, bots } = resolveAutostartConfig();
  const seats: SeatConfig[] = [{ kind: 'human' }];
  for (let i = 0; i < bots; i++) {
    seats.push({ kind: 'bot', difficulty });
  }
  return seats;
}

function AutoStartTable() {
  const state = useGame((store) => store.state);
  const newGame = useGame((store) => store.newGame);
  useEffect(() => {
    if (!state) {
      newGame({ seats: autostartSeats(), seed: resolveSeed() });
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
      {import.meta.env.DEV && hudEnabled() && <Hud />}
    </>
  ) : null;
}

export function App() {
  const state = useGame((store) => store.state);
  const hash = useHash();
  const orientation = useOrientation();

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

  // Dev-only routes for M4 art / layout review. The whole block is gated on `import.meta.env.DEV`,
  // which Vite replaces with `false` in a production build — so these routes AND the dev-only
  // components they reach (PlateSheet, DevWheel) are dead-code-eliminated from the shipped bundle.
  if (import.meta.env.DEV) {
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
    // The hand WHEEL in isolation at N cards, in a my-area-sized band, for the H3 legibility
    // n-series stills + the re-spacing glide clip. `#/dev/wheel/5` etc.
    if (hash.startsWith('#/dev/wheel/')) {
      const n = Math.max(1, Math.min(12, Number(hash.slice('#/dev/wheel/'.length)) || 5));
      return <DevWheel count={n} />;
    }
  }

  // R0 (owner landscape directive, 2 Aug): SAUDA is LANDSCAPE-ONLY. In portrait the game never lays
  // out — the rotate gate stands over an UNMOUNTED, paused game (its state waits safely in the store,
  // so rotating back resumes exactly where we were, with no bot having stepped behind the gate). The
  // pure dev ART routes above (#/dev/card, /plates, /wheel) are not orientation-gated (they are review
  // tools shot in a tall box, not the game) — but they ARE DEV-gated, so prod never sees them. The dev
  // HUD rides above the gate so orientation stays debuggable.
  const hud = import.meta.env.DEV && hudEnabled() ? <Hud /> : null;
  if (orientation === 'portrait') {
    return (
      <>
        <RotateGate />
        {hud}
      </>
    );
  }

  if (hash === '#/autostart') {
    return <AutoStartTable />; // AutoStartTable renders its own HUD
  }
  if (import.meta.env.DEV && hash === '#/dev/frame360') {
    // R0: the live play screen inside an exact LANDSCAPE box (740x360, the legacy tight profile) — an
    // iframe, so the board's vw/vh resolve to the frame and not the desktop viewport, and the inner
    // #/autostart sees a landscape viewport so it never gates. Neutral surround for captures.
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: INK.deepInk }}>
        <iframe title="frame360" src={`${window.location.pathname}#/autostart`} style={{ width: 740, height: 360, border: 'none', borderRadius: 16, boxShadow: SHADOW.dragLift }} />
      </div>
    );
  }

  // P8 shell routing. HOME is the default door; the game lives at #/play; the Book at #/niyam.
  // Home and Book each own their own fixed felt shell, so neither is wrapped in .app.
  const route = hash.split('?')[0];
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
