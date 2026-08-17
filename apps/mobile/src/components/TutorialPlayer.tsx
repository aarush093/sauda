/**
 * THE GUIDED TUTORIAL player — "Sikho" (U3). Plays the deterministic demo (game/tutorial.ts) on the
 * real Board, driven by the gold cursor (TutorialCursor). Before each move TYPE is first seen it pauses,
 * dims, and shows a teaching card — what is about to happen, why, and a tap-through to the exact Book
 * chapter — then Continue resumes. Skip ends the tutorial and lands on Home; Pause/Play holds it.
 *
 * Determinism lives in tutorial.ts (a fixed crafted game + scripted actions replayed through the
 * engine); this file is only the playback + the teaching UI. The board shown at step i is the engine
 * state AFTER the previous step, so the cursor performing step i visibly transforms it into the next.
 * Under prefers-reduced-motion the cursor is instant and the holds are short — comprehension, not show.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { observe } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { runTutorial, TUTORIAL_STEPS } from '../game/tutorial';
import type { TutorialMove, TeachBeat } from '../game/tutorial';
import { Board } from './Board';
import { Book } from '../shell/Book';
import { TutorialCursor } from './TutorialCursor';
import type { CursorState } from './TutorialCursor';
import { useReducedMotion } from '../design/motion';
import { STAGE, INK, FONT, SHADOW, LAYERS } from '../design/tokens';

const SEATS: SeatConfig[] = [{ kind: 'human' }, { kind: 'bot', difficulty: 'easy' }];

// Resolve a cursor selector to a viewport-centre point, or null if the element isn't on screen (some
// targets — e.g. data-card-id — only render in dev; the cursor then falls back to a sensible spot).
function centreOf(selector: string | undefined): { x: number; y: number } | null {
  if (!selector || typeof document === 'undefined') {
    return null;
  }
  const el = document.querySelector(selector);
  if (!el) {
    return null;
  }
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    return null;
  }
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function fallbackPoint(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 400, y: 300 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.62 }; // over the hand band, roughly
}

// The card id a "from" selector names, so the cursor can carry it during a drag (best effort).
function cardIdFromSelector(selector: string | undefined): string | null {
  if (!selector) {
    return null;
  }
  const match = /data-card-id="([^"]+)"/.exec(selector);
  return match ? match[1]! : null;
}

export function TutorialPlayer({ onExit }: { onExit: () => void }) {
  const reduced = useReducedMotion();
  const run = useMemo(() => runTutorial(), []);
  const [stepIndex, setStepIndex] = useState(0);
  const [seen, setSeen] = useState<Set<TutorialMove>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [bookChapter, setBookChapter] = useState<number | null>(null);
  const [cursor, setCursor] = useState<CursorState>(() => ({ ...fallbackPoint(), pressing: false, carryCardId: null }));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const done = stepIndex >= TUTORIAL_STEPS.length;
  const step = done ? null : TUTORIAL_STEPS[stepIndex]!;
  // A beat is due when this step first teaches its move class and we haven't shown it yet.
  const beat: TeachBeat | null = step?.teach && !seen.has(step.move) ? step.teach : null;
  // The board reflects the state AFTER the last completed step (states[stepIndex]); the final state is
  // the declared win.
  const shownState = run.states[Math.min(stepIndex, run.states.length - 1)]!;
  const observation = observe(shownState, 0);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // The playback engine: whenever we settle on a step (and are not paused, not showing a beat, not
  // reading the Book), animate the cursor for it and then advance. Cleanup cancels pending timers so a
  // pause / skip / unmount never fires a stale advance.
  useEffect(() => {
    if (done || paused || beat !== null || bookChapter !== null || !step) {
      return;
    }
    clearTimers();
    const hold = reduced ? 220 : 720;
    const to = centreOf(step.cursor?.to) ?? fallbackPoint();
    const from = centreOf(step.cursor?.from);
    const gesture = step.cursor?.gesture ?? 'point';
    const advance = () => setStepIndex((i) => i + 1);

    if (gesture === 'drag') {
      const carry = cardIdFromSelector(step.cursor?.from);
      const start = from ?? fallbackPoint();
      setCursor({ x: start.x, y: start.y, pressing: false, carryCardId: carry });
      timers.current.push(setTimeout(() => setCursor({ x: to.x, y: to.y, pressing: false, carryCardId: carry }), reduced ? 0 : 380));
      timers.current.push(setTimeout(() => setCursor((c) => ({ ...c, carryCardId: null })), reduced ? 120 : 900));
      timers.current.push(setTimeout(advance, hold + (reduced ? 160 : 900)));
    } else if (gesture === 'tap') {
      setCursor({ x: to.x, y: to.y, pressing: false, carryCardId: null });
      timers.current.push(setTimeout(() => setCursor((c) => ({ ...c, pressing: true })), reduced ? 0 : 200));
      timers.current.push(setTimeout(() => setCursor((c) => ({ ...c, pressing: false })), reduced ? 120 : 380));
      timers.current.push(setTimeout(advance, hold));
    } else {
      setCursor({ x: to.x, y: to.y, pressing: false, carryCardId: null });
      timers.current.push(setTimeout(advance, hold));
    }
    return clearTimers;
  }, [stepIndex, paused, beat, bookChapter, step, reduced, done]);

  useEffect(() => clearTimers, []); // clear on unmount

  function onContinue() {
    if (step) {
      setSeen((s) => new Set(s).add(step.move)); // beat dismissed → the effect performs the step
    }
  }

  return (
    <div style={shellStyle}>
      <div style={topBarStyle}>
        <span style={{ fontFamily: FONT.display, fontWeight: 700, color: STAGE.accentGold, fontSize: 14 }}>Sikho — demo game</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={barButton} onClick={() => setPaused((p) => !p)} disabled={done}>{paused ? 'Play' : 'Pause'}</button>
          <button style={barButton} onClick={onExit}>Skip</button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Board observation={observation} seats={SEATS} actions={[]} />
      </div>

      {/* the quiet caption of the current moment, low on the felt (hidden while a beat is up) */}
      {!done && beat === null && step && <div style={captionStyle}>{step.caption}</div>}

      {/* the gold cursor — hidden while a beat card is up (the board is dimmed then) */}
      {!done && beat === null && bookChapter === null && <TutorialCursor cursor={cursor} reducedMotion={reduced} />}

      {/* the teaching beat — dims the board and explains the move before it first appears */}
      {beat !== null && bookChapter === null && (
        <div style={beatScrimStyle}>
          <div style={beatCardStyle}>
            <div style={beatTitleStyle}>{beat.title}</div>
            <p style={beatBodyStyle}>{beat.what}</p>
            <p style={beatWhyStyle}>{beat.why}</p>
            <button style={niyamLinkStyle} onClick={() => setBookChapter(beat.niyam)}>{beat.niyamLabel} →</button>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button style={continueButton} onClick={onContinue}>Continue</button>
              <button style={barButton} onClick={onExit}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* the Book opened from a beat's Niyam link — closes back to the paused beat, no route change */}
      {bookChapter !== null && <Book initialChapter={bookChapter} onClose={() => setBookChapter(null)} />}

      {/* the finish — a real declared SAUDA. Offer a game or Home. */}
      {done && (
        <div style={beatScrimStyle}>
          <div style={beatCardStyle}>
            <div style={{ ...beatTitleStyle, color: STAGE.accentGold }}>That's the game!</div>
            <p style={beatBodyStyle}>You watched a full match end in a declared SAUDA — every kind of move, tied to the rulebook.</p>
            <button style={continueButton} onClick={onExit}>Play your own game</button>
          </div>
        </div>
      )}
    </div>
  );
}

const shellStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  background: STAGE.felt,
  color: STAGE.textOnFelt,
  overflow: 'hidden',
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
  paddingRight: 'env(safe-area-inset-right, 0px)',
};
const topBarStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '5px 12px',
  background: STAGE.scrimSheet,
  zIndex: LAYERS.nav,
};
const barButton: CSSProperties = {
  minHeight: 30,
  padding: '4px 14px',
  borderRadius: 999,
  border: `1.5px solid ${INK.gold}`,
  background: 'transparent',
  color: STAGE.accentGold,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 12,
};
const captionStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
  transform: 'translateX(-50%)',
  zIndex: LAYERS.toast,
  pointerEvents: 'none',
  maxWidth: '86vw',
  padding: '7px 16px',
  borderRadius: 999,
  background: STAGE.cardCream,
  color: INK.deepInk,
  fontFamily: FONT.serif,
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'center',
  boxShadow: STAGE.glowGold,
};
const beatScrimStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.advice,
  background: STAGE.scrimSheet,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};
const beatCardStyle: CSSProperties = {
  maxWidth: 340,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '18px 20px',
  borderRadius: 16,
  background: STAGE.cardCream,
  color: INK.deepInk,
  border: `1.5px solid ${INK.agedLine}`,
  boxShadow: SHADOW.dragLift,
};
const beatTitleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 18, color: INK.deepInk };
const beatBodyStyle: CSSProperties = { margin: 0, fontFamily: FONT.serif, fontSize: 14, lineHeight: 1.4, color: INK.deepInk };
const beatWhyStyle: CSSProperties = { margin: 0, fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 13, color: INK.mutedBrown };
const niyamLinkStyle: CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: 4,
  padding: '5px 12px',
  borderRadius: 999,
  border: `1.5px solid ${INK.agedLine}`,
  background: INK.footerBand,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 12,
};
const continueButton: CSSProperties = {
  minHeight: 40,
  padding: '8px 20px',
  borderRadius: 10,
  border: `2px solid ${INK.gold}`,
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
};
