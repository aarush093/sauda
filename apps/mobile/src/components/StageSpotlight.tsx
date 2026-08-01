/**
 * The centre-stage spotlight (K2 motion continuity + the owner-screenshotted bug fix). A bot's — or
 * my own — just-played card is held here so the play is SEEN, not just read (§8/I1 · F4). Three
 * fixes over the old inline spotlight:
 *
 *   1. FIT — the card is sized to the stage HEIGHT, so a tall card (e.g. a ₹10 note at 162px) can
 *      never overflow the ~117px band and sit behind the ticker. The bug the owner shot was an
 *      oversized card bleeding out of the stage; here it always fits, elevated and BRIGHT (its own
 *      gold glow, never touched by the my-area sleep dim — the spotlight is a sibling of the stage).
 *   2. REVEAL — the card eases in (scale + fade) rather than teleporting onto the stage.
 *   3. TRAVEL — when it clears it flies off toward its home (a bot's card up to their row, my card
 *      down to my area) rather than blinking out, so a play reads as one continuous motion.
 *
 * It owns its own presence: the board just passes the card id (and whether it came from an
 * opponent). When the id clears, the spotlight keeps the last card for one travel before unmounting
 * it. Transform/opacity only; `prefers-reduced-motion` shows the card with no reveal and clears it
 * with no travel.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ScaledCard } from './CardFace';
import { useMeasuredSize } from '../game/useMeasuredWidth';
import { MOTION_MS, useReducedMotion } from '../design/motion';
import { CARD, STAGE } from '../design/tokens';

const MAX_STAGE_WIDTH = 112; // the old fixed stage size — now an upper bound; height usually wins
const STAGE_PADDING = 12; // breathing room so the fitted card never kisses the band edges

// Which way a cleared card flies home: an opponent's up to their row, mine down to my area.
type Direction = 'up' | 'down';

export function StageSpotlight({
  cardId,
  fromOpponent,
}: {
  cardId: string | null;
  fromOpponent: boolean;
}) {
  const reduced = useReducedMotion();
  const [containerRef, size] = useMeasuredSize<HTMLDivElement>();
  // The card currently on stage, kept alive through its travel-out even after `cardId` clears.
  const [shown, setShown] = useState<{ cardId: string; direction: Direction } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShown = useRef(false); // read inside the effect without making `shown` a dependency

  useEffect(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    if (cardId !== null) {
      hasShown.current = true;
      setShown({ cardId, direction: fromOpponent ? 'up' : 'down' }); // reveal (or crossfade to) this card
      setLeaving(false);
      return;
    }
    // cardId cleared → travel the last card home, then unmount it (reduced motion: clear at once).
    if (!hasShown.current) {
      return;
    }
    if (reduced) {
      hasShown.current = false;
      setShown(null);
      return;
    }
    setLeaving(true);
    leaveTimer.current = setTimeout(() => {
      hasShown.current = false;
      setShown(null);
    }, MOTION_MS.travel);
  }, [cardId, fromOpponent, reduced]);

  useEffect(() => () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
    }
  }, []);

  if (!shown) {
    return <div ref={containerRef} style={containerStyle} />;
  }

  // Fit to the stage height (its natural home) but never above the old fixed width. Under jsdom the
  // measured height is 0, so fall back to the width cap.
  const heightBudget = size.height > 0 ? size.height - STAGE_PADDING : MAX_STAGE_WIDTH * CARD.ratio;
  const fittedWidth = Math.min(MAX_STAGE_WIDTH, heightBudget / CARD.ratio);

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* one card, keyed by id so a new play remounts and re-plays its reveal */}
      <SpotlightCard key={shown.cardId} cardId={shown.cardId} width={fittedWidth} leaving={leaving} direction={shown.direction} reduced={reduced} />
    </div>
  );
}

// The card itself: reveals on mount (scale + fade in), and when told it is leaving, flies toward its
// home direction and fades out. Both are the same transform/opacity transition, retimed per phase.
function SpotlightCard({
  cardId,
  width,
  leaving,
  direction,
  reduced,
}: {
  cardId: string;
  width: number;
  leaving: boolean;
  direction: Direction;
  reduced: boolean;
}) {
  const [entered, setEntered] = useState(reduced); // reduced motion: start already settled
  useEffect(() => {
    if (reduced) {
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const travelY = direction === 'up' ? -44 : 44; // fly toward the acting player's board region
  let transform: string;
  if (leaving) {
    transform = `translateY(${travelY}px) scale(0.92)`;
  } else if (entered) {
    transform = 'translateY(0) scale(1)';
  } else {
    transform = 'translateY(0) scale(0.82)';
  }
  const revealMs = reduced ? 0 : MOTION_MS.reveal;
  const travelMs = reduced ? 0 : MOTION_MS.travel;

  return (
    <div
      style={{
        borderRadius: 8,
        boxShadow: STAGE.glowGold, // the brightest thing on the stage — its own gold glow
        transform,
        opacity: leaving ? 0 : entered ? 1 : 0,
        transition: `transform ${leaving ? travelMs : revealMs}ms ease-out, opacity ${leaving ? travelMs : revealMs}ms ease-out`,
        willChange: 'transform, opacity',
      }}
    >
      <ScaledCard cardId={cardId} width={width} />
    </div>
  );
}

// The spotlight fills the stage cell and centres the card, elevated above the ticker/felt (z 4, well
// under the drag preview's z 50). pointer-events off — it is a display beat, not a target.
const containerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};
