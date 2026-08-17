/**
 * THE ROTATE SCREEN (W1, first-player pass — supersedes U2). SAUDA is a LANDSCAPE game from the moment
 * it opens until the game ends. The U2 experiment kept the board "playable" in a compressed portrait
 * composition; on the owner's iPhone that read as a mostly-empty field with everything crushed at the
 * bottom — not playable, and a misrepresentation of the game. W1 removes that: in portrait we show ONE
 * clean, designed full-screen invitation to rotate, and the instant the device reports landscape the
 * real game appears (App swaps this out — the game state is untouched, so a rotate mid-game loses
 * nothing; see App.tsx and DECISIONS "W1").
 *
 * This is an INVITATION, not an error state — aged-cream card on indigo felt, the wordmark, a gently
 * rotating code-drawn phone mark (still under prefers-reduced-motion), one line, and the one control a
 * browser actually has: "Go fullscreen" (fullscreen is the ONLY context where a browser may lock
 * orientation — requestLandscapeFullscreen attempts screen.orientation.lock and swallows any failure).
 * The native landscape lock ships with the M5 Capacitor manifest; here we can only invite.
 */
import type { CSSProperties } from 'react';
import { GAME } from '@sauda/engine';
import { requestLandscapeFullscreen } from '../game/orientation';
import { useReducedMotion } from '../design/motion';
import { INK, STAGE, FONT, SHADOW } from '../design/tokens';

export function RotateScreen() {
  const reducedMotion = useReducedMotion();
  return (
    <div style={screenStyle} data-rotate-screen>
      <div style={cardStyle}>
        <RotatingPhone reducedMotion={reducedMotion} />
        <div style={wordmarkStyle}>{GAME.name}</div>
        {/* the one line. "SAUDA" is the theme name (one-file rebrand law); the rest is UI chrome. */}
        <div style={lineStyle}>{GAME.name} is played in landscape — turn your phone</div>
        <button style={fullscreenButtonStyle} onClick={() => void requestLandscapeFullscreen()}>
          Go fullscreen
        </button>
      </div>
    </div>
  );
}

// The code-drawn phone mark: a rounded-rect phone with a speaker notch and a screen, tilting from
// upright to sideways and back on a gentle loop (the `.sauda-rotate-phone` keyframe in styles.css).
// Under reduced motion it holds sideways (already-landscape) and never animates — the CSS media guard
// in styles.css is the second belt, so the mark can never move when the OS asks for stillness.
function RotatingPhone({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div style={{ height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        className="sauda-rotate-phone"
        width={60}
        height={92}
        viewBox="0 0 60 92"
        aria-hidden
        style={{
          transformOrigin: 'center',
          transform: reducedMotion ? 'rotate(-90deg)' : undefined,
        }}
      >
        {/* the phone body */}
        <rect x={6} y={2} width={48} height={88} rx={9} fill="none" stroke={INK.gold} strokeWidth={2.5} />
        {/* the screen */}
        <rect x={11} y={11} width={38} height={66} rx={3} fill="none" stroke={INK.agedLine} strokeWidth={1.5} opacity={0.7} />
        {/* the speaker notch and home dot */}
        <line x1={24} y1={7} x2={36} y2={7} stroke={INK.agedLine} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        <circle cx={30} cy={83} r={2.5} fill={INK.gold} opacity={0.9} />
      </svg>
    </div>
  );
}

// The felt fills the whole viewport (this replaces the entire app while portrait), safe-area padded.
const screenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding:
    'calc(env(safe-area-inset-top, 0px) + 20px) calc(env(safe-area-inset-right, 0px) + 24px) calc(env(safe-area-inset-bottom, 0px) + 20px) calc(env(safe-area-inset-left, 0px) + 24px)',
  background: `radial-gradient(120% 80% at 50% 30%, ${INK.tableIndigo}, ${INK.deepInk})`,
  color: STAGE.textOnFelt,
  overflow: 'hidden',
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
};

// The aged-cream card the invitation sits on — the same paper the deed cards are cut from.
const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  maxWidth: 320,
  padding: '26px 28px',
  borderRadius: 18,
  background: STAGE.cardCream,
  color: INK.deepInk,
  border: `1.5px solid ${INK.agedLine}`,
  boxShadow: SHADOW.dragLift,
  textAlign: 'center',
};

const wordmarkStyle: CSSProperties = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 30,
  letterSpacing: '0.12em',
  color: INK.deepInk,
};

const lineStyle: CSSProperties = {
  fontFamily: FONT.serif,
  fontStyle: 'italic',
  fontSize: 14,
  lineHeight: 1.4,
  color: INK.mutedBrown,
};

const fullscreenButtonStyle: CSSProperties = {
  marginTop: 2,
  padding: '8px 20px',
  minHeight: 44,
  borderRadius: 999,
  border: `2px solid ${INK.gold}`,
  background: INK.footerBand,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
};
