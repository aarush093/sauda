/**
 * The rotate-to-play gate (R0 — owner landscape directive, 2 Aug). SAUDA is a landscape-only game.
 * A browser cannot force orientation outside fullscreen, so when the viewport is portrait the App
 * renders THIS instead of the game — a full-screen vintage interstitial over the (unmounted, paused)
 * game. The game never lays out in portrait; its state waits safely in the store until we rotate back.
 *
 * The one interactive affordance is a quiet "Go fullscreen" control: on a browser that supports it,
 * one tap enters fullscreen and locks landscape (requestLandscapeFullscreen, failure-tolerant); on
 * one that doesn't, the player simply rotates the device by hand and this gate clears itself.
 */
import { requestLandscapeFullscreen } from '../game/orientation';
import { useReducedMotion } from '../design/motion';
import { INK, STAGE, FONT, SHADOW, LAYERS } from '../design/tokens';

// A code-drawn phone that rocks a quarter-turn to mime the rotation (P4: still under reduced motion).
// SVG only — no asset — so it stays crisp at any DPR and carries no third-party trade dress.
function RotatingPhoneGlyph({ animate }: { animate: boolean }) {
  return (
    <svg width={72} height={72} viewBox="0 0 48 48" role="img" aria-label="Rotate device" style={{ overflow: 'visible' }}>
      {/* the curved rotation arrow arcing over the phone — the "turn me" cue */}
      <path d="M12 9 A18 18 0 0 1 36 9" fill="none" stroke={INK.gold} strokeWidth={2} strokeLinecap="round" />
      <path d="M36 9 l-1.5 -5 M36 9 l-5 1.5" fill="none" stroke={INK.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* the phone body — rocks from upright toward its side, transform-origin at its own centre */}
      <g
        className={animate ? 'rotate-hint-glyph' : undefined}
        style={{
          transformOrigin: '24px 28px',
          transformBox: 'fill-box',
          animation: animate ? 'rotate-hint 2.6s ease-in-out infinite' : undefined,
        }}
      >
        {/* deep ink on the aged-cream card — the phone must read against the paper (not cream-on-cream) */}
        <rect x={18} y={16} width={12} height={22} rx={2.4} fill="none" stroke={INK.deepInk} strokeWidth={2} />
        <line x1={21.5} y1={35} x2={26.5} y2={35} stroke={INK.deepInk} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function RotateGate() {
  const reduced = useReducedMotion();
  return (
    <div style={feltShellStyle} data-rotate-gate>
      <div style={cardStyle}>
        <RotatingPhoneGlyph animate={!reduced} />
        <h1 style={titleStyle}>Rotate your phone to play</h1>
        <p style={subtitleStyle}>SAUDA is played in landscape.</p>
        {/* the one quiet control — enters fullscreen + locks landscape where the browser allows it */}
        <button style={fullscreenButtonStyle} onClick={() => void requestLandscapeFullscreen()}>
          Go fullscreen
        </button>
      </div>
    </div>
  );
}

// A fixed full-screen indigo-felt shell, padded by the safe-area insets (in portrait the notch sits
// top/bottom). It sits above every in-play surface (LAYERS.rotate) but under the dev HUD.
const feltShellStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.rotate,
  background: STAGE.felt,
  color: STAGE.textOnFelt,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)',
  textAlign: 'center',
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
} as const;

// The aged-cream card the message sits on — the same paper the game's cards are cut from.
const cardStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  maxWidth: 300,
  padding: '28px 26px',
  borderRadius: 16,
  background: STAGE.cardCream,
  color: INK.deepInk,
  border: `1.5px solid ${INK.agedLine}`,
  boxShadow: SHADOW.dragLift,
} as const;

const titleStyle = {
  margin: 0,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 20,
  lineHeight: 1.2,
  color: INK.deepInk,
} as const;

const subtitleStyle = {
  margin: 0,
  fontFamily: FONT.serif,
  fontSize: 13,
  color: INK.mutedBrown,
} as const;

const fullscreenButtonStyle = {
  marginTop: 6,
  padding: '9px 18px',
  borderRadius: 999,
  border: `1.5px solid ${INK.agedLine}`,
  background: INK.footerBand,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 13,
} as const;
