/**
 * A property set as a CASCADE of real cards (G4 LAW, owner playtest 2). Every card in the group is
 * a scaled full CardFace, overlapped downward so each card's top banner strip stays visible; the
 * group's SET rent rides as a small gold badge ON the stack (never a replacement for the cards), a
 * FULL ribbon marks a complete set, and any buildings (MAKAAN/HAVELI) show as a small "+N". This
 * renders at any width — compact on the board, large in the tap-to-expand table view — because
 * ScaledCard keeps the face pixel-identical at every size. No symbolic banner-and-count chip, ever.
 */
import { memo } from 'react';
import type { CSSProperties } from 'react';
import { isSetComplete } from '@sauda/engine';
import type { PropertyGroup } from '@sauda/engine';
import { ScaledCard } from './CardFace';
import { CARD, STAGE, INK, FONT, LAYERS } from '../design/tokens';
import { tallyRender } from '../game/renderTally';

const BANNER_STRIP = 0.26; // each stacked card reveals ~the top 26% (banner + value badge) of the next

// H4: memoised — a cascade depends only on its group + width + rent, all referentially stable across
// a drag (the observation doesn't change mid-drag), so it skips re-render when the board re-renders to
// move a zone glow. Its ScaledCard children are memoised too, so the real card faces never re-run.
export const SetCascade = memo(function SetCascade({
  group,
  width,
  rent,
}: {
  group: PropertyGroup;
  width: number;
  rent?: number | undefined; // the engine's current rent for this set (mine); omitted for opponents
}) {
  if (import.meta.env.DEV) tallyRender('SetCascade');
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
}, sameCascade);

// J1: the engine rebuilds its Observation — and every PropertyGroup inside it — on EVERY dispatch, so
// the default reference memo MISSES on every commit: measured, banking a single card re-ran ~44
// SetCascades (their faces are memoised so the plates didn't repaint, but the wrapper reconcile still
// cost the frame, pushing the commit over the 33 ms ceiling). PropertyGroup.cards / .buildings are
// arrays of stable string ids, so comparing CONTENT instead of identity lets an unchanged cascade skip
// the re-render entirely — a cascade re-renders only when its cards, buildings, width or rent actually
// change. This makes every commit that doesn't touch a given group free for that group.
function sameCascade(prev: { group: PropertyGroup; width: number; rent?: number | undefined }, next: { group: PropertyGroup; width: number; rent?: number | undefined }): boolean {
  return prev.width === next.width && prev.rent === next.rent && sameIds(prev.group.cards, next.group.cards) && sameIds(prev.group.buildings, next.group.buildings);
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

const ribbonStyle: CSSProperties = {
  position: 'absolute',
  top: 2,
  right: 2,
  zIndex: LAYERS.badge,
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
  zIndex: LAYERS.badge,
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
  zIndex: LAYERS.badge,
  background: INK.stampRed,
  color: INK.cardCream,
  fontFamily: FONT.mono,
  fontWeight: 700,
  padding: '0 3px',
  borderRadius: 3,
};
