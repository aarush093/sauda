/**
 * The tap-to-expand TABLE VIEW (G4 LAW, owner playtest 2). Tapping an opponent's row — or one of my
 * own groups — opens this full-screen L2 overlay: the felt blurs behind a scrim, that player's name
 * and bank total sit up top, and all their sets render as LARGE real card cascades, fully readable.
 * Tap anywhere off the cards to close. It reads only the Observation the board already has; it
 * decides nothing and dispatches nothing.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { SETS } from '@sauda/engine';
import type { PropertyGroup, SetId } from '@sauda/engine';
import { SetCascade } from './SetCascade';
import { Surface } from './Surface';
import { STAGE, INK, FONT } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];
const EXPAND_CARD_PX = 96; // K5 legibility floor: cards render at >= 96px wide (was 92)
// J1: opening this view mounts ~10 large (92 px) real cards — measured, painting all of them in the
// single open frame cost 66 ms under 4× throttle (well over the 33 ms ceiling). So we reveal ONE group
// per frame instead of all at once: the end state is identical (every card shown within ~8 frames,
// ≈130 ms) but the worst frame only paints a single group's cards. This is a load-spread, not a
// designed animation — nothing eases, cards just appear a frame or two apart.
const REVEAL_BATCH = 1;

export function TableView({
  title,
  properties,
  bankTotal,
  kiraya,
  onClose,
}: {
  title: string;
  properties: Record<SetId, PropertyGroup[]>;
  bankTotal: number;
  kiraya?: Record<SetId, number[]> | undefined; // my current rents per group; opponents show none
  onClose: () => void;
}) {
  const groups: { set: SetId; group: PropertyGroup; index: number }[] = [];
  for (const set of ALL_SETS) {
    properties[set].forEach((group, index) => {
      if (group.cards.length > 0) {
        groups.push({ set, group, index });
      }
    });
  }

  // J1: how many groups have been mounted so far. Starts at ZERO so the FIRST frame paints only the
  // shell (scrim + blur + header) — the frame that already carries the board re-render and the
  // backdrop-blur setup — then grows a batch per animation frame until every group is shown. So no
  // single frame does the shell AND the cards; the heavy card mount is spread across later frames.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (revealed >= groups.length) {
      return; // all groups mounted — stop scheduling
    }
    const frame = requestAnimationFrame(() => setRevealed((count) => count + REVEAL_BATCH));
    return () => cancelAnimationFrame(frame);
  }, [revealed, groups.length]);

  return (
    // K5 ESCAPE: the full-screen backdrop owns the tap — a tap literally ANYWHERE off a card closes
    // the view. Only the card columns below swallow the tap (so you can read a set without closing).
    <div style={overlayStyle} onClick={onClose}>
      {/* K5: an explicit close control, top-right, in addition to the tap-anywhere backdrop. */}
      <button type="button" onClick={onClose} style={closeXStyle} aria-label="Close">✕</button>
      <Surface style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>{title}</span>
          <span style={bankStyle}>Bank ₹{bankTotal} Cr</span>
        </div>
        {/* a rich board scrolls INTERNALLY (modal internal scroll — spec-compliant) rather than
            clipping, so every set stays reachable at the >= 96px legibility floor. */}
        <div style={gridStyle}>
          {groups.length === 0 ? (
            <div style={emptyStyle}>No sets on the table yet.</div>
          ) : (
            groups.slice(0, revealed).map(({ set, group, index }) => (
              <div key={`${set}-${index}`} style={groupColumnStyle} onClick={(event) => event.stopPropagation()}>
                <div style={setLabelStyle}>{SETS[set].label}</div>
                <SetCascade group={group} width={EXPAND_CARD_PX} rent={kiraya?.[set]?.[index]} />
              </div>
            ))
          )}
        </div>
        <div style={hintStyle}>Tap anywhere off a card — or ✕ — to close</div>
      </Surface>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 7,
  background: STAGE.scrimSheet,
  backdropFilter: 'blur(3px)', // static blur (no animation — M4c owns motion)
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  padding: 14,
  overflow: 'hidden',
};
// The panel holds the header + scrolling grid + hint, and eases in (Surface). Fills the overlay.
const panelStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
};
// The close ✕ — a gold token, top-right, clear of the header.
const closeXStyle: CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  zIndex: 1,
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: `1.5px solid ${INK.gold}`,
  background: 'transparent',
  color: STAGE.accentGold,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 15,
  lineHeight: 1,
  cursor: 'pointer',
};
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 };
const titleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 18, color: STAGE.cardCream };
const bankStyle: CSSProperties = { fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, color: STAGE.accentGold };
const gridStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  alignSelf: 'stretch',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  justifyContent: 'center',
  alignContent: 'flex-start',
  overflowY: 'auto', // K5: a rich board scrolls internally rather than clipping
};
const groupColumnStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 };
const setLabelStyle: CSSProperties = { fontFamily: FONT.serif, fontWeight: 700, fontSize: 11, color: STAGE.cardCream };
const emptyStyle: CSSProperties = { fontFamily: FONT.serif, fontStyle: 'italic', color: STAGE.textOnFelt, opacity: 0.8 };
const hintStyle: CSSProperties = { fontFamily: FONT.serif, fontSize: 11, color: STAGE.textOnFelt, opacity: 0.7 };
