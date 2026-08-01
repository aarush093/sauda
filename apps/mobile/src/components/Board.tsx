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
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Action, CardId, Observation, SetId } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { dropZonesForCard, rearrangeDestinations } from '../game/interaction';
import type { DropZone } from '../game/interaction';
import { useHandDrag } from '../game/useHandDrag';
import { useMeasuredHeight } from '../game/useMeasuredWidth';
import { resolveZones } from '../game/zoneLayout';
import { useDragController } from '../game/useDragController';
import type { CarrySpec } from '../game/useDragController';
import { cardVerbHint } from '../game/labels';
import { CardFace, ScaledCard } from './CardFace';
import { DropBand } from './DropBand';
import { StageSpotlight } from './StageSpotlight';
import { InspectCard } from './InspectCard';
import { DiscardOverlay } from './DiscardOverlay';
import { TableView } from './TableView';
import { TargetingOverlay } from './TargetingOverlay';
import { RearrangeChooser } from './RearrangeChooser';
import { Ticker } from './Ticker';
import { HandWheel } from './HandWheel';
import { MunshiChip } from './MunshiChip';
import { TurnToken } from './TurnToken';
import { DiscardTop, DrawPile, GroupRow, OpponentGroupStrip, PlayerHeader, seatName } from './BoardParts';
import { BankTray } from './BankTray';
import { STAGE, INK, SHADOW, FONT, GLOW, LAYERS } from '../design/tokens';
import { tallyRender } from '../game/renderTally';


const STAGE_CARD_PX = 112; // the received-card stage size — bigger than a table card, fully readable

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
  spotlightFromOpponent = false,
  receive = null,
  paused = false,
}: {
  observation: Observation;
  seats: SeatConfig[];
  actions?: Action[];
  onAct?: (action: Action) => void;
  tickerLines?: string[];
  spotlightCardId?: string | null; // a bot's held card (I1) or the human's just-played beat (F4)
  spotlightFromOpponent?: boolean; // K2: an opponent's card travels UP to their row, mine DOWN to my area
  paused?: boolean | undefined; // P8: the pause sheet is open → freeze the turn token's auto-end drain
  // G6: a wildcard reached me as payment and needs a group (matrix C7). It lands on stage; its
  // legal destination sets glow; I drag it home (or tap a glowing set). bySet maps each legal set
  // to the exact RESPOND_PLACE_RECEIVED the engine enumerated.
  receive?: { cardId: CardId; bySet: Map<SetId, Action>; onPlace: (action: Action) => void } | null;
}) {
  if (import.meta.env.DEV) tallyRender('Board');
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

  // P3 "no silent mystery": a release that commits to nothing leaves a short-lived hint + a pulse of
  // the eligible zones (if the card HAD any) or the card's F7 why-line (if it had no legal play).
  // Nothing ever just springs home unexplained.
  const [missFeedback, setMissFeedback] = useState<{ hint: string; pulseSets: SetId[]; pulseBank: boolean } | null>(null);
  useEffect(() => {
    if (!missFeedback) {
      return;
    }
    const timer = setTimeout(() => setMissFeedback(null), 1600);
    return () => clearTimeout(timer);
  }, [missFeedback]);

  function onMissCard(cardId: string): void {
    const zones = eligibleZones(cardId);
    if (zones.size > 0) {
      const pulseSets = [...zones].filter((id) => id.startsWith('set:')).map((id) => id.slice(4) as SetId);
      setMissFeedback({ hint: 'Drop it on a glowing set', pulseSets, pulseBank: zones.has('bank') });
    } else {
      // A card with no legal play at all (dragged from inspect) — teach the rule, don't stonewall (F7).
      const why = cardVerbHint(cardId)?.reason ?? 'No legal play for this card right now.';
      setMissFeedback({ hint: why, pulseSets: [], pulseBank: false });
    }
  }

  // ONE drag controller owns every carry (K1): the hand-fan scrub, the placed-wildcard rearrange
  // token, a received card, and the inspect overlay all feed it, so there is a single springy,
  // magnetic, flingable floating preview. The board reads its `preview` (aliased `drag` below, so
  // the existing zone-glow + floating-preview code is untouched).
  const dragCtl = useDragController();
  const preview = dragCtl.preview;

  // The main carry spec — the hand wheel, the rearrange token and the inspect overlay all commit
  // through onDropCard using the board's own eligibleZones (both derived above from legalActions).
  const mainSpec: CarrySpec = { eligibleZones, onCommit: onDropCard, onMiss: onMissCard };
  const startMainDrag = (cardId: string, x: number, y: number) => dragCtl.begin(cardId, x, y, mainSpec);
  const { cardHandlers } = useHandDrag({
    onTap: onTapCard,
    onDragStart: startMainDrag,
    onDragMove: dragCtl.move,
    onDragEnd: dragCtl.release,
    onDragCancel: dragCtl.cancel,
  });

  // G6: the received card on stage is draggable onto a glowing destination set (tap a set as the
  // fallback). Both fire the exact RESPOND_PLACE_RECEIVED the engine enumerated for that set.
  function placeReceivedIn(set: SetId): void {
    if (!receive) {
      return;
    }
    const action = receive.bySet.get(set);
    if (action) {
      receive.onPlace(action);
    }
  }
  const receiveZones = (_cardId: string): Set<string> =>
    receive ? new Set([...receive.bySet.keys()].map((set) => `set:${set}`)) : new Set();
  const receiveSpec: CarrySpec = {
    eligibleZones: receiveZones,
    onCommit: (_cardId, zoneId) => {
      if (zoneId.startsWith('set:')) {
        placeReceivedIn(zoneId.slice(4) as SetId);
      }
    },
    onMiss: () => setMissFeedback({ hint: 'Drop it on a glowing set', pulseSets: [], pulseBank: false }),
  };
  const { cardHandlers: receiveHandlers } = useHandDrag({
    onTap: () => {}, // a plain tap on the staged received card does nothing — placement is on the sets
    onDragStart: (cardId, x, y) => dragCtl.begin(cardId, x, y, receiveSpec),
    onDragMove: dragCtl.move,
    onDragEnd: dragCtl.release,
    onDragCancel: dragCtl.cancel,
  });
  const drag = preview;
  // K3: a placed-wildcard rearrange being carried right now — it pauses the turn token's auto-end
  // drain (a rearrange is free and may still be made after the plays are spent).
  const rearrangeActive = preview !== null && rearrangeableIds.has(preview.cardId);

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
  // G6: while a received card awaits placement, its legal destination sets glow the whole time (not
  // only mid-drag) so I can see where it may go — and each is a tap-to-place target.
  if (receive) {
    for (const set of receive.bySet.keys()) {
      eligibleSets.add(set);
    }
  }
  const hotZoneId = drag?.hotZoneId ?? null;

  // P3: while a card is in the air the inflated thumb DROP BAND is up. The in-place zones then
  // suppress their data-drop (the band owns the target) but the felt behind still shows a glow —
  // merged here with the post-miss pulse so a missed drop re-flashes the very zones it should hit.
  const dragActive = drag !== null;
  const glowSets = new Set<SetId>([...eligibleSets, ...(missFeedback?.pulseSets ?? [])]);
  const bankGlow = bankEligible || (missFeedback?.pulseBank ?? false);

  // P1: measure the board's REAL box (the shell is 100dvh minus safe-area padding, so this is the
  // true height on the phone) and split it with the clamped-flex law — no percentages, no void.
  const [boardRef, boardHeight] = useMeasuredHeight<HTMLDivElement>(740);
  const zones = resolveZones(boardHeight);

  // A zone is a fixed-height flex row: an explicit px height from the law above, so the HUD and the
  // captures read exactly what resolveZones computed. `data-zone` lets the HUD/capture measure it.
  const zone = (heightPx: number, extra?: CSSProperties): CSSProperties => ({
    flex: `0 0 ${heightPx}px`,
    height: heightPx,
    minHeight: 0,
    padding: 8,
    ...extra,
  });

  return (
    <div ref={boardRef} style={boardStyle}>
      {/* opponent row — pills + their REAL card cascades; tap a row to expand to that opponent's
          full readable table view. Height from the zone law (min/max px, clamped-flex). */}
      <div data-zone="opponents" style={zone(zones.opponents, { display: 'flex', gap: 8, overflow: 'hidden' })}>
        {observation.opponents.map((opponent) => (
          // H1a (excellence pass): the WHOLE opponent column is the tap target (not just the card
          // strip), and it carries a VISIBLE expand affordance — so on a touch screen (no cursor) it
          // reads as "tap to open", the same as my own groups. Opens their full read-only table view.
          <div
            key={opponent.id}
            {...(import.meta.env.DEV && { 'data-expand': `opponent-${opponent.id}` })}
            onClick={() => setExpandedView({ kind: 'opponent', id: opponent.id })}
            title={`${seatName(seats, opponent.id)} — tap to see their full board`}
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, opacity: opponent.id === observation.currentPlayer ? 1 : 0.75, cursor: 'pointer' }}
          >
            <PlayerHeader name={seatName(seats, opponent.id)} bankTotal={opponent.bankTotal} handCount={opponent.handCount} active={opponent.id === observation.currentPlayer} expandable />
            <OpponentGroupStrip properties={opponent.properties} />
          </div>
        ))}
      </div>

      {/* table band — draw pile · turn chip · discard (fixed slim strip) */}
      <div data-zone="table" style={zone(zones.table, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${STAGE.scrimSheet}`, borderBottom: `1px solid ${STAGE.scrimSheet}` })}>
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

      {/* centre stage — the 2-line ticker (§8), then open felt / the tapped card's overlay / the
          centre PLAY drop zone. Clamped-flex: idle it collapses toward the ticker (no void, P1); a
          played card's spotlight overlays it and may overflow (overflow visible) so a short idle
          stage never shrinks the reveal. */}
      <div data-zone="stage" style={zone(zones.stage, { display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible' })}>
        <Ticker lines={tickerLines} />
        <div data-drop="play" style={{ position: 'relative', zIndex: LAYERS.stage, flex: 1, minHeight: 0, margin: '0 8px 6px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: hotZoneId === 'play' ? GLOW.hot : playEligible ? GLOW.soft : 'none' }}>
          {receive ? (
            // G6: a wildcard reached me as payment — it sits on stage; I drag it to a glowing set
            // (or tap one). Its legal sets glow below; dragging follows the pointer like any card.
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                {...receiveHandlers(receive.cardId)}
                {...(import.meta.env.DEV && { 'data-card-id': receive.cardId })}
                onContextMenu={(event) => event.preventDefault()}
                style={{ touchAction: 'none', cursor: 'grab', boxShadow: STAGE.glowGold, borderRadius: 8, opacity: drag?.cardId === receive.cardId ? 0.3 : 1 }}
              >
                <ScaledCard cardId={receive.cardId} width={STAGE_CARD_PX} />
              </div>
              <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 12, color: STAGE.accentGold }}>
                Drag it to a glowing set — or tap one
              </span>
            </div>
          ) : playEligible ? (
            <span style={{ fontFamily: FONT.display, fontWeight: 700, color: STAGE.accentGold }}>Play</span>
          ) : null}
        </div>
        {/* K2: the just-played card (a bot's or mine) reveals + travels here. It overlays the WHOLE
            stage (ticker + play) so it fits LARGE, sits ABOVE the ticker (z 4) and is the brightest
            thing on screen — the fix for the owner-shot bug (an oversized card dimmed behind the
            ticker). It yields to the interactive received-card flow, which owns the stage while up. */}
        <StageSpotlight cardId={receive ? null : spotlightCardId} fromOpponent={spotlightFromOpponent} />
      </div>

      {/* my area — the largest zone (hierarchy law A2), absorbing surplus height first; sleeps
          off-turn. This is the thumb zone: the hand wheel, my groups, and the bank tray. */}
      <div data-zone="myArea" style={zone(zones.myArea, { display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${STAGE.scrimSheet}`, filter: myTurn ? undefined : STAGE.dimSleep, overflow: 'hidden' })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* left: the You identity + the Munshi advisor chip (K3 — restyled to read unmistakably as
              an advisor, never confusable with the turn token). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <PlayerHeader name="You" bankTotal={observation.myBankTotal} handCount={observation.myHand.length} active={myTurn} self />
            <MunshiChip available={munshiAvailable} />
          </div>
          {/* centre: the TURN TOKEN (K3) — the plays display + end / auto-end / SAUDA! declare, all in
              one gold control. It replaces the End turn button, the F2 "turn over" beat and the
              centre-stage Declare button. */}
          <TurnToken
            active={myTurn && !inDiscardMode}
            playsRemaining={observation.playsRemaining}
            winLegal={!!declareWinAction}
            endTurnLegal={!!endTurnAction}
            rearrangeActive={rearrangeActive}
            paused={paused}
            onEndTurn={() => { if (endTurnAction && onAct) onAct(endTurnAction); }}
            onDeclareWin={() => { if (declareWinAction && onAct) onAct(declareWinAction); }}
          />
          {/* right: the bank TRAY (K4) — the drop zone itself (money / bankable actions only; never a
              wildcard). It carries data-drop="bank" and expands into a landing strip while a bankable
              card is dragged, the magnet following its live rect. */}
          <BankTray
            cards={observation.myBank}
            total={observation.myBankTotal}
            eligible={bankGlow}
            hot={hotZoneId === 'bank'}
            suppressDrop={dragActive}
          />
        </div>
        {/* my property board — the GROWTH area of my zone: it absorbs the surplus height (P1) so
            the empty felt reads as "where my deeds go" (the ticker points here at game start), not a
            random void, and the wheel sits directly below it instead of floating at the far bottom. */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <GroupRow
            properties={observation.myProperties}
            kiraya={observation.myKiraya}
            width={38}
            mine
            dropSets={glowSets}
            hotZoneId={hotZoneId}
            onExpand={() => setExpandedView({ kind: 'me' })}
            onSetPlace={receive ? placeReceivedIn : undefined}
            suppressDrop={dragActive}
            rearrange={
              rearrangeableIds.size > 0
                ? { handlers: cardHandlers, cardIds: [...rearrangeableIds], draggingId: drag?.cardId ?? null }
                : undefined
            }
          />
          {/* P3: the inflated thumb drop band overlays this board area while a card is dragged. */}
          {dragActive && (eligibleSets.size > 0 || bankEligible) && (
            <DropBand sets={[...eligibleSets]} bankEligible={bankEligible} hotZoneId={hotZoneId} />
          )}
        </div>
        {/* P7: the "Move wildcard:" chip row is GONE. Each movable wildcard now carries its own ◈
            handle ON its group (drag it, or tap for the chooser) — see the GroupRow rearrange prop. */}
        {/* bottom band: the hand WHEEL (G2), hub at bottom-centre, spanning the FULL my-area width —
            no control shares this band (End turn moved to the header, H2b), so the wheel stays widest
            and nothing ever overlaps a card. It sits directly under the property board above (P1). */}
        <div>
          <HandWheel
            cards={observation.myHand}
            interactiveIds={handTappableIds}
            carriedCardId={preview?.cardId ?? null}
            onTap={onTapCard}
            onDragStart={startMainDrag}
            onDragMove={dragCtl.move}
            onDragEnd={dragCtl.release}
            onDragCancel={dragCtl.cancel}
          />
        </div>
      </div>

      {/* the floating drag preview — lifted above the finger, pointer-events:none so it never
          hides the drop zone beneath it from the hit-test. */}
      {drag && (
        <div style={{ position: 'fixed', left: drag.x, top: drag.y, pointerEvents: 'none', zIndex: LAYERS.dragGhost }}>
          <div style={{ transform: 'translate(-50%, -100%) translateY(-32px) scale(0.62)', transformOrigin: 'bottom center' }}>
            <div style={{ boxShadow: SHADOW.dragLift, borderRadius: 8 }}>
              <CardFace cardId={drag.cardId} />
            </div>
          </div>
        </div>
      )}

      {/* P3 "no silent mystery": a missed drop's hint — pulse the zones + this line, or the F7
          why-line for an unplayable card. Fixed above the wheel, non-interactive, auto-clears. */}
      {missFeedback && <div style={missToastStyle}>{missFeedback.hint}</div>}

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
          dragging={preview?.cardId === inspecting}
          onDismiss={() => setInspectingCardId(null)}
          onDragStart={startMainDrag}
          onDragMove={dragCtl.move}
          onDragEnd={dragCtl.release}
          onDragCancel={dragCtl.cancel}
        />
      )}
    </div>
  );
}

// P3: the miss hint — a quiet cream pill fixed low on the felt (above the wheel), non-interactive.
const missToastStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: '30%',
  transform: 'translateX(-50%)',
  zIndex: LAYERS.toast,
  pointerEvents: 'none',
  maxWidth: '80vw',
  padding: '8px 16px',
  borderRadius: 999,
  background: STAGE.cardCream,
  color: INK.deepInk,
  fontFamily: FONT.serif,
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'center',
  boxShadow: STAGE.glowGold,
};

// P1: the board FILLS its shell (the fixed 100dvh, safe-area-padded container in Table.tsx) — no
// centered min()-capped box, so there are no felt margins and no void. Height flows to the zone law.
const boardStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  background: STAGE.felt,
  color: STAGE.textOnFelt,
  overflow: 'hidden',
  fontFamily: FONT.serif,
};
