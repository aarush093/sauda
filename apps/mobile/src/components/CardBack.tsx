/**
 * A face-down card: the vintage card-back plate (ornate deep-red arabesque) with the
 * सौ seal in its empty centre medallion. Shown wherever hidden cards render — the
 * draw pile, opponent hands, and the pass-and-play handoff. The art is symmetrical,
 * so orientation never matters. Falls back to a plain table-indigo card + seal if the
 * plate is missing.
 */
import { CARD, INK, FONT, SHADOW } from '../design/tokens';
import { cardBackUrl } from '../design/plates';

export function CardBack({ width, seal = true }: { width: number; seal?: boolean }) {
  const url = cardBackUrl();
  const height = Math.round(width * CARD.ratio);
  // A large raster back downscaled to a tiny hand-count pip reads jagged (F4). Below this width we
  // skip the image and show a clean vintage-indigo tile with the gold keyline — crisp at any size.
  const showArt = Boolean(url) && width >= 24;
  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        flex: '0 0 auto',
        borderRadius: Math.max(2, Math.round(width * 0.1)),
        overflow: 'hidden',
        border: `1px solid ${INK.agedLine}`,
        background: INK.tableIndigo,
        boxShadow: SHADOW.cardBack,
      }}
    >
      {showArt && (
        <img
          src={url ?? undefined}
          alt=""
          aria-hidden
          decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* सौ seal in the empty centre medallion — the live-layer brand mark on the back */}
      {seal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: INK.stampRed,
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: Math.max(6, Math.round(width * 0.26)),
          }}
        >
          सौ
        </div>
      )}
    </div>
  );
}
