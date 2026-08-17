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
import { dropZonesForCard, rearrangeDestinations, assistHintAction } from '../game/interaction';
import type { DropZone } from '../game/interaction';
import { evaluateArrangements } from '../game/arrangeAssistant';
import { ArrangeAssistant } from './ArrangeAssistant';
import { useReducedMotion } from '../design/motion';
import { useHandDrag } from '../game/useHandDrag';
import { useMeasuredSize } from '../game/useMeasuredWidth';
import { fitToBox } from '../game/viewport';
import { resolveMyTurn, resolveSpectate } from '../game/landscapeLayout';
import { useDragController } from '../game/useDragController';
import type { CarrySpec } from '../game/useDragController';
import { cardVerbHint } from '../game/labels';
import { CardFace } from './CardFace';
import { InspectCard } from './InspectCard';
import { DiscardOverlay } from './DiscardOverlay';
import { TableView } from './TableView';
import { BankView } from './BankView';
import { TargetingOverlay } from './TargetingOverlay';
import { RearrangeChooser } from './RearrangeChooser';
import { MyTurnLayout } from './MyTurnLayout';
import { SpectateLayout } from './SpectateLayout';
import { FocusTransition } from './FocusTransition';
import { seatName } from './BoardParts';
import { STAGE, INK, SHADOW, FONT, LAYERS } from '../design/tokens';
import { tallyRender } from '../game/renderTally';

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
  spotlightCaption = null,
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
  spotlightCaption?: string | null; // R2: the caption beside the spectate stage card ("B2 · MAKAAN")
  paused?: boolean | undefined; // P8: the pause sheet is open → freeze the turn token's auto-end drain
  // G6: a wildcard reached me as payment and needs a group (matrix C7). It lands on stage; its
  // legal destination sets glow; I drag it home (or tap a glowing set). bySet maps each legal set
  // to the exact RESPOND_PLACE_RECEIVED the engine enumerated.
  receive?: { cardId: CardId; bySet: Map<SetId, Action>; onPlace: (action: Action) => void } | null;
}) {
  if (import.meta.env.DEV) tallyRender('Board');
  const reducedMotion = useReducedMotion();
  const myTurn = observation.currentPlayer === observation.me;
  // S3 assist: the table's bot difficulty gates the targeting hint (easy/medium show it, hard hides
  // it). Solo tables set one tier for every bot; take the first bot seat's (no bots → hard → no hint).
  const tableDifficulty = seats.find((seat) => seat.kind === 'bot')?.difficulty ?? 'hard';

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

  // R3: whether the bank inspect overlay is open (tapping my bank tray). My own bank only — an
  // opponent's bank reads inside their board zoom (the TableView bank row).
  const [bankView, setBankView] = useState(false);

  // A targeted action mid-play: its card is on stage and legal targets glow (A10 targeting).
  // Cleared automatically once the card leaves the hand (committed) or the turn passes.
  const [targetingCardId, setTargetingCardId] = useState<string | null>(null);
  const targeting = targetingCardId !== null && observation.myHand.includes(targetingCardId) ? targetingCardId : null;

  // S4: a strictly-better FREE rearrangement of my placed wildcards, if one exists. Re-derived every
  // render, so it re-evaluates after every state change. Gated to my own play turn with NO other
  // overlay open and no drain in progress (a suggestion requires legal REARRANGE moves, which cannot
  // co-exist with the auto-end-turn condition of END_TURN being the sole legal move — so no race).
  const arrangeSuggestion =
    myTurn && observation.phase === 'playing' && onAct != null && !paused &&
    targeting === null && inspecting === null && !inDiscardMode && !bankView && expandedView === null && receive == null
      ? evaluateArrangements(observation.myProperties, observation.myHand, actions)
      : null;

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
  const glowSets = new Set<SetId>([...eligibleSets, ...(missFeedback?.pulseSets ?? [])]);
  const bankGlow = bankEligible || (missFeedback?.pulseBank ?? false);

  // LAYOUT v3 (owner landscape directive, 2 Aug): measure the board's REAL box and split it with the
  // landscape zone maths. Which composition renders is FOCUS FOLLOWS TURN: my own turn shows my world
  // only (MyTurnLayout); any bot's turn shows the spectate split (SpectateLayout). Board keeps ALL the
  // interaction glue above and just hands each layout the props it needs; the ghost + overlays below
  // stay here, in one place. Fallbacks (740×360) cover the first paint and jsdom (no layout engine).
  const [boardRef, boardSize] = useMeasuredSize<HTMLDivElement>();
  // U1 (iPhone 12 cut-off fix): measure the REAL box, then FIT the board into it. At or above the min
  // playable box we lay out 1:1 (every real device profile hits this once the shell is sized from the
  // live visualViewport — see Table). Below it, fitToBox lays the board out at the min box and returns
  // a `scale` < 1 so the WHOLE board shrinks to fit rather than clipping the hand off the bottom. The
  // zone maths run on the LAYOUT box; the scale is a CSS transform on the layout wrapper below.
  const measuredWidth = boardSize.width > 0 ? boardSize.width : 740;
  const measuredHeight = boardSize.height > 0 ? boardSize.height : 360;
  // W1 (first-player pass — supersedes U2): SAUDA renders only in landscape now (App.tsx swaps the whole
  // tree for the rotate screen in portrait), so the board always fits the full measured box. The U2
  // portrait-compression branch is gone — it produced the "crushed at the bottom" field the owner
  // rejected. fitToBox still scales the WHOLE board down (never clips) if a box is below the min box.
  const fit = fitToBox(measuredWidth, measuredHeight);
  const width = fit.layoutWidth;
  const height = fit.layoutHeight;
  const myTurnZones = resolveMyTurn(width, height);
  const spectateZones = resolveSpectate(width, height);

  const onExpandMine = () => setExpandedView({ kind: 'me' });
  const onOpenBot = (id: number) => setExpandedView({ kind: 'opponent', id });

  return (
    <div ref={boardRef} style={boardStyle}>
      {/* U1: the LAYOUT layer — sized to the fit's layout box and scaled to fill the measured box. At
          scale 1 (every real device) this is a no-op wrapper the size of the board; below the min box
          it shrinks the whole play surface uniformly so nothing clips. The drag ghost and the response
          overlays stay OUTSIDE this wrapper (fixed to the viewport), so their pointer maths and full-
          screen sizing are unaffected by the scale. */}
      <div style={{ position: 'absolute', top: 0, left: 0, width, height, transform: `scale(${fit.scale})`, transformOrigin: 'top left' }}>
      {/* FOCUS FOLLOWS TURN: the key flips when control crosses my-turn ↔ spectate, so FocusTransition
          remounts and plays one ~250ms slide/fade — no dead frame between the two states (R1). */}
      <FocusTransition key={myTurn ? 'mine' : 'spectate'} direction={myTurn ? 'mine' : 'spectate'}>
      {myTurn ? (
        <MyTurnLayout
          observation={observation}
          zones={myTurnZones}
          glowSets={glowSets}
          bankGlow={bankGlow}
          playEligible={playEligible}
          hotZoneId={hotZoneId}
          spotlightCardId={spotlightCardId}
          spotlightFromOpponent={spotlightFromOpponent}
          munshiAvailable={munshiAvailable}
          tickerLines={tickerLines}
          turnToken={{
            active: myTurn && !inDiscardMode,
            playsRemaining: observation.playsRemaining,
            winLegal: !!declareWinAction,
            endTurnLegal: !!endTurnAction,
            rearrangeActive,
            paused,
            onEndTurn: () => { if (endTurnAction && onAct) onAct(endTurnAction); },
            onDeclareWin: () => { if (declareWinAction && onAct) onAct(declareWinAction); },
          }}
          wheel={{
            cards: observation.myHand,
            interactiveIds: handTappableIds,
            carriedCardId: preview?.cardId ?? null,
            onTap: onTapCard,
            onDragStart: startMainDrag,
            onDragMove: dragCtl.move,
            onDragEnd: dragCtl.release,
            onDragCancel: dragCtl.cancel,
          }}
          rearrange={
            rearrangeableIds.size > 0
              ? { handlers: cardHandlers, cardIds: [...rearrangeableIds], draggingId: drag?.cardId ?? null }
              : undefined
          }
          receiveOnStage={
            receive ? { cardId: receive.cardId, handlers: receiveHandlers, dragging: drag?.cardId === receive.cardId } : undefined
          }
          onPlaceReceived={placeReceivedIn}
          onExpandMine={onExpandMine}
          onOpenBot={onOpenBot}
          onOpenBank={() => setBankView(true)}
          handAsleep={targeting !== null}
        />
      ) : (
        <SpectateLayout
          observation={observation}
          seats={seats}
          zones={spectateZones}
          actingId={observation.currentPlayer}
          spotlightCardId={spotlightCardId}
          caption={spotlightCaption}
          tickerLines={tickerLines}
          onExpandMine={onExpandMine}
          onExpandActing={() => setExpandedView({ kind: 'opponent', id: observation.currentPlayer })}
          onOpenBot={onOpenBot}
        />
      )}
      </FocusTransition>
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
          myProperties={observation.myProperties}
          myKiraya={observation.myKiraya}
          opponents={observation.opponents}
          hintAction={assistHintAction(observation, actions, targeting, tableDifficulty)}
          reducedMotion={reducedMotion}
          onCommit={(action) => {
            onAct(action);
            setTargetingCardId(null);
          }}
          onCancel={() => setTargetingCardId(null)}
        />
      )}

      {/* S4: the wildcard combination assistant nudge. Keyed by the suggested moves so a new board
          resets it. NEVER auto-executes — Confirm fires the free REARRANGE sequence via onAct. */}
      {arrangeSuggestion && onAct && (
        <ArrangeAssistant
          key={arrangeSuggestion.moves.map((move) => `${move.cardId}->${move.toSet}`).join('|')}
          suggestion={arrangeSuggestion}
          onConfirm={(moves) => moves.forEach((move) => onAct(move))}
          onDismiss={() => {}}
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
              bank={observation.myBank}
              kiraya={observation.myKiraya}
              revealBank // S2: my own bank — real faces + total, unchanged
              onClose={() => setExpandedView(null)}
            />
          );
        }
        const opponent = observation.opponents.find((candidate) => candidate.id === expandedView.id);
        return opponent ? (
          // S2: an opponent's zoom — bank renders as card backs + count (revealBank defaults false).
          <TableView
            title={seatName(seats, opponent.id)}
            properties={opponent.properties}
            bankTotal={opponent.bankTotal}
            bank={opponent.bank}
            onClose={() => setExpandedView(null)}
          />
        ) : null;
      })()}

      {/* R3: tapping my bank tray opens the bank inspect — every banked card as a real face, total in
          gold. The bank is public in this genre; an opponent's bank shows the same way in their zoom. */}
      {bankView && (
        <BankView title="You" cards={observation.myBank} total={observation.myBankTotal} onClose={() => setBankView(false)} />
      )}

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
