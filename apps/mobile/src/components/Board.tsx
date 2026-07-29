/**
 * The play table (v1.2 A2/A10). A portrait, one-screen surface driven entirely by the
 * engine: every number comes from an Observation, every legal move from legalActions
 * (passed in as `actions`), every colour from design/tokens. The UI decides no rules.
 *
 * Interaction is DRAG-first (A10 L3), tap as the equal fallback (A1): drag a hand card onto
 * a glowing zone — bank, a set group / ghost slot, or centre PLAY — to commit; tap it to
 * raise it onto the stage with its verb rail instead. Which zones glow, and what a drop
 * fires, is `dropZonesForCard(legalActions)` — nothing else lifts, glows, or commits (L5).
 * Turn-flow lives on the table: auto-draw at turn start (L4), End turn in its reserved
 * right column, Declare SAUDA! centre when offered (A11), and the A8/A9 discard step.
 *
 * The static parts (groups, bank, pile, header) live in BoardParts; the hand fan and the
 * drag gesture in HandFan / useHandDrag — this file is the composer.
 */
import { useState } from 'react';
import type { CSSProperties, DOMAttributes } from 'react';
import type { Action, Observation, SetId } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { dropZonesForCard } from '../game/interaction';
import type { DropZone } from '../game/interaction';
import { useHandDrag } from '../game/useHandDrag';
import { CardFace } from './CardFace';
import { StagedCard } from './StagedCard';
import { Ticker } from './Ticker';
import { HandFan } from './HandFan';
import { BankStack, DiscardTop, DrawPile, GroupRow, PlayerHeader, seatName } from './BoardParts';
import { STAGE, INK, SHADOW, FONT, GLOW } from '../design/tokens';

const HAND_LIMIT = 7; // §4.4 / Niyam Card 3: end a turn over 7 cards and you discard down
const END_TURN_COLUMN_PX = 88; // reserved right column so the hand fan never underlaps it

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
  padding: '9px 14px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.accentGold,
  border: `1.5px solid ${INK.gold}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

// The stable id each drop zone carries in the DOM (`data-drop`), so the drag hit-test and
// the commit both name zones the same way.
function dropZoneId(zone: DropZone): string {
  if (zone.kind === 'bank') return 'bank';
  if (zone.kind === 'play') return 'play';
  return `set:${zone.set}`;
}

export function Board({
  observation,
  seats,
  actions = [],
  onAct,
  tickerLines = [],
}: {
  observation: Observation;
  seats: SeatConfig[];
  actions?: Action[];
  onAct?: (action: Action) => void;
  tickerLines?: string[];
}) {
  const myTurn = observation.currentPlayer === observation.me;
  const topDiscard = observation.discardPile[observation.discardPile.length - 1];

  // Turn-flow actions the engine offers directly (not tied to a staged hand card). DRAW is
  // NOT among them: it is auto-played at turn start (L4), never a tap.
  const endTurnAction = actions.find((action) => action.type === 'END_TURN');
  const declareWinAction = actions.find((action) => action.type === 'DECLARE_WIN');

  // Discard step (A8/A9): while over the hand limit the engine offers a DISCARD per hand
  // card and nothing else; a non-empty map means the hand taps to bury instead of playing.
  const discardByCardId = new Map<string, Action>();
  for (const action of actions) {
    if (action.type === 'DISCARD') {
      discardByCardId.set(action.cardId, action);
    }
  }
  const inDiscardMode = discardByCardId.size > 0;

  // Which hand cards respond right now: cards with a play (drag or tap → stage), or every
  // card in the discard step. Off-turn `actions` is empty, so the hand is inert.
  const stageableIds = new Set<string>();
  for (const action of actions) {
    if (action.type === 'BANK_CARD' || action.type === 'PLACE_PROPERTY' || action.type === 'PLAY_ACTION' || action.type === 'PLAY_KIRAYA') {
      stageableIds.add(action.cardId);
    }
  }
  const handTappableIds = inDiscardMode ? new Set(discardByCardId.keys()) : stageableIds;

  const [stagedCardId, setStagedCardId] = useState<string | null>(null);
  const staged = stagedCardId !== null && observation.myHand.includes(stagedCardId) ? stagedCardId : null;

  function onTapHandCard(cardId: string): void {
    if (inDiscardMode) {
      const discard = discardByCardId.get(cardId);
      if (discard && onAct) {
        onAct(discard); // bury it under the draw pile (A9); engine ends the turn at the limit
      }
      return;
    }
    setStagedCardId(cardId); // A1 fallback: rise to centre stage with its rail
  }

  function onDropHandCard(cardId: string, zoneId: string): void {
    const zone = dropZonesForCard(actions, cardId).find((candidate) => dropZoneId(candidate) === zoneId);
    if (!zone || !onAct) {
      return;
    }
    if (zone.action) {
      onAct(zone.action); // bank / place / build / an untargeted play — commits immediately
    } else {
      setStagedCardId(cardId); // a play that still needs a target → stage (rail picks it)
    }
  }

  // Drag is disabled off-turn and in the discard step (there tapping buries a card).
  function eligibleZones(cardId: string): Set<string> {
    if (inDiscardMode || !myTurn) {
      return new Set();
    }
    return new Set(dropZonesForCard(actions, cardId).map(dropZoneId));
  }

  const { drag, cardHandlers } = useHandDrag({ eligibleZones, onTap: onTapHandCard, onDrop: onDropHandCard });
  const handlersFor = (cardId: string): DOMAttributes<HTMLDivElement> => cardHandlers(cardId);

  // Which zones glow while a card is in the air (soft = eligible, hot = under the pointer).
  const dragZones = drag ? dropZonesForCard(actions, drag.cardId) : [];
  const eligibleSets = new Set<SetId>();
  let bankEligible = false;
  let playEligible = false;
  for (const zone of dragZones) {
    if (zone.kind === 'bank') bankEligible = true;
    else if (zone.kind === 'play') playEligible = true;
    else if (zone.set) eligibleSets.add(zone.set);
  }
  const hotZoneId = drag?.hotZoneId ?? null;

  const zone = (basisPct: number, extra?: CSSProperties): CSSProperties => ({ flex: `0 0 ${basisPct}%`, minHeight: 0, padding: 8, ...extra });

  return (
    <div style={boardStyle}>
      {/* opponent row (22%) — pills + their mini group stacks */}
      <div style={zone(22, { display: 'flex', gap: 8, overflow: 'hidden' })}>
        {observation.opponents.map((opponent) => (
          <div key={opponent.id} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, opacity: opponent.id === observation.currentPlayer ? 1 : 0.75 }}>
            <PlayerHeader name={seatName(seats, opponent.id)} bankTotal={opponent.bankTotal} handCount={opponent.handCount} active={opponent.id === observation.currentPlayer} />
            <div style={{ overflow: 'hidden' }}>
              <GroupRow properties={opponent.properties} width={30} />
            </div>
          </div>
        ))}
      </div>

      {/* table band (10%) — draw pile · turn chip · discard */}
      <div style={zone(10, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${STAGE.scrimSheet}`, borderBottom: `1px solid ${STAGE.scrimSheet}` })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* L4: the pile is display only — the turn-start draw is automatic, never a tap. */}
          <DrawPile count={observation.drawPileCount} />
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

      {/* centre stage (30%) — the 2-line ticker (§8), then open felt / the tapped card's
          overlay / the centre PLAY drop zone / the Declare SAUDA! button (A11). */}
      <div style={zone(30, { display: 'flex', flexDirection: 'column' })}>
        <Ticker lines={tickerLines} />
        <div data-drop="play" style={{ flex: 1, minHeight: 0, margin: '0 8px 6px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: hotZoneId === 'play' ? GLOW.hot : playEligible ? GLOW.soft : 'none' }}>
          {declareWinAction && onAct ? (
            <button onClick={() => onAct(declareWinAction)} style={goldFilledButton}>Declare SAUDA!</button>
          ) : playEligible ? (
            <span style={{ fontFamily: FONT.display, fontWeight: 700, color: STAGE.accentGold }}>Play</span>
          ) : null}
        </div>
      </div>

      {/* my area (38%) — the largest zone (hierarchy law A2); sleeps when it isn't my turn. */}
      <div style={zone(38, { display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${STAGE.scrimSheet}`, filter: myTurn ? undefined : STAGE.dimSleep, overflow: 'hidden' })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <PlayerHeader name="You" bankTotal={observation.myBankTotal} handCount={observation.myHand.length} active={myTurn} showPips playsRemaining={observation.playsRemaining} />
          {/* the bank is a drop zone for money / bankable actions (never a wildcard). */}
          <div data-drop="bank" style={{ borderRadius: 8, padding: 3, boxShadow: hotZoneId === 'bank' ? GLOW.hot : bankEligible ? GLOW.soft : 'none' }}>
            <BankStack count={observation.myBank.length} total={observation.myBankTotal} />
          </div>
        </div>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <GroupRow properties={observation.myProperties} kiraya={observation.myKiraya} width={38} mine dropSets={eligibleSets} hotZoneId={hotZoneId} />
        </div>
        {inDiscardMode && (
          <div style={{ textAlign: 'center', fontFamily: FONT.display, fontWeight: 700, fontSize: 13, color: STAGE.accentGold }}>
            Over the limit — tap {observation.myHand.length - HAND_LIMIT} to discard
          </div>
        )}
        {/* bottom row: the hand fan (flex) + a reserved column for End turn (right thumb, A2)
            so the fan never underlaps the control. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 'auto' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <HandFan cards={observation.myHand} interactiveIds={handTappableIds} draggingId={drag?.cardId ?? null} handlersFor={handlersFor} />
          </div>
          <div style={{ width: END_TURN_COLUMN_PX, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
            {endTurnAction && onAct && (
              <button onClick={() => onAct(endTurnAction)} style={goldOutlineButton}>End turn</button>
            )}
          </div>
        </div>
      </div>

      {/* the floating drag preview — lifted above the finger, pointer-events:none so it never
          hides the drop zone beneath it from the hit-test. */}
      {drag && (
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ transform: 'translate(-50%, -100%) translateY(-32px) scale(0.62)', transformOrigin: 'bottom center' }}>
            <div style={{ boxShadow: SHADOW.dragLift, borderRadius: 8 }}>
              <CardFace cardId={drag.cardId} size="full" />
            </div>
          </div>
        </div>
      )}

      {/* centre-stage overlay: a tapped card rises here with its action rail (A1 fallback). */}
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

const boardStyle: CSSProperties = {
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
};
