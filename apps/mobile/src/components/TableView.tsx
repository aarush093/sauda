/**
 * The tap-to-expand TABLE VIEW (G4 LAW, owner playtest 2). Tapping an opponent's row — or one of my
 * own groups — opens this full-screen L2 overlay: the felt blurs behind a scrim, that player's name
 * and bank total sit up top, and all their sets render as LARGE real card cascades, fully readable.
 * Tap anywhere off the cards to close. It reads only the Observation the board already has; it
 * decides nothing and dispatches nothing.
 */
import type { CSSProperties } from 'react';
import { SETS } from '@sauda/engine';
import type { PropertyGroup, SetId } from '@sauda/engine';
import { SetCascade } from './SetCascade';
import { STAGE, FONT } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];
const EXPAND_CARD_PX = 92; // large + readable — the point of the expand

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

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={headerStyle}>
        <span style={titleStyle}>{title}</span>
        <span style={bankStyle}>Bank ₹{bankTotal} Cr</span>
      </div>
      {/* the cards themselves swallow the tap so it doesn't close while reading a set */}
      <div style={gridStyle} onClick={(event) => event.stopPropagation()}>
        {groups.length === 0 ? (
          <div style={emptyStyle}>No sets on the table yet.</div>
        ) : (
          groups.map(({ set, group, index }) => (
            <div key={`${set}-${index}`} style={groupColumnStyle}>
              <div style={setLabelStyle}>{SETS[set].label}</div>
              <SetCascade group={group} width={EXPAND_CARD_PX} rent={kiraya?.[set]?.[index]} />
            </div>
          ))
        )}
      </div>
      <div style={hintStyle}>Tap anywhere to close</div>
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
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 };
const titleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 18, color: STAGE.cardCream };
const bankStyle: CSSProperties = { fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, color: STAGE.accentGold };
const gridStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  justifyContent: 'center',
  alignContent: 'flex-start',
  overflow: 'hidden',
};
const groupColumnStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 };
const setLabelStyle: CSSProperties = { fontFamily: FONT.serif, fontWeight: 700, fontSize: 11, color: STAGE.cardCream };
const emptyStyle: CSSProperties = { fontFamily: FONT.serif, fontStyle: 'italic', color: STAGE.textOnFelt, opacity: 0.8 };
const hintStyle: CSSProperties = { fontFamily: FONT.serif, fontSize: 11, color: STAGE.textOnFelt, opacity: 0.7 };
