/**
 * The play table (v1.2 A1/A2/A10). A portrait, one-screen surface driven entirely by the
 * engine: every number comes from an Observation, every legal move from legalActions
 * (passed in as `actions`), every colour from design/tokens. The UI decides no rules — it
 * renders what the engine offers and dispatches the player's choice back.
 *
 * Four zones by the spec's percentages (A2): opponent row 22% · table band 10% · centre
 * stage 30% · my area 38% (always the largest — the hierarchy law). Interaction is
 * tap → centre stage → rail (A1): tapping a legal hand card raises it into the overlay
 * with its verb rail. Turn-flow lives on the table itself — tap the glowing draw pile to
 * draw, End turn sits bottom-right (right thumb), Declare SAUDA! appears centre when a win
 * is offered (A11), and a discard step (A8/A9) turns the hand tappable when it's over the
 * limit. Two visual states (A5): rest, and DIM_SLEEP on my board/hand when off-turn.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { SETS, isSetComplete } from '@sauda/engine';
import type { Action, Observation, PropertyGroup, SetId } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { CardBack } from './CardBack';
import { CardFace } from './CardFace';
import { StagedCard } from './StagedCard';
import { STAGE, INK, SHADOW, FONT, CARD } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];
const PLAYS_PER_TURN = 3; // §7 rules default; pips render 3 slots
const HAND_LIMIT = 7; // §4.4 / Niyam Card 3: end a turn over 7 cards and you discard down

// Turn-flow buttons. Gold-filled = a committing/celebratory action (Declare SAUDA!);
// gold-outline = a quiet, always-available control (End turn, A6 "never pulses/nags").
// Same gold tokens as the action rail — one accent, no variants (A5).
const goldFilledButton: CSSProperties = {
  padding: '12px 22px',
  borderRadius: 999,
  border: 'none',
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};
const goldOutlineButton: CSSProperties = {
  padding: '9px 16px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.accentGold,
  border: `1.5px solid ${INK.gold}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
const endTurnButtonStyle: CSSProperties = { ...goldOutlineButton, position: 'absolute', right: 10, bottom: 10 };

function seatName(seats: SeatConfig[], id: number): string {
  const seat = seats[id];
  if (seat?.kind === 'bot') {
    return `Bot ${id} · ${seat.difficulty}`;
  }
  return `Player ${id}`;
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

// A property GROUP shown as a simplified mini-card: a set-colour banner strip + a
// count badge, a gold FULL ribbon when complete, and (for my own groups) the engine's
// current rent. No detailed art at this size — the colour is the identity.
function MiniGroup({ set, group, rent, width }: { set: SetId; group: PropertyGroup; rent?: number | undefined; width: number }) {
  const theme = SETS[set];
  const complete = isSetComplete(group);
  const height = Math.round(width * 1.4);
  return (
    <div
      style={{
        width,
        height,
        flex: '0 0 auto',
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        background: STAGE.cardCream,
        border: `1px solid ${INK.agedLine}`,
        boxShadow: SHADOW.cardBack,
      }}
      title={`${theme.label} ${group.cards.length}/${theme.size}`}
    >
      {/* A2: mini-cards are a coloured banner strip + count badge ONLY — no letter
          monogram. The set colour is the identity; the readable name lives on the full
          CardFace, never at this size. */}
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

// A row of a player's groups. For my own empty area, the inviting G1 empty state.
function GroupRow({
  properties,
  kiraya,
  width,
  mine,
}: {
  properties: Record<SetId, PropertyGroup[]>;
  kiraya?: Record<SetId, number[]>;
  width: number;
  mine?: boolean;
}) {
  const groups = nonEmptyGroups(properties);
  if (groups.length === 0) {
    if (!mine) {
      return null;
    }
    return (
      <div
        style={{
          height: Math.round(width * 1.4),
          border: `1px dashed ${INK.agedLine}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: STAGE.textOnFelt,
          fontFamily: FONT.serif,
          fontSize: 13,
          opacity: 0.75,
        }}
      >
        Place your first deed
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignContent: 'flex-start' }}>
      {groups.map(({ set, group, index }) => (
        <MiniGroup key={`${set}-${index}`} set={set} group={group} width={width} rent={mine ? kiraya?.[set]?.[index] : undefined} />
      ))}
    </div>
  );
}

// My bank: an overlapping note stack (motif, sized by note count) + a mono ₹ total.
// Empty → the faint note outline (G2).
function BankStack({ count, total }: { count: number; total: number }) {
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
          <div
            key={index}
            style={{
              position: 'absolute',
              left: index * 4,
              top: index * -1,
              width: 34,
              height: 22,
              borderRadius: 3,
              background: STAGE.cardCream,
              border: `1px solid ${INK.gold}`,
            }}
          />
        ))}
      </div>
      <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 16, color: STAGE.accentGold }}>₹{total} Cr</span>
    </div>
  );
}

// My hand: a wide overlapping arc of real CardFace cards (reused, scaled to the zone).
// Readable at rest for up to 7; 8 (pre-discard) compresses, never scrolls.
const HAND_SCALE = 0.6;
function HandFan({
  cards,
  tappableIds,
  onTapCard,
}: {
  cards: string[];
  tappableIds: Set<string>;
  onTapCard: (cardId: string) => void;
}) {
  const cardWidth = Math.round(CARD.fullWidth * HAND_SCALE);
  const cardHeight = Math.round(CARD.fullWidth * CARD.ratio * HAND_SCALE);
  const advance = Math.round(cardWidth * 0.68); // ~68% step → ~7–8 fit the portrait width
  const count = cards.length;
  if (count === 0) {
    return <div style={{ height: cardHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STAGE.textOnFelt, opacity: 0.6 }}>—</div>;
  }
  const spread = cardWidth + advance * (count - 1);
  const mid = (count - 1) / 2;
  return (
    <div style={{ height: cardHeight + 10, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      <div style={{ position: 'relative', width: spread, height: cardHeight }}>
        {cards.map((id, i) => {
          // Only cards the engine offers an action for right now respond to a tap (§4
          // legality-at-a-glance) — a play to stage, or a discard when over the limit.
          const tappable = tappableIds.has(id);
          return (
            <div
              key={id}
              onClick={tappable ? () => onTapCard(id) : undefined}
              style={{
                position: 'absolute',
                left: i * advance,
                bottom: Math.abs(i - mid) * -1.5, // shallow arc — ends dip slightly
                transform: `rotate(${(i - mid) * 2.5}deg)`,
                transformOrigin: 'bottom center',
                cursor: tappable ? 'pointer' : 'default',
              }}
            >
              <div style={{ width: cardWidth, height: cardHeight }}>
                <div style={{ transform: `scale(${HAND_SCALE})`, transformOrigin: 'top left' }}>
                  <CardFace cardId={id} size="full" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The face-down draw pile: up to three card backs offset to read as a stack.
function DrawPile({ count }: { count: number }) {
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
function DiscardTop({ topId }: { topId: string | undefined }) {
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
// player) the single gold ring + play pips. Inactive players sit dim.
function PlayerHeader({
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
  showPips?: boolean;
  playsRemaining?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '3px 8px',
        borderRadius: 999,
        background: STAGE.scrimDrag,
        boxShadow: active ? STAGE.glowGold : 'none',
        opacity: active ? 1 : 0.6,
      }}
    >
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
            <span
              key={index}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: index < (playsRemaining ?? 0) ? STAGE.accentGold : 'transparent',
                border: `1.5px solid ${INK.gold}`,
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

export function Board({
  observation,
  seats,
  actions = [],
  onAct,
}: {
  observation: Observation;
  seats: SeatConfig[];
  actions?: Action[];
  onAct?: (action: Action) => void;
}) {
  const myTurn = observation.currentPlayer === observation.me;
  const topDiscard = observation.discardPile[observation.discardPile.length - 1];

  // Turn-flow actions the engine offers directly (not tied to a staged hand card). Each is
  // a single legal move; the matching control below dispatches it. `undefined` = not legal
  // now, so the control simply isn't rendered — legality drives the UI, never the reverse.
  const drawAction = actions.find((action) => action.type === 'DRAW');
  const endTurnAction = actions.find((action) => action.type === 'END_TURN');
  const declareWinAction = actions.find((action) => action.type === 'DECLARE_WIN');

  // Discard step (A8/A9): while over the hand limit the engine offers a DISCARD per hand
  // card and nothing else. Collect them so a tap on the fan buries that card; a non-empty
  // map means we are in discard mode and the hand taps discard instead of staging.
  const discardByCardId = new Map<string, Action>();
  for (const action of actions) {
    if (action.type === 'DISCARD') {
      discardByCardId.set(action.cardId, action);
    }
  }
  const inDiscardMode = discardByCardId.size > 0;

  // Which hand cards respond to a tap, and what the tap does. In normal play it stages a
  // card that has a legal play (money to bank, property to place, action/kiraya to play);
  // in the discard step it buries the tapped card. Off-turn `actions` is empty, so the
  // hand is inert (and already sleeps under DIM_SLEEP).
  const stageableIds = new Set<string>();
  for (const action of actions) {
    if (action.type === 'BANK_CARD' || action.type === 'PLACE_PROPERTY' || action.type === 'PLAY_ACTION' || action.type === 'PLAY_KIRAYA') {
      stageableIds.add(action.cardId);
    }
  }
  const handTappableIds = inDiscardMode ? new Set(discardByCardId.keys()) : stageableIds;

  // The tapped card, held in local UI state. Derive `staged` so the overlay clears itself
  // once the card leaves the hand (committed) or the turn passes — never a stale card.
  const [stagedCardId, setStagedCardId] = useState<string | null>(null);
  const staged = stagedCardId !== null && observation.myHand.includes(stagedCardId) ? stagedCardId : null;

  function onTapHandCard(cardId: string): void {
    if (inDiscardMode) {
      const discard = discardByCardId.get(cardId);
      if (discard && onAct) {
        onAct(discard); // bury it under the draw pile (house rule A9); engine ends the turn at the limit
      }
      return;
    }
    setStagedCardId(cardId); // rise to centre stage with its rail (A1)
  }

  const zone = (basisPct: number, extra?: CSSProperties): CSSProperties => ({
    flex: `0 0 ${basisPct}%`,
    minHeight: 0,
    padding: 8,
    ...extra,
  });

  return (
    <div
      style={{
        width: 'min(96vw, 460px)',
        height: 'min(90vh, 780px)',
        margin: '0 auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: STAGE.felt,
        color: STAGE.textOnFelt,
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: FONT.serif,
      }}
    >
      {/* opponent row (22%) — pills + their mini group stacks */}
      <div style={zone(22, { display: 'flex', gap: 8, overflow: 'hidden' })}>
        {observation.opponents.map((opponent) => (
          <div key={opponent.id} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, opacity: opponent.id === observation.currentPlayer ? 1 : 0.75 }}>
            <PlayerHeader
              name={seatName(seats, opponent.id)}
              bankTotal={opponent.bankTotal}
              handCount={opponent.handCount}
              active={opponent.id === observation.currentPlayer}
            />
            <div style={{ overflow: 'hidden' }}>
              <GroupRow properties={opponent.properties} width={30} />
            </div>
          </div>
        ))}
      </div>

      {/* table band (10%) — draw pile · turn chip · discard */}
      <div style={zone(10, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${STAGE.scrimSheet}`, borderBottom: `1px solid ${STAGE.scrimSheet}` })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* A2: draw by tapping the pile itself — no separate Draw button. It wears the
              gold glow only while DRAW is legal (law 3: a zone glows iff it's actionable). */}
          <div
            onClick={drawAction && onAct ? () => onAct(drawAction) : undefined}
            style={{ borderRadius: 6, cursor: drawAction ? 'pointer' : 'default', boxShadow: drawAction ? STAGE.glowGold : 'none' }}
          >
            <DrawPile count={observation.drawPileCount} />
          </div>
          <span style={{ fontFamily: FONT.mono, fontSize: 12 }}>{observation.drawPileCount}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 13, color: myTurn ? STAGE.accentGold : STAGE.cardCream }}>
            {myTurn ? 'Your turn' : `${seatName(seats, observation.currentPlayer)}'s turn`}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, opacity: 0.8 }}>{observation.playsRemaining} plays left</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 12 }}>{observation.discardPile.length}</span>
          <DiscardTop topId={topDiscard} />
        </div>
      </div>

      {/* centre stage (30%) — open felt at rest; the tapped card's overlay (rendered at the
          end of this component) rises here with its rail. A11: when the engine offers a win,
          the stage carries the single gold Declare SAUDA! button — the one celebration. */}
      <div style={zone(30, { display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
        {declareWinAction && onAct && (
          <button onClick={() => onAct(declareWinAction)} style={goldFilledButton}>
            Declare SAUDA!
          </button>
        )}
      </div>

      {/* my area (38%) — the largest zone (hierarchy law A2); sleeps when it isn't my turn.
          position:relative so the End turn button can float bottom-right (right thumb). */}
      <div style={zone(38, { position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${STAGE.scrimSheet}`, filter: myTurn ? undefined : STAGE.dimSleep, overflow: 'hidden' })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <PlayerHeader
            name="You"
            bankTotal={observation.myBankTotal}
            handCount={observation.myHand.length}
            active={myTurn}
            showPips
            playsRemaining={observation.playsRemaining}
          />
          <BankStack count={observation.myBank.length} total={observation.myBankTotal} />
        </div>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <GroupRow properties={observation.myProperties} kiraya={observation.myKiraya} width={38} mine />
        </div>
        {inDiscardMode && (
          <div style={{ textAlign: 'center', fontFamily: FONT.display, fontWeight: 700, fontSize: 13, color: STAGE.accentGold }}>
            Over the limit — tap {observation.myHand.length - HAND_LIMIT} to discard
          </div>
        )}
        <div style={{ marginTop: 'auto' }}>
          <HandFan cards={observation.myHand} tappableIds={handTappableIds} onTapCard={onTapHandCard} />
        </div>
        {/* End turn — always available while it's a legal move (A6: enabled, never nags);
            hidden during the forced discard step, where the engine ends the turn for you. */}
        {endTurnAction && onAct && (
          <button onClick={() => onAct(endTurnAction)} style={endTurnButtonStyle}>
            End turn
          </button>
        )}
      </div>

      {/* centre-stage overlay: the tapped card rises here with its action rail (v1.2 A1) */}
      {staged !== null && onAct && (
        <StagedCard
          cardId={staged}
          actions={actions}
          onAct={(action) => {
            onAct(action);
            setStagedCardId(null);
          }}
          onCancel={() => setStagedCardId(null)}
        />
      )}
    </div>
  );
}
