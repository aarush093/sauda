/**
 * THE TUTORIAL CURSOR (U3). The visible pointer that drives the guided demo, rendered in the SAUDA
 * design language — a bright GOLD ring with a pale centre and a soft gold glow, tokens only (no new
 * colours, no asset). It travels between board elements with easing, shows a press pulse when it "taps",
 * and CARRIES the card during a drag so the gesture is legible. Under prefers-reduced-motion it is
 * instant — no eased travel, no pulse — so the demo stays comprehension, not decoration.
 *
 * It is a pure presentational component: TutorialPlayer computes where it should be and whether it is
 * pressing / carrying; this just paints it. pointer-events:none so it never intercepts a tap.
 */
import type { CSSProperties } from 'react';
import { CardFace } from './CardFace';
import { INK, STAGE, FONT, LAYERS } from '../design/tokens';

export interface CursorState {
  x: number; // viewport px (centre of the ring)
  y: number;
  pressing: boolean; // a tap pulse
  carryCardId: string | null; // a card being dragged under the cursor
}

const TRAVEL_MS = 620; // the eased glide between elements — slow enough to follow by eye

export function TutorialCursor({ cursor, reducedMotion }: { cursor: CursorState; reducedMotion: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: cursor.x,
        top: cursor.y,
        transform: 'translate(-50%, -50%)',
        zIndex: LAYERS.toast,
        pointerEvents: 'none',
        transition: reducedMotion ? undefined : `left ${TRAVEL_MS}ms ease-in-out, top ${TRAVEL_MS}ms ease-in-out`,
      }}
    >
      {/* the carried card rides just above-left of the ring, lifted and shadowed like a real drag */}
      {cursor.carryCardId && (
        <div style={{ position: 'absolute', left: 2, top: 2, transform: 'translate(-50%, -100%) scale(0.5)', transformOrigin: 'bottom center', pointerEvents: 'none' }}>
          <div style={{ boxShadow: STAGE.glowGold, borderRadius: 8 }}>
            <CardFace cardId={cursor.carryCardId} />
          </div>
        </div>
      )}
      {/* the ring itself — gold rim, pale centre, soft glow; the press pulse shrinks it a touch */}
      <div
        style={{
          ...ringStyle,
          transform: cursor.pressing && !reducedMotion ? 'scale(0.7)' : 'scale(1)',
          transition: reducedMotion ? undefined : 'transform 160ms ease-out',
        }}
      >
        <div style={centreStyle} />
      </div>
    </div>
  );
}

const ringStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: `3px solid ${INK.gold}`,
  background: STAGE.cardCream, // the pale centre — the same cream the cards are cut from
  boxShadow: STAGE.glowGold,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const centreStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: INK.gold,
};

// A small label the player can render beside the cursor if wanted (unused by default, kept for parity
// with the token language — a caption on cream). Exported so callers can reuse the exact styling.
export const cursorCaptionStyle: CSSProperties = {
  fontFamily: FONT.serif,
  fontSize: 12,
  color: INK.mutedBrown,
};
