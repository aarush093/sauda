/**
 * The portrait banner (U2 — retire the rotate dead-end, first-player pass). SAUDA plays best in
 * landscape, but a browser cannot FORCE orientation outside fullscreen, so the old full-screen "Rotate
 * your phone to play" interstitial was a wall — the player who couldn't (or wouldn't) rotate was stuck.
 * U2 keeps the game PLAYABLE in portrait (a compressed, centred landscape board — see Board) and
 * replaces the wall with THIS: a slim, non-blocking strip along the top that never covers the board.
 *
 * It offers the one thing that can help — "Go fullscreen", which attempts screen.orientation.lock and
 * swallows any failure (requestLandscapeFullscreen) — and it is dismissible, so a player who is happy in
 * portrait taps ✕ and it is gone. Native orientation lock proper arrives with the M5 Capacitor build,
 * where the manifest pins landscape (see DECISIONS "U4").
 */
import { requestLandscapeFullscreen } from '../game/orientation';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

export function PortraitBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={bannerStyle} data-portrait-banner>
      <span style={textStyle}>Rotate for the full view</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={fullscreenButtonStyle} onClick={() => void requestLandscapeFullscreen()}>
          Go fullscreen
        </button>
        <button style={dismissButtonStyle} onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}

// A slim horizontal strip — its own row above the board (never overlaps it). Aged-cream on the felt so
// it reads as a quiet note, not an alarm.
const bannerStyle = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '5px 12px',
  background: STAGE.cardCream,
  color: INK.deepInk,
  borderBottom: `1px solid ${INK.agedLine}`,
  zIndex: LAYERS.nav,
} as const;

const textStyle = {
  fontFamily: FONT.serif,
  fontStyle: 'italic',
  fontSize: 12,
  color: INK.mutedBrown,
} as const;

const fullscreenButtonStyle = {
  padding: '4px 12px',
  minHeight: 30,
  borderRadius: 999,
  border: `1.5px solid ${INK.agedLine}`,
  background: INK.footerBand,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 11,
} as const;

const dismissButtonStyle = {
  width: 26,
  height: 26,
  minHeight: 26,
  borderRadius: '50%',
  border: `1px solid ${INK.agedLine}`,
  background: 'transparent',
  color: INK.mutedBrown,
  fontSize: 12,
  lineHeight: '20px',
  padding: 0,
} as const;
