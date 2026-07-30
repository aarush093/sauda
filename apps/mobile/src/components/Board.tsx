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
import type { CSSProperties } from 'react';
import type { Action, Observation, SetId } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { dropZonesForCard, rearrangeDestinations } from '../game/interaction';
import type { DropZone } from '../game/interaction';
import { useHandDrag } from '../game/useHandDrag';
import type { DragState } from '../game/useFanGesture';
import { describeCard } from '../game/labels';
import { CardFace, ScaledCard } from './CardFace';
import { InspectCard } from './InspectCard';
import { DiscardOverlay } from './DiscardOverlay';
import { TableView } from './TableView';
import { TargetingOverlay } from './TargetingOverlay';
import { RearrangeChooser } from './RearrangeChooser';
import { Ticker } from './Ticker';
import { HandWheel } from './HandWheel';
import { MunshiChip } from './MunshiChip';
import { BankStack, DiscardTop, DrawPile, GroupRow, OpponentGroupStrip, PlayerHeader, seatName } from './BoardParts';
import { STAGE, INK, SHADOW, FONT, GLOW } from '../design/tokens';


const STAGE_CARD_PX = 112; // the centre-stage spotlight card — bigger than a table card, fully readable

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
// A placed wildcard's rearrange handle (B8): drag it onto a group, or tap for the chooser.
const rearrangeToken: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  border: `1px solid ${INK.gold}`,
  color: STAGE.accentGold,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 11,
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
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
  spotlightCardId = null,
  autoEnding = false,
}: {
  observation: Observation;
  seats: SeatConfig[];
  actions?: Action[];
  onAct?: (action: Action) => void;
  tickerLines?: string[];
  spotlightCardId?: string | null; // a bot's held card (I1) or the human's just-played beat (F4)
  autoEnding?: boolean; // F2: the turn is auto-ending — hide the manual End turn button
}) {
  const myTurn = observation.currentPlayer === observation.me;
  const topDiscard = observation.discardPile[observation.discardPile.length - 1];

  // Turn-flow actions the engine offers directly (not tied to a staged hand card). DRAW is
  // NOT among them: it is auto-played at turn start (L4), never a tap.
  const endTurnAction = actions.find((action) => action.type === 'END_TURN');
  const declareWinAction = actions.find((action) => action.type === 'DECLARE_WIN');

  // The Munshi advisor is offered ONLY on my own play turn while I have legal moves (H-rows);
  // its 3-use budget lives in the store. This just gates WHEN the chip may be consulted — a
  // response window passes `actions=[]`, and the discard step isn't the 'playing' phase.
  const munshiAvailable = myTurn && observation.phase === 'playing' && actions.length > 0;

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
  // In the discard step the wheel goes inert — the full-screen DiscardOverlay (G3) owns discarding.
  const handTappableIds = inDiscardMode ? new Set<string>() : stageableIds;

  // G1 (owner playtest 2): a tapped hand card rises to INSPECT — read-only, no buttons, no engine
  // action. Drag is the only commit path from hand. (Supersedes the A1 tap→stage→rail.)
  const [inspectingCardId, setInspectingCardId] = useState<string | null>(null);
  const inspecting = inspectingCardId !== null && observation.myHand.includes(inspectingCardId) ? inspectingCardId : null;

  // Tap-to-expand table view (G4): whose full board is open, if any ('me' or an opponent seat).
  const [expandedView, setExpandedView] = useState<{ kind: 'me' } | { kind: 'opponent'; id: number } | null>(null);

  // A targeted action mid-play: its card is on stage and legal targets glow (A10 targeting).
  // Cleared automatically once the card leaves the hand (committed) or the turn passes.
  const [targetingCardId, setTargetingCardId] = useState<string | null>(null);
  const targeting = targetingCardId !== null && observation.myHand.includes(targetingCardId) ? targetingCardId : null;

  // Placed wildcards I may move this turn (free, matrix B8). Each rearrange token can be
  // dragged onto a legal group or tapped to open the destination chooser.
  const rearrangeableIds = new Set<string>();
  for (const action of actions) {
    if (action.type === 'REARRANGE_WILDCARD') {
      rearrangeableIds.add(action.cardId);
    }
  }
  const [rearrangingCardId, setRearrangingCardId] = useState<string | null>(null);
  const rearranging = rearrangingCardId !== null && rearrangeableIds.has(rearrangingCardId) ? rearrangingCardId : null;

  // A tap either opens the rearrange chooser (a placed wildcard) or raises a hand card to INSPECT
  // (G1 — read-only, never an engine action). A drop routes to the commit. Discarding is the
  // DiscardOverlay's job now (G3), so the wheel is inert in the discard step and never taps here.
  function onTapCard(cardId: string): void {
    if (rearrangeableIds.has(cardId)) {
      setRearrangingCardId(cardId);
      return;
    }
    setInspectingCardId(cardId); // G1: tap = inspect, no action; drag is the only commit path
  }

  function onDropCard(cardId: string, zoneId: string): void {
    if (!onAct) {
      return;
    }
    if (rearrangeableIds.has(cardId)) {
      const destination = rearrangeDestinations(actions, cardId).find((target) => `set:${target.set}` === zoneId);
      if (destination) {
        onAct(destination.action); // B8: move the placed wildcard, free
      }
      return;
    }
    const zone = dropZonesForCard(actions, cardId).find((candidate) => dropZoneId(candidate) === zoneId);
    if (!zone) {
      return;
    }
    setInspectingCardId(null); // a committed drag closes any open inspect (G1)
    if (zone.action) {
      onAct(zone.action); // bank / place / build / an untargeted play — commits immediately
    } else {
      setTargetingCardId(cardId); // a play that still needs a target → glow the legal targets
    }
  }

  function eligibleZones(cardId: string): Set<string> {
    if (rearrangeableIds.has(cardId)) {
      return new Set(rearrangeDestinations(actions, cardId).map((target) => `set:${target.set}`));
    }
    if (inDiscardMode || !myTurn) {
      return new Set(); // drag disabled off-turn and in the discard step (tapping buries there)
    }
    return new Set(dropZonesForCard(actions, cardId).map(dropZoneId));
  }

  // Two drag sources feed one board drag: the hand-fan scrub (useFanGesture, reported up from
  // HandFan) and the placed-wildcard rearrange token (useHandDrag). They are mutually exclusive
  // — you can only carry one thing — so the board reads whichever is active.
  const { drag: rearrangeDrag, cardHandlers } = useHandDrag({ eligibleZones, onTap: onTapCard, onDrop: onDropCard });
  const [fanDrag, setFanDrag] = useState<DragState | null>(null);
  const [inspectDrag, setInspectDrag] = useState<DragState | null>(null); // a drag begun on the inspected card
  const drag = fanDrag ?? rearrangeDrag ?? inspectDrag;

  // Which zones glow while a card is in the air (soft = eligible, hot = under the pointer).
  // A placed wildcard being dragged lights only its legal destination groups (B8).
  const eligibleSets = new Set<SetId>();
  let bankEligible = false;
  let playEligible = false;
  if (drag && rearrangeableIds.has(drag.cardId)) {
    for (const target of rearrangeDestinations(actions, drag.cardId)) {
      eligibleSets.add(target.set);
    }
  } else if (drag) {
    for (const zone of dropZonesForCard(actions, drag.cardId)) {
      if (zone.kind === 'bank') bankEligible = true;
      else if (zone.kind === 'play') playEligible = true;
      else if (zone.set) eligibleSets.add(zone.set);
    }
  }
  const hotZoneId = drag?.hotZoneId ?? null;

  const zone = (basisPct: number, extra?: CSSProperties): CSSProperties => ({ flex: `0 0 ${basisPct}%`, minHeight: 0, padding: 8, ...extra });

  return (
    <div style={boardStyle}>
      {/* opponent row (21%, G4 zone retune) — pills + their REAL card cascades; tap a row to expand
          to that opponent's full readable table view. */}
      <div style={zone(21, { display: 'flex', gap: 8, overflow: 'hidden' })}>
        {observation.opponents.map((opponent) => (
          <div key={opponent.id} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, opacity: opponent.id === observation.currentPlayer ? 1 : 0.75 }}>
            <PlayerHeader name={seatName(seats, opponent.id)} bankTotal={opponent.bankTotal} handCount={opponent.handCount} active={opponent.id === observation.currentPlayer} />
            <OpponentGroupStrip properties={opponent.properties} onExpand={() => setExpandedView({ kind: 'opponent', id: opponent.id })} />
          </div>
        ))}
      </div>

      {/* table band (9%) — draw pile · turn chip · discard */}
      <div style={zone(9, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${STAGE.scrimSheet}`, borderBottom: `1px solid ${STAGE.scrimSheet}` })}>
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

      {/* centre stage (28%, G4 zone retune) — the 2-line ticker (§8), then open felt / the tapped
          card's overlay / the centre PLAY drop zone / the Declare SAUDA! button (A11). */}
      <div style={zone(28, { display: 'flex', flexDirection: 'column' })}>
        <Ticker lines={tickerLines} />
        <div data-drop="play" style={{ flex: 1, minHeight: 0, margin: '0 8px 6px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: hotZoneId === 'play' ? GLOW.hot : playEligible ? GLOW.soft : 'none' }}>
          {spotlightCardId ? (
            // The bot's card held on stage (I1), or the human's just-played card for a beat (F4) —
            // the real full CardFace at stage size, both sides (G4 CENTRE STAGE).
            <div style={{ boxShadow: STAGE.glowGold, borderRadius: 8 }}>
              <ScaledCard cardId={spotlightCardId} width={STAGE_CARD_PX} />
            </div>
          ) : declareWinAction && onAct ? (
            <button onClick={() => onAct(declareWinAction)} style={goldFilledButton}>Declare SAUDA!</button>
          ) : playEligible ? (
            <span style={{ fontFamily: FONT.display, fontWeight: 700, color: STAGE.accentGold }}>Play</span>
          ) : null}
        </div>
      </div>

      {/* my area (42%, G4 zone retune) — still the largest zone (hierarchy law A2); sleeps off-turn. */}
      <div style={zone(42, { display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${STAGE.scrimSheet}`, filter: myTurn ? undefined : STAGE.dimSleep, overflow: 'hidden' })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <PlayerHeader name="You" bankTotal={observation.myBankTotal} handCount={observation.myHand.length} active={myTurn} showPips playsRemaining={observation.playsRemaining} />
            {/* Munshi chip by my avatar — its own read-only decision surface (never pushes layout,
                never collides with the End-turn column below). */}
            <MunshiChip available={munshiAvailable} />
          </div>
          {/* the bank is a drop zone for money / bankable actions (never a wildcard). */}
          <div data-drop="bank" style={{ borderRadius: 8, padding: 3, flexShrink: 0, whiteSpace: 'nowrap', boxShadow: hotZoneId === 'bank' ? GLOW.hot : bankEligible ? GLOW.soft : 'none' }}>
            <BankStack count={observation.myBank.length} total={observation.myBankTotal} />
          </div>
        </div>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <GroupRow properties={observation.myProperties} kiraya={observation.myKiraya} width={38} mine dropSets={eligibleSets} hotZoneId={hotZoneId} onExpand={() => setExpandedView({ kind: 'me' })} />
        </div>
        {rearrangeableIds.size > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT.serif, fontSize: 11, opacity: 0.8 }}>Move wildcard:</span>
            {[...rearrangeableIds].map((id) => (
              // {...data-card-id} is a dev-only capture marker (see HandFan) — tree-shaken from prod.
              <div key={id} {...cardHandlers(id)} {...(import.meta.env.DEV && { 'data-card-id': id })} onContextMenu={(event) => event.preventDefault()} style={{ ...rearrangeToken, opacity: drag?.cardId === id ? 0.3 : 1 }}>
                ◈ {describeCard(id).replace('Wildcard ', '')}
              </div>
            ))}
          </div>
        )}
        {/* bottom band: the hand WHEEL (G2), hub at bottom-centre, spanning the full my-area. End
            turn floats in the clear bottom-right corner (the wheel's cards converge to the centre
            hub, so nothing reaches there) — usually hidden anyway, since F2 auto-ends most turns. */}
        <div style={{ position: 'relative', marginTop: 'auto' }}>
          <HandWheel
            cards={observation.myHand}
            interactiveIds={handTappableIds}
            drag={drag}
            eligibleZones={eligibleZones}
            onTap={onTapCard}
            onDrop={onDropCard}
            onDragChange={setFanDrag}
          />
          {endTurnAction && onAct && !autoEnding && (
            <button onClick={() => onAct(endTurnAction)} style={{ ...goldOutlineButton, position: 'absolute', right: 4, bottom: 8, zIndex: 3 }}>
              End turn
            </button>
          )}
        </div>
      </div>

      {/* the floating drag preview — lifted above the finger, pointer-events:none so it never
          hides the drop zone beneath it from the hit-test. */}
      {drag && (
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ transform: 'translate(-50%, -100%) translateY(-32px) scale(0.62)', transformOrigin: 'bottom center' }}>
            <div style={{ boxShadow: SHADOW.dragLift, borderRadius: 8 }}>
              <CardFace cardId={drag.cardId} />
            </div>
          </div>
        </div>
      )}

      {/* rearrange (B8): the tap fallback — a placed wildcard's legal destination groups. */}
      {rearranging !== null && onAct && (
        <RearrangeChooser
          cardId={rearranging}
          destinations={rearrangeDestinations(actions, rearranging)}
          onChoose={(action) => {
            onAct(action);
            setRearrangingCardId(null);
          }}
          onCancel={() => setRearrangingCardId(null)}
        />
      )}

      {/* targeting: a dragged targeted action plants on stage and its legal targets glow;
          one tap fires the exact enumerated move (BAD_TARGET unreachable), Cancel = no play. */}
      {targeting !== null && onAct && (
        <TargetingOverlay
          cardId={targeting}
          actions={actions}
          me={observation.me}
          onCommit={(action) => {
            onAct(action);
            setTargetingCardId(null);
          }}
          onCancel={() => setTargetingCardId(null)}
        />
      )}

      {/* discard step (G3 · A8/A9): over the hand limit, a full-screen L2 overlay spreads every
          hand card as a real face; tapping one buries it under the draw pile. Nothing else is live. */}
      {inDiscardMode && onAct && (
        <DiscardOverlay
          cards={observation.myHand}
          onDiscard={(cardId) => {
            const discard = discardByCardId.get(cardId);
            if (discard) {
              onAct(discard);
            }
          }}
        />
      )}

      {/* tap-to-expand table view (G4): an opponent's row, or one of my groups, opens their full
          board as large real cards. Read-only; tap off to close. */}
      {expandedView !== null && (() => {
        if (expandedView.kind === 'me') {
          return (
            <TableView
              title="You"
              properties={observation.myProperties}
              bankTotal={observation.myBankTotal}
              kiraya={observation.myKiraya}
              onClose={() => setExpandedView(null)}
            />
          );
        }
        const opponent = observation.opponents.find((candidate) => candidate.id === expandedView.id);
        return opponent ? (
          <TableView
            title={seatName(seats, opponent.id)}
            properties={opponent.properties}
            bankTotal={opponent.bankTotal}
            onClose={() => setExpandedView(null)}
          />
        ) : null;
      })()}

      {/* inspect overlay (G1): a tapped hand card rises here CENTRED + LARGE, read-only — no
          buttons, no engine action. Tap to dismiss, or drag it straight to a zone to commit. */}
      {inspecting !== null && targeting === null && onAct && (
        <InspectCard
          cardId={inspecting}
          actions={actions}
          eligibleZones={eligibleZones}
          onDrop={onDropCard}
          onDismiss={() => setInspectingCardId(null)}
          onDragChange={setInspectDrag}
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
