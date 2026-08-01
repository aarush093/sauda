/**
 * The static presentational parts of the play table (A2), extracted from Board so the
 * board file stays a lean composer. Nothing here decides a rule — each part renders engine
 * numbers in the vintage token styles. The property parts additionally act as DROP ZONES
 * (A10): they carry a `data-drop` id and glow when a dragged card may land on them.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { SETS } from '@sauda/engine';
import type { PropertyGroup, SetId } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { CardBack } from './CardBack';
import { ScaledCard } from './CardFace';
import { SetCascade } from './SetCascade';
import { useMeasuredWidth } from '../game/useMeasuredWidth';
import { STAGE, INK, FONT, CARD, GLOW, LAYERS } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];
export const PLAYS_PER_TURN = 3; // §7 rules default; pips render 3 slots

// F5 (owner playtest 30 Jul): in-play pills show the NAME only — the difficulty word was noise
// repeated on every bot. Difficulty stays a setup-screen concern.
export function seatName(seats: SeatConfig[], id: number): string {
  return seats[id]?.kind === 'bot' ? `Bot ${id}` : `Player ${id}`;
}

function nonEmptyGroups(properties: Record<SetId, PropertyGroup[]>): { set: SetId; group: PropertyGroup; index: number }[] {
  const out: { set: SetId; group: PropertyGroup; index: number }[] = [];
  for (const set of ALL_SETS) {
    properties[set].forEach((group, index) => {
      if (group.cards.length > 0) {
        out.push({ set, group, index });
      }
    });
  }
  return out;
}

// The per-card pointer handlers the rearrange handle spreads (from useHandDrag) — one closure that
// yields tap-vs-drag handlers for a card id.
type CardHandlers = (cardId: string) => {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
};

// P7: a placed wildcard I may move this turn (B8) carries its OWN ◈ handle now, ON the card, instead
// of the old "Move wildcard:" chip row down on the play surface. Drag the handle to move it (primary,
// K1); tap it to open the destination chooser. This is the shape MiniGroup needs to render them.
interface GroupRearrange {
  handlers: CardHandlers;
  cardIds: string[]; // the rearrangeable wildcard ids that live in THIS group
  draggingId: string | null; // the card being carried right now — faded here
}

// A property GROUP as a CASCADE of real cards (G4 LAW — no banner+count chip). It carries the
// drop-zone id + glow when a dragged card may land on it, and taps open the full table view.
function MiniGroup({
  set,
  group,
  rent,
  width,
  dropId,
  soft,
  hot,
  onExpand,
  expandHint,
  rearrange,
}: {
  set: SetId;
  group: PropertyGroup;
  rent?: number | undefined;
  width: number;
  dropId?: string | undefined;
  soft?: boolean | undefined;
  hot?: boolean | undefined;
  onExpand?: (() => void) | undefined;
  expandHint?: boolean | undefined; // J4 touch audit: show a visible "tap to enlarge" glyph (my groups)
  rearrange?: GroupRearrange | undefined; // P7: ◈ handles for this group's movable wildcards
}) {
  const theme = SETS[set];
  const boxShadow = hot ? GLOW.hot : soft ? GLOW.soft : undefined;
  return (
    <div
      data-drop={dropId}
      onClick={onExpand}
      style={{ flex: '0 0 auto', position: 'relative', borderRadius: 6, boxShadow, cursor: onExpand ? 'pointer' : undefined }}
      title={`${theme.label} ${group.cards.length}/${theme.size} — tap to expand`}
    >
      <SetCascade group={group} width={width} rent={rent} />
      {/* J4 touch audit: on a touch screen there's no cursor, so tap-to-expand needs a VISIBLE mark —
          the same ⤢ the opponent pills got (H1a). Top-left corner (clear of the FULL / rent / building
          badges), on a small translucent chip so it reads over any plate art at board-cascade size. */}
      {expandHint && (
        <span aria-hidden style={expandHintStyle}>⤢</span>
      )}
      {/* P7: the ◈ rearrange handle(s) — one per movable wildcard in this group, top-right, stacked.
          It stops the group's expand-tap (its own tap opens the chooser), captures the drag itself. */}
      {rearrange?.cardIds.map((cardId, index) => (
        <div
          key={cardId}
          {...rearrange.handlers(cardId)}
          {...(import.meta.env.DEV && { 'data-card-id': cardId })}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          title="Move this wildcard — drag to a set, or tap"
          style={{ ...rearrangeHandleStyle, top: 2 + index * 20, opacity: rearrange.draggingId === cardId ? 0.3 : 1 }}
        >
          ◈
        </div>
      ))}
    </div>
  );
}

// The ◈ handle: a small gold token pinned top-right ON the placed wildcard's group.
const rearrangeHandleStyle: CSSProperties = {
  position: 'absolute',
  right: 2,
  zIndex: LAYERS.badge,
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: `1px solid ${INK.gold}`,
  background: STAGE.scrimSheet,
  color: STAGE.accentGold,
  fontSize: 11,
  lineHeight: '16px',
  textAlign: 'center',
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
};

const expandHintStyle: CSSProperties = {
  position: 'absolute',
  top: 2,
  left: 2,
  zIndex: LAYERS.badge,
  padding: '0 2px',
  borderRadius: 3,
  background: STAGE.scrimSheet,
  color: STAGE.accentGold,
  fontFamily: FONT.mono,
  fontSize: 10,
  lineHeight: 1.2,
  pointerEvents: 'none', // purely a hint; the whole cascade already taps
};

// A dashed placeholder where dragging a property/wildcard would START A NEW group of a
// colour I don't yet hold (§3). It is a drop zone in its own right — unless `dropId` is undefined
// (P3: while the inflated drop band is up, the band owns the data-drop so there is only one target).
function GhostSlot({ set, width, hot, onClick, dropId }: { set: SetId; width: number; hot: boolean; onClick?: (() => void) | undefined; dropId?: string | undefined }) {
  const theme = SETS[set];
  const height = Math.round(width * 1.4);
  return (
    <div
      data-drop={dropId}
      onClick={onClick}
      title={`New ${theme.label} set`}
      style={{ width, height, flex: '0 0 auto', borderRadius: 4, border: `1px dashed ${INK.gold}`, boxShadow: hot ? GLOW.hot : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', opacity: hot ? 1 : 0.85, cursor: onClick ? 'pointer' : undefined }}
    >
      <div style={{ height: '44%', background: theme.hex, opacity: 0.55 }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontSize: Math.round(width * 0.3), color: STAGE.textOnFelt }}>+</div>
    </div>
  );
}

// A player's groups in a row. Mine glow as drop targets during a drag, and grow ghost
// slots for the legal colours I don't yet hold. Empty + not dragging → the G1 invitation.
// Tapping any of my groups opens my full table view (G4).
export function GroupRow({
  properties,
  kiraya,
  width,
  mine,
  dropSets,
  hotZoneId,
  onExpand,
  onSetPlace,
  suppressDrop,
  rearrange,
}: {
  properties: Record<SetId, PropertyGroup[]>;
  kiraya?: Record<SetId, number[]> | undefined;
  width: number;
  mine?: boolean | undefined;
  dropSets?: Set<SetId> | undefined;
  hotZoneId?: string | null | undefined;
  onExpand?: (() => void) | undefined;
  // G6: while placing a received card, tapping a glowing set (or ghost slot) places it there
  // instead of opening the expand view.
  onSetPlace?: ((set: SetId) => void) | undefined;
  // P3: while the inflated thumb drop band is up, drop the in-place data-drop ids so the band is the
  // one target per set (the cascades still render, just no longer as tiny drop zones).
  suppressDrop?: boolean | undefined;
  // P7: the ◈ rearrange handles for my movable wildcards, rendered ON their group (not a chip row).
  rearrange?: GroupRearrange | undefined;
}) {
  const groups = nonEmptyGroups(properties);
  const existing = new Set(groups.map((entry) => entry.set));
  const ghostSets = dropSets ? [...dropSets].filter((set) => !existing.has(set)) : [];

  if (groups.length === 0 && ghostSets.length === 0) {
    if (!mine) {
      return null;
    }
    return (
      <div style={{ height: Math.round(width * 1.4), border: `1px dashed ${INK.agedLine}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STAGE.textOnFelt, fontFamily: FONT.serif, fontSize: 13, opacity: 0.75 }}>
        Place your first deed
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignContent: 'flex-start' }}>
      {groups.map(({ set, group, index }) => {
        const droppable = Boolean(mine && dropSets?.has(set));
        const hot = hotZoneId === `set:${set}`;
        return (
          <MiniGroup
            key={`${set}-${index}`}
            set={set}
            group={group}
            width={width}
            rent={mine ? kiraya?.[set]?.[index] : undefined}
            dropId={droppable && !suppressDrop ? `set:${set}` : undefined}
            soft={droppable && !hot && !suppressDrop}
            hot={hot && !suppressDrop}
            onExpand={onSetPlace ? () => onSetPlace(set) : onExpand}
            // show the ⤢ only when the tap actually EXPANDS (not during receive-placement, where the
            // glowing sets are the affordance and a tap places the card instead).
            expandHint={!onSetPlace && Boolean(onExpand)}
            rearrange={
              rearrange
                ? { ...rearrange, cardIds: group.cards.filter((cardId) => rearrange.cardIds.includes(cardId)) }
                : undefined
            }
          />
        );
      })}
      {ghostSets.map((set) => (
        <GhostSlot
          key={`ghost-${set}`}
          set={set}
          width={width}
          hot={hotZoneId === `set:${set}` && !suppressDrop}
          onClick={onSetPlace ? () => onSetPlace(set) : undefined}
          dropId={suppressDrop ? undefined : `set:${set}`}
        />
      ))}
    </div>
  );
}

// F5 (owner playtest 30 Jul): an opponent's groups on ONE row that never grows the 22% zone. It
// measures its column and shrinks the mini-cards so every group fits; if they would fall below a
// legible minimum, it shows as many as fit at that minimum plus a "+n" chip for the rest. So a
// late-game opponent with many sets never wraps into extra rows or clips — the strip adapts.
const OPP_GAP_PX = 2;
const OPP_MIN_CARD_PX = 14;
const OPP_MAX_CARD_PX = 26;
const OPP_CHIP_PX = 22;

export function OpponentGroupStrip({
  properties,
}: {
  properties: Record<SetId, PropertyGroup[]>;
}) {
  const [containerRef, measured] = useMeasuredWidth<HTMLDivElement>();
  const groups = nonEmptyGroups(properties);
  const available = measured || 104; // per-opponent column width before it is measured

  let cardWidth = OPP_MAX_CARD_PX;
  let shownCount = groups.length;
  if (groups.length > 0) {
    const fitAll = Math.floor((available - (groups.length - 1) * OPP_GAP_PX) / groups.length);
    if (fitAll >= OPP_MIN_CARD_PX) {
      cardWidth = Math.min(OPP_MAX_CARD_PX, fitAll); // everything fits — just size to the column
    } else {
      cardWidth = OPP_MIN_CARD_PX; // too many — pack at the minimum and overflow the rest into "+n"
      shownCount = Math.max(1, Math.min(groups.length, Math.floor((available - OPP_CHIP_PX - OPP_GAP_PX) / (OPP_MIN_CARD_PX + OPP_GAP_PX))));
    }
  }
  const overflow = groups.length - shownCount;

  // Tiny but REAL cascades (G4); the whole opponent COLUMN taps open to their full table view (the
  // click + visible affordance live on the column now — H1a), so this strip is purely presentational.
  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', gap: OPP_GAP_PX, alignItems: 'flex-start', overflow: 'hidden' }}
    >
      {groups.slice(0, shownCount).map(({ set, group, index }) => (
        <SetCascade key={`${set}-${index}`} group={group} width={cardWidth} />
      ))}
      {overflow > 0 && (
        <div
          title={`+${overflow} more set${overflow === 1 ? '' : 's'}`}
          style={{
            width: OPP_CHIP_PX,
            height: Math.round(OPP_MIN_CARD_PX * 1.4),
            flex: '0 0 auto',
            borderRadius: 4,
            border: `1px solid ${INK.gold}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT.mono,
            fontWeight: 700,
            fontSize: 9,
            color: STAGE.accentGold,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// My bank: an overlapping note stack + a mono ₹ total (G2 faint outline when empty).
// The face-down draw pile: up to three card backs offset to read as a stack.
export function DrawPile({ count }: { count: number }) {
  const layers = Math.min(Math.max(count, 1), 3);
  return (
    <div style={{ position: 'relative', width: 38 + 6, height: Math.round(38 * CARD.ratio) + 6 }}>
      {Array.from({ length: layers }).map((_, index) => {
        const offset = (layers - 1 - index) * 3;
        return (
          <div key={index} style={{ position: 'absolute', top: offset, left: offset }}>
            <CardBack width={38} seal={index === layers - 1} />
          </div>
        );
      })}
    </div>
  );
}

// The discard pile: its top card face, quiet and desaturated (a spent card).
export function DiscardTop({ topId }: { topId: string | undefined }) {
  const width = 38;
  const height = Math.round(width * CARD.ratio);
  if (!topId) {
    return <div style={{ width, height, border: `1px dashed ${INK.agedLine}`, borderRadius: 4, opacity: 0.5 }} />;
  }
  return (
    <div style={{ filter: STAGE.dimSleep }}>
      <ScaledCard cardId={topId} width={width} />
    </div>
  );
}

// A player's header pill: name, gold ₹ bank total, hidden-hand pips, and (the active
// player) the gold ring + play pips. Inactive players sit dim.
export function PlayerHeader({
  name,
  bankTotal,
  handCount,
  active,
  self,
  expandable,
}: {
  name: string;
  bankTotal: number;
  handCount: number;
  active: boolean;
  self?: boolean | undefined; // MY pill: drop the redundant hand chrome so End turn fits (H2b)
  expandable?: boolean | undefined; // H1a: show a visible "tap to expand" glyph (opponent pills)
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px', borderRadius: 999, background: STAGE.scrimDrag, boxShadow: active ? STAGE.glowGold : 'none', opacity: active ? 1 : 0.6 }}>
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 13, color: STAGE.cardCream }}>{name}</span>
      <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 12, color: STAGE.accentGold }}>₹{bankTotal}</span>
      {/* Hidden-hand card-backs are meaningful only for OPPONENTS (I see my own hand in the wheel).
          My own pill drops them, AND drops the play-pips (plays-left already reads in the table band,
          and the pips clashed with the Munshi chip's) — so the header has clean room for End turn
          (H2b) at any bank total. */}
      {!self && (
        <span style={{ display: 'flex', alignItems: 'center' }} title={`${handCount} cards in hand`}>
          {Array.from({ length: Math.min(handCount, 7) }).map((_, index) => (
            <span key={index} style={{ marginLeft: index === 0 ? 0 : -8 }}>
              <CardBack width={14} seal={false} />
            </span>
          ))}
        </span>
      )}
      {/* H1a: a small gold expand mark so an opponent pill visibly reads as "tap to open" on touch
          (no cursor there) — the discoverability the pass-2 report admitted only my own groups had. */}
      {expandable && (
        <span aria-hidden style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 11, color: STAGE.accentGold, opacity: 0.85 }}>⤢</span>
      )}
    </div>
  );
}
