/**
 * The TURN TOKEN (K3, owner reorder 31 Jul) — ONE centred control in my row that replaces the End
 * turn button, the F2 "turn over" beat, AND the centre-stage Declare button. It is the brightest,
 * largest token on the surface and carries the whole end-of-turn story in one place:
 *
 *   • PLAYS DISPLAY — three circles, EMPTY at turn start; each play spent FILLS one (spent-counting,
 *     the owner's requested direction). The only plays indicator now (the You-chip pips are gone).
 *   • IDLE (plays remaining) — tap ARMS the token ("End turn?", ~2s); a second tap ends early, even
 *     with plays in hand (H2a — the deliberate early end is preserved, just moved onto the token).
 *   • DRAINING (plays spent, no win) — a ~2.5s gold ring drains, then END_TURN auto-dispatches; a tap
 *     during the drain ends immediately. Starting a rearrange drag PAUSES the drain (you may still
 *     move a placed wildcard for free); finishing it restarts the grace.
 *   • WIN (DECLARE_WIN legal) — the token becomes the gold SAUDA! declare. Auto-end NEVER fires while
 *     a win is declarable, so a winning turn can't end itself before you claim it.
 *
 * The mode decision is a pure function (`turnTokenMode`) so the whole matrix is unit-tested. The
 * drain is a requestAnimationFrame countdown (pausable, tappable-to-skip); `prefers-reduced-motion`
 * keeps the 2.5s grace but shows a static ring instead of a sweeping one (the grace is usability,
 * not decoration). Ending flows through the same END_TURN the engine offers, so hand > 7 still routes
 * into the discard step exactly as before.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { STAGE, INK, FONT } from '../design/tokens';
import { useReducedMotion } from '../design/motion';

export const PLAYS_PER_TURN = 3; // §4.4 — three plays a turn; the token shows three circles
const DRAIN_MS = 2500; // the auto-end grace once every play is spent
const ARM_MS = 2000; // an armed early-end reverts to idle after this long if not confirmed

export type TurnTokenMode = 'inert' | 'idle' | 'armed' | 'draining' | 'win';

// The token's mode from the turn facts — PURE, so the state matrix is unit-tested without a DOM.
// Order matters: win overrides everything (auto-end must never fire while a win is declarable), then
// a spent turn drains, then an armed early-end, else idle. Off my turn the token is inert.
export function turnTokenMode(input: {
  active: boolean; // my own play turn, not the discard step
  playsRemaining: number;
  winLegal: boolean;
  endTurnLegal: boolean;
  armed: boolean;
}): TurnTokenMode {
  if (!input.active) {
    return 'inert';
  }
  if (input.winLegal) {
    return 'win';
  }
  if (input.playsRemaining <= 0 && input.endTurnLegal) {
    return 'draining';
  }
  if (input.armed) {
    return 'armed';
  }
  return 'idle';
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0;

export function TurnToken({
  active,
  playsRemaining,
  winLegal,
  endTurnLegal,
  rearrangeActive,
  paused = false,
  onEndTurn,
  onDeclareWin,
}: {
  active: boolean;
  playsRemaining: number;
  winLegal: boolean;
  endTurnLegal: boolean;
  rearrangeActive: boolean; // a placed-wildcard rearrange is being dragged → pause the drain
  paused?: boolean | undefined; // P8: the game is paused (pause sheet open) → freeze the auto-end drain
  onEndTurn: () => void;
  onDeclareWin: () => void;
}) {
  const reduced = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const [drainProgress, setDrainProgress] = useState(0); // 0 = full ring, 1 = drained
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafId = useRef<number>(0);
  const drainElapsed = useRef<number>(0);
  const lastFrame = useRef<number>(0);
  const rearrangeRef = useRef(rearrangeActive);
  rearrangeRef.current = rearrangeActive;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const mode = turnTokenMode({ active, playsRemaining, winLegal, endTurnLegal, armed });

  // Disarm helper — used on unmount, on ending, and when the turn context changes.
  const disarm = useCallback(() => {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    setArmed(false);
  }, []);

  // Drain countdown (rAF). Advances only while NOT paused by a rearrange drag; when it reaches the
  // grace it ends the turn once. Reduced motion keeps the timing but leaves the ring static.
  useEffect(() => {
    if (mode !== 'draining') {
      // leaving the drain: stop the loop and reset for next time
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
      drainElapsed.current = 0;
      setDrainProgress(0);
      return;
    }
    drainElapsed.current = 0;
    lastFrame.current = now();
    let ended = false;
    const step = () => {
      const time = now();
      const dt = Math.min(48, time - lastFrame.current);
      lastFrame.current = time;
      if (!rearrangeRef.current && !pausedRef.current) {
        drainElapsed.current += dt; // paused while a rearrange drag is in flight, or the game is paused (P8)
      }
      const progress = Math.min(1, drainElapsed.current / DRAIN_MS);
      if (!reduced) {
        setDrainProgress(progress);
      }
      if (progress >= 1 && !ended) {
        ended = true;
        onEndTurn();
        return;
      }
      rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
    };
  }, [mode, reduced, onEndTurn]);

  // Reset the armed state whenever it stops being my turn (so a new turn opens clean).
  useEffect(() => {
    if (!active) {
      disarm();
    }
  }, [active, disarm]);

  useEffect(() => () => disarm(), [disarm]);

  function handleTap(): void {
    switch (mode) {
      case 'win':
        onDeclareWin();
        return;
      case 'draining':
        disarm();
        onEndTurn(); // tap during the drain ends immediately
        return;
      case 'armed':
        disarm();
        onEndTurn(); // second tap confirms the early end
        return;
      case 'idle':
        setArmed(true); // first tap arms; a second within ARM_MS confirms
        if (armTimer.current) {
          clearTimeout(armTimer.current);
        }
        armTimer.current = setTimeout(() => setArmed(false), ARM_MS);
        return;
      default:
        return; // inert
    }
  }

  if (mode === 'inert') {
    return null; // off my turn the centred slot is empty; the my-area is dimmed anyway
  }

  const spent = Math.max(0, Math.min(PLAYS_PER_TURN, PLAYS_PER_TURN - playsRemaining));

  if (mode === 'win') {
    return (
      <button type="button" onClick={handleTap} style={winStyle} aria-label="Declare SAUDA!">
        SAUDA!
      </button>
    );
  }

  const armedNow = mode === 'armed';
  const draining = mode === 'draining';

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={armedNow ? 'Confirm end turn' : draining ? 'End turn now' : 'End turn'}
      style={discStyle(armedNow || draining)}
    >
      {draining && <DrainRing progress={reduced ? 0 : drainProgress} />}
      {armedNow ? (
        <span style={armedLabelStyle}>End turn?</span>
      ) : (
        <span style={playsRowStyle} aria-hidden>
          {Array.from({ length: PLAYS_PER_TURN }).map((_, index) => (
            <span key={index} style={playPipStyle(index < spent)} />
          ))}
        </span>
      )}
    </button>
  );
}

// The gold ring that empties over the grace — an SVG circle whose drawn arc shrinks with progress.
function DrainRing({ progress }: { progress: number }) {
  const size = 54;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const drawn = circumference * (1 - progress); // full at progress 0, gone at 1
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={ringStyle} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={STAGE.accentGold}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${drawn} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// The disc: a gold token, larger than its neighbours. Draining/armed brighten it (the one glow) so
// the end-of-turn moment reads as the loudest thing in my row.
function discStyle(bright: boolean): CSSProperties {
  return {
    position: 'relative',
    width: 46,
    height: 46,
    borderRadius: '50%',
    border: `2px solid ${INK.gold}`,
    background: bright ? STAGE.accentGold : 'transparent',
    color: bright ? INK.deepInk : STAGE.accentGold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: STAGE.glowGold,
    flexShrink: 0,
    padding: 0,
  };
}

const ringStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

const playsRowStyle: CSSProperties = { display: 'flex', gap: 4, alignItems: 'center' };

// One play circle: empty (a ring) until spent, then filled — spent-counting (each play fills one).
function playPipStyle(filled: boolean): CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: filled ? STAGE.accentGold : 'transparent',
    border: `1.5px solid ${INK.gold}`,
  };
}

const armedLabelStyle: CSSProperties = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 9,
  lineHeight: 1,
  color: INK.deepInk,
  textAlign: 'center',
};

const winStyle: CSSProperties = {
  padding: '10px 18px',
  borderRadius: 999,
  border: 'none',
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
  boxShadow: STAGE.glowGold,
  flexShrink: 0,
  whiteSpace: 'nowrap',
};
