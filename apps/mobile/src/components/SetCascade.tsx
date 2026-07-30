/**
 * A property set as a CASCADE of real cards (G4 LAW, owner playtest 2). Every card in the group is
 * a scaled full CardFace, overlapped downward so each card's top banner strip stays visible; the
 * group's SET rent rides as a small gold badge ON the stack (never a replacement for the cards), a
 * FULL ribbon marks a complete set, and any buildings (MAKAAN/HAVELI) show as a small "+N". This
 * renders at any width — compact on the board, large in the tap-to-expand table view — because
 * ScaledCard keeps the face pixel-identical at every size. No symbolic banner-and-count chip, ever.
 */
import type { CSSProperties } from 'react';
import { isSetComplete } from '@sauda/engine';
import type { PropertyGroup } from '@sauda/engine';
import { ScaledCard } from './CardFace';
import { CARD, STAGE, INK, FONT } from '../design/tokens';

const BANNER_STRIP = 0.26; // each stacked card reveals ~the top 26% (banner + value badge) of the next

export function SetCascade({
  group,
  width,
  rent,
}: {
  group: PropertyGroup;
  width: number;
  rent?: number | undefined; // the engine's current rent for this set (mine); omitted for opponents
}) {
  const complete = isSetComplete(group);
  const cardHeight = Math.round(width * CARD.ratio);
  const step = Math.max(10, Math.round(cardHeight * BANNER_STRIP));
  const cards = group.cards;
  const stackHeight = cardHeight + step * Math.max(0, cards.length - 1);
  const badgeFontSize = Math.max(7, Math.round(width * 0.18));
  return (
    <div style={{ position: 'relative', width, height: stackHeight }}>
      {cards.map((id, index) => (
        <div key={id} style={{ position: 'absolute', top: index * step, left: 0, zIndex: index }}>
          <ScaledCard cardId={id} width={width} />
        </div>
      ))}
      {/* the FULL ribbon (complete set) and the SET rent badge ride ON the stack, top-right. */}
      {complete && <div style={{ ...ribbonStyle, fontSize: Math.max(6, Math.round(width * 0.15)) }}>FULL</div>}
      {rent !== undefined && (
        <div style={{ ...rentBadgeStyle, fontSize: badgeFontSize }}>₹{rent}</div>
      )}
      {group.buildings.length > 0 && (
        <div style={{ ...buildingBadgeStyle, fontSize: badgeFontSize }}>+{group.buildings.length}</div>
      )}
    </div>
  );
}

const ribbonStyle: CSSProperties = {
  position: 'absolute',
  top: 2,
  right: 2,
  zIndex: 100,
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  letterSpacing: '0.04em',
  padding: '0 3px',
  borderRadius: 2,
};
const rentBadgeStyle: CSSProperties = {
  position: 'absolute',
  bottom: 2,
  right: 2,
  zIndex: 100,
  background: INK.gold,
  color: INK.deepInk,
  fontFamily: FONT.mono,
  fontWeight: 700,
  padding: '0 3px',
  borderRadius: 3,
  whiteSpace: 'nowrap',
};
const buildingBadgeStyle: CSSProperties = {
  position: 'absolute',
  bottom: 2,
  left: 2,
  zIndex: 100,
  background: INK.stampRed,
  color: INK.cardCream,
  fontFamily: FONT.mono,
  fontWeight: 700,
  padding: '0 3px',
  borderRadius: 3,
};
