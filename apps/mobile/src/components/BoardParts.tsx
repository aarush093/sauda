/**
 * The static presentational parts of the play table (A2), extracted from Board so the
 * board file stays a lean composer. Nothing here decides a rule — each part renders engine
 * numbers in the vintage token styles. The property parts additionally act as DROP ZONES
 * (A10): they carry a `data-drop` id and glow when a dragged card may land on them.
 */
import { SETS, isSetComplete } from '@sauda/engine';
import type { PropertyGroup, SetId } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { CardBack } from './CardBack';
import { CardFace } from './CardFace';
import { STAGE, INK, SHADOW, FONT, CARD, GLOW } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];
export const PLAYS_PER_TURN = 3; // §7 rules default; pips render 3 slots

export function seatName(seats: SeatConfig[], id: number): string {
  const seat = seats[id];
  return seat?.kind === 'bot' ? `Bot ${id} · ${seat.difficulty}` : `Player ${id}`;
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

// A property GROUP as a simplified mini-card: a set-colour banner strip + a count badge,
// a gold FULL ribbon when complete, and (mine) the engine's current rent. A2: the colour
// is the identity — no letter monogram. When droppable it carries data-drop + a glow.
function MiniGroup({
  set,
  group,
  rent,
  width,
  dropId,
  soft,
  hot,
}: {
  set: SetId;
  group: PropertyGroup;
  rent?: number | undefined;
  width: number;
  dropId?: string | undefined;
  soft?: boolean | undefined;
  hot?: boolean | undefined;
}) {
  const theme = SETS[set];
  const complete = isSetComplete(group);
  const height = Math.round(width * 1.4);
  const boxShadow = hot ? GLOW.hot : soft ? GLOW.soft : SHADOW.cardBack;
  return (
    <div
      data-drop={dropId}
      style={{ width, height, flex: '0 0 auto', position: 'relative', borderRadius: 4, overflow: 'hidden', background: STAGE.cardCream, border: `1px solid ${INK.agedLine}`, boxShadow }}
      title={`${theme.label} ${group.cards.length}/${theme.size}`}
    >
      <div style={{ height: '44%', background: theme.hex }} />
      {complete && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: STAGE.accentGold }} />}
      <div style={{ position: 'absolute', bottom: 1, left: 0, right: 0, textAlign: 'center', fontFamily: FONT.mono, fontWeight: 700, fontSize: Math.round(width * 0.22), color: INK.deepInk }}>
        {complete ? '✓' : `${group.cards.length}/${theme.size}`}
        {group.buildings.length > 0 ? `+${group.buildings.length}` : ''}
      </div>
      {rent !== undefined && (
        <div style={{ position: 'absolute', top: '46%', left: 0, right: 0, textAlign: 'center', fontFamily: FONT.mono, fontSize: Math.round(width * 0.19), color: INK.deepInk }}>
          ₹{rent}
        </div>
      )}
    </div>
  );
}

// A dashed placeholder where dragging a property/wildcard would START A NEW group of a
// colour I don't yet hold (§3). It is a drop zone in its own right.
function GhostSlot({ set, width, hot }: { set: SetId; width: number; hot: boolean }) {
  const theme = SETS[set];
  const height = Math.round(width * 1.4);
  return (
    <div
      data-drop={`set:${set}`}
      title={`New ${theme.label} set`}
      style={{ width, height, flex: '0 0 auto', borderRadius: 4, border: `1px dashed ${INK.gold}`, boxShadow: hot ? GLOW.hot : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', opacity: hot ? 1 : 0.85 }}
    >
      <div style={{ height: '44%', background: theme.hex, opacity: 0.55 }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontSize: Math.round(width * 0.3), color: STAGE.textOnFelt }}>+</div>
    </div>
  );
}

// A player's groups in a row. Mine glow as drop targets during a drag, and grow ghost
// slots for the legal colours I don't yet hold. Empty + not dragging → the G1 invitation.
export function GroupRow({
  properties,
  kiraya,
  width,
  mine,
  dropSets,
  hotZoneId,
}: {
  properties: Record<SetId, PropertyGroup[]>;
  kiraya?: Record<SetId, number[]> | undefined;
  width: number;
  mine?: boolean | undefined;
  dropSets?: Set<SetId> | undefined;
  hotZoneId?: string | null | undefined;
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
            dropId={droppable ? `set:${set}` : undefined}
            soft={droppable && !hot}
            hot={hot}
          />
        );
      })}
      {ghostSets.map((set) => (
        <GhostSlot key={`ghost-${set}`} set={set} width={width} hot={hotZoneId === `set:${set}`} />
      ))}
    </div>
  );
}

// My bank: an overlapping note stack + a mono ₹ total (G2 faint outline when empty).
export function BankStack({ count, total }: { count: number; total: number }) {
  if (count === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 34, height: 22, border: `1px dashed ${INK.agedLine}`, borderRadius: 3, opacity: 0.6 }} />
        <span style={{ fontFamily: FONT.mono, fontWeight: 700, color: STAGE.textOnFelt }}>₹0 Cr</span>
      </div>
    );
  }
  const layers = Math.min(count, 5);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 34 + (layers - 1) * 4, height: 24 }}>
        {Array.from({ length: layers }).map((_, index) => (
          <div key={index} style={{ position: 'absolute', left: index * 4, top: index * -1, width: 34, height: 22, borderRadius: 3, background: STAGE.cardCream, border: `1px solid ${INK.gold}` }} />
        ))}
      </div>
      <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 16, color: STAGE.accentGold }}>₹{total} Cr</span>
    </div>
  );
}

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
    <div style={{ width, height, filter: STAGE.dimSleep }}>
      <div style={{ transform: `scale(${width / CARD.fullWidth})`, transformOrigin: 'top left' }}>
        <CardFace cardId={topId} size="full" />
      </div>
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
  showPips,
  playsRemaining,
}: {
  name: string;
  bankTotal: number;
  handCount: number;
  active: boolean;
  showPips?: boolean | undefined;
  playsRemaining?: number | undefined;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px', borderRadius: 999, background: STAGE.scrimDrag, boxShadow: active ? STAGE.glowGold : 'none', opacity: active ? 1 : 0.6 }}>
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 13, color: STAGE.cardCream }}>{name}</span>
      <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 12, color: STAGE.accentGold }}>₹{bankTotal}</span>
      <span style={{ display: 'flex', alignItems: 'center' }} title={`${handCount} cards in hand`}>
        {Array.from({ length: Math.min(handCount, 7) }).map((_, index) => (
          <span key={index} style={{ marginLeft: index === 0 ? 0 : -8 }}>
            <CardBack width={14} seal={false} />
          </span>
        ))}
      </span>
      {showPips && (
        <span style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
          {Array.from({ length: PLAYS_PER_TURN }).map((_, index) => (
            <span key={index} style={{ width: 8, height: 8, borderRadius: '50%', background: index < (playsRemaining ?? 0) ? STAGE.accentGold : 'transparent', border: `1.5px solid ${INK.gold}` }} />
          ))}
        </span>
      )}
    </div>
  );
}
