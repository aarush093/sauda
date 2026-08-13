/**
 * The bot TAB RAIL (LAYOUT v3 — owner landscape directive, 2 Aug). Focus follows turn: on MY turn the
 * bot boards do NOT render in full — instead this slim vertical rail sits on the far edge, one chip
 * per bot, each a glanceable summary (seat, a note-stack + COUNT of banked cards — S2: their exact
 * cash is private, only the stack SIZE is public — set count, a FULL badge if any set is complete, a
 * gold ring on the active player). Tapping a chip opens that bot's full board zoom (the
 * TableView, landscape-adapted). In spectate the acting bot fills the main panel, so the caller passes
 * only the NON-acting bots here.
 *
 * It reads only the Observation the board already has, and decides no rule — a tap just asks the board
 * to open a read-only zoom.
 */
import type { CSSProperties } from 'react';
import { SETS, isSetComplete } from '@sauda/engine';
import type { OpponentView, PropertyGroup, SetId } from '@sauda/engine';
import { opponentBankLabel } from '../game/redaction';
import { STAGE, INK, FONT } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];

// How many colours this player holds a group of, and whether ANY of those groups is a complete set.
// Public info (their board is face-up), so the rail can show it without touching hidden state.
function boardSummary(properties: Record<SetId, PropertyGroup[]>): { setCount: number; hasFull: boolean } {
  let setCount = 0;
  let hasFull = false;
  for (const set of ALL_SETS) {
    for (const group of properties[set]) {
      if (group.cards.length > 0) {
        setCount += 1;
        if (isSetComplete(group)) {
          hasFull = true;
        }
      }
    }
  }
  return { setCount, hasFull };
}

export function BotTabRail({
  opponents,
  activeId,
  width,
  onOpen,
}: {
  opponents: OpponentView[];
  activeId: number; // the current player — a bot here wears the gold ring
  width: number; // the rail column width (from landscapeLayout)
  onOpen: (id: number) => void;
}) {
  return (
    <div style={{ ...railStyle, width }}>
      {opponents.map((opponent) => {
        const { setCount, hasFull } = boardSummary(opponent.properties);
        const active = opponent.id === activeId;
        return (
          <button
            key={opponent.id}
            type="button"
            onClick={() => onOpen(opponent.id)}
            title={`Bot ${opponent.id} — tap to see their full board`}
            style={chipStyle(active)}
          >
            <span style={seatStyle}>B{opponent.id}</span>
            {/* S2: the note-stack glyph + COUNT of banked cards — visible info (you can see how many
                notes someone holds); their exact cash total is private (never rendered). */}
            <span style={bankStyle} title="Banked cards (count only — their cash is hidden)">
              {opponentBankLabel(opponent.bank.length)}
            </span>
            <span style={setsStyle}>▦ {setCount}</span>
            {hasFull && <span style={fullBadgeStyle}>FULL</span>}
          </button>
        );
      })}
    </div>
  );
}

// The rail: a full-height column on the far edge, chips stacked top-down, scrolling internally if a
// 4-bot table ever overflows the short landscape height (legal — internal scroll, not the page). The
// top padding clears the in-game home/pause glyph (⌂), which lives fixed at the top-left over the rail
// — so the glyph reads as the rail's cap and the first bot chip starts cleanly beneath it (no overlap).
const railStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '46px 3px 4px',
  overflowY: 'auto',
  flexShrink: 0,
};

// One bot chip. The active player wears the one gold ring (glowGold); the rest sit quiet.
function chipStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    padding: '5px 2px',
    borderRadius: 8,
    border: `1px solid ${INK.gold}`,
    background: STAGE.scrimSheet,
    boxShadow: active ? STAGE.glowGold : 'none',
    opacity: active ? 1 : 0.85,
    cursor: 'pointer',
    flexShrink: 0,
  };
}

const seatStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 13, color: STAGE.cardCream };
const bankStyle: CSSProperties = { fontFamily: FONT.mono, fontWeight: 700, fontSize: 11, color: STAGE.accentGold };
const setsStyle: CSSProperties = { fontFamily: FONT.mono, fontSize: 10, color: STAGE.textOnFelt };
// The FULL badge — the same stamp-red danger token the completed-set row uses, so "someone is one
// move from winning" reads at a glance from the rail.
const fullBadgeStyle: CSSProperties = {
  marginTop: 1,
  padding: '0 3px',
  borderRadius: 3,
  background: INK.stampRed,
  color: STAGE.cardCream,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: 0.3,
};
