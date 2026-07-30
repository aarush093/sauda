/**
 * The Table screen. It renders the play table for the revealed player and overlays the
 * response surfaces the engine calls for: the payment sheet (a charge on me), the NAHI
 * CHALEGA prompt (an action I can counter), the received-wildcard chooser, and the
 * pass-and-play hand-off. Two small effects run the game's automatic beats:
 *   - bot turns step on a timer;
 *   - L4 auto-draw fires at my turn start; L1 auto-resolves (D2 auto-allow, C4 zero-pay)
 *     run after a ~500 ms beat with a ticker line — nothing resolves silently.
 *
 * Everything actionable is `legalActions(state, actor)`; every move is `dispatch`
 * (== reduce). No rule is decided here — the screen routes the engine's offer to the
 * right surface. Turn plays live on the Board itself (drag / tap → stage → rail, A10).
 */
import { useEffect, useRef, useState } from 'react';
import { SETS, isSetComplete, legalActions, observe } from '@sauda/engine';
import type { Action, GameEvent, GameState, PropertyGroup, SetId } from '@sauda/engine';
import { actorOf, useGame, viewSeat } from '../game/store';
import type { SeatConfig } from '../game/store';
import { paymentDetails } from '../game/paymentModel';
import { botBeatDelayMs, shouldAutoEndTurn, zeroPayableResponse } from '../game/interaction';
import { describeThreat } from '../game/labels';
import { Board } from './Board';
import { PaymentSheet } from './PaymentSheet';
import { InterruptPrompt } from './InterruptPrompt';
import { HandoffOverlay } from './HandoffOverlay';
import { EndOverlay } from './EndOverlay';
import { STAGE, INK, FONT } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];

// The seat's name for the end title (name only — difficulty is a setup concern, F5).
function seatLabel(seats: SeatConfig[], id: number): string {
  return seats[id]?.kind === 'bot' ? `Bot ${id}` : `Player ${id}`;
}

// The winner's completed sets (the three that won them the game) as real groups, for the end
// panel's card cascades (F6 · G4).
function completedSets(state: GameState, player: number): { set: SetId; group: PropertyGroup }[] {
  const out: { set: SetId; group: PropertyGroup }[] = [];
  for (const set of ALL_SETS) {
    const group = state.players[player]!.properties[set].find((candidate) => isSetComplete(candidate));
    if (group) {
      out.push({ set, group });
    }
  }
  return out;
}

const BEAT_MS = 500; // L1: the pause before an auto-resolve so the player reads it
const AUTO_END_MS = 800; // F2: the beat before the turn ends itself when only END_TURN is legal
const HUMAN_PLAY_BEAT_MS = 800; // F4: how long the human's just-played card is held on centre stage

// A move the UI plays for the human because there is nothing to decide (|legalActions|==1):
// D2 auto-allow (no counter in hand) or C4 (nothing to pay with). Shown as a brief beat.
interface AutoResolve {
  action: Action;
  note: string;
}

// The last card `player` just placed / built / banked / played — OR received (G6: an auto-placed
// card that arrived to them) — held on centre stage so it is SEEN, not just read as a ticker line
// (§8/I1 · F4). Newest matching card wins.
function lastPlayedCard(events: GameEvent[], player: number): string | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]!;
    if (
      (event.type === 'ActionPlayed' ||
        event.type === 'CardBanked' ||
        event.type === 'PropertyPlaced' ||
        event.type === 'BuildingPlaced' ||
        event.type === 'CardReceived') &&
      event.player === player
    ) {
      return event.cardId;
    }
  }
  return null;
}

export function Table() {
  const state = useGame((store) => store.state);
  const seats = useGame((store) => store.seats);
  const revealedSeat = useGame((store) => store.revealedSeat);
  const handoffSeat = useGame((store) => store.handoffSeat);
  const log = useGame((store) => store.log);
  const lastEvents = useGame((store) => store.lastEvents);
  const dispatch = useGame((store) => store.dispatch);
  const stepBot = useGame((store) => store.stepBot);
  const ackHandoff = useGame((store) => store.ackHandoff);
  const reset = useGame((store) => store.reset);

  // Drive bot turns one step at a time; each step updates state and re-runs this. H5: the delay is
  // PACED — the first beat of a bot's turn holds longest, later beats are quicker, trimming toward a
  // floor near the ~3s cap so a long turn never drags. `botBeat` tracks the beat index + elapsed
  // within the current bot's turn and resets whenever control leaves this bot (a human turn, or a
  // different bot); the count advances in the timer callback, so it ticks once per real beat.
  const botBeat = useRef({ actor: -1, beats: 0, elapsed: 0 });
  useEffect(() => {
    if (!state || state.phase === 'gameOver' || handoffSeat !== null) {
      return;
    }
    // Capture freeze (dev only): while the Playwright pipeline holds a recorded frame, don't
    // step the bot. `import.meta.env.DEV` folds to false in prod, so this guard — and the two
    // like it below — are dead-code-eliminated from the shipped bundle (bundle stays identical).
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return;
    }
    const actor = actorOf(state);
    if (seats[actor]?.kind !== 'bot') {
      botBeat.current.actor = -1; // control is with a human / nobody — the next bot turn starts fresh
      return;
    }
    if (botBeat.current.actor !== actor) {
      botBeat.current = { actor, beats: 0, elapsed: 0 }; // a new bot turn — reset the beat run
    }
    const delay = botBeatDelayMs(botBeat.current.beats, botBeat.current.elapsed);
    const timer = setTimeout(() => {
      botBeat.current.beats += 1;
      botBeat.current.elapsed += delay;
      stepBot();
    }, delay);
    return () => clearTimeout(timer);
  }, [state, handoffSeat, seats, stepBot]);

  // Compute the automatic beats for the human holding the device. Done before the early
  // return so hook order is stable; stashed in refs so the effects (keyed on `state`) read
  // the fresh values and re-run once per applied action — which lets NAHI chains advance.
  let autoDraw = false;
  let autoResolve: AutoResolve | null = null;
  if (state && state.phase !== 'gameOver' && handoffSeat === null) {
    const openActor = actorOf(state);
    if (seats[openActor]?.kind === 'human') {
      const open = legalActions(state, openActor);
      const openObservation = observe(state, openActor);
      if (state.phase === 'awaitingDraw' && open.some((action) => action.type === 'DRAW')) {
        autoDraw = true; // L4: draw is automatic at turn start
      }
      const canAllow = open.some((action) => action.type === 'RESPOND_ALLOW');
      const canNahi = open.some((action) => action.type === 'RESPOND_NAHI_CHALEGA');
      if (canAllow && !canNahi && openObservation.interrupt) {
        // D2: an action landed on me that I cannot counter — no prompt, just allow it.
        autoResolve = { action: { type: 'RESPOND_ALLOW' }, note: `${describeThreat(openObservation.interrupt)} No counter — allowed.` };
      } else {
        const details = paymentDetails(openObservation);
        const emptyPay = details ? zeroPayableResponse(open, details.payable.length) : null;
        if (emptyPay) {
          autoResolve = { action: emptyPay, note: 'Nothing to pay with.' }; // C4
        }
      }
    }
  }
  // F2: the turn ends itself when END_TURN is the only legal move (no play / DECLARE_WIN / free
  // REARRANGE_WILDCARD). A brief beat announces the hand-over, then END_TURN dispatches; if the
  // hand is over the limit this flows into the discard step exactly as a manual End turn would.
  let autoEndNote: string | null = null;
  if (state && state.phase === 'playing' && handoffSeat === null) {
    const turnActor = actorOf(state);
    if (seats[turnActor]?.kind === 'human' && turnActor === state.currentPlayerIndex && shouldAutoEndTurn(legalActions(state, turnActor))) {
      const next = (state.currentPlayerIndex + 1) % state.players.length;
      const nextName = seats[next]?.kind === 'bot' ? `Bot ${next}` : `Player ${next}`;
      autoEndNote = `Turn over — ${nextName} plays.`;
    }
  }

  const autoDrawRef = useRef(false);
  autoDrawRef.current = autoDraw;
  const autoResolveRef = useRef<AutoResolve | null>(null);
  autoResolveRef.current = autoResolve;
  const autoEndRef = useRef<string | null>(null);
  autoEndRef.current = autoEndNote;

  // L4: auto-draw. Keyed on `state` so it re-checks after every applied action, and reduce
  // rejects a stray second DRAW (wrong phase), so it fires exactly once per awaitingDraw.
  useEffect(() => {
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return; // capture freeze (dev only) — see the bot-step effect above
    }
    if (autoDrawRef.current) {
      dispatch({ type: 'DRAW' });
    }
  }, [state, dispatch]);

  // L1: auto-resolve after a beat. Keyed on `state` so a NAHI chain (allow → allow → …)
  // schedules the next beat once the previous one applied.
  useEffect(() => {
    const pending = autoResolveRef.current;
    if (!pending) {
      return;
    }
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return; // capture freeze (dev only) — hold the beat so it can be shot (e.g. C4 zero-pay)
    }
    const timer = setTimeout(() => dispatch(pending.action), BEAT_MS);
    return () => clearTimeout(timer);
  }, [state, dispatch]);

  // F2: auto-end after an 800 ms beat. Keyed on `state`, and reduce rejects a stray END_TURN, so
  // it fires exactly once. Same dev capture-freeze guard so the beat can be shot.
  useEffect(() => {
    if (!autoEndRef.current) {
      return;
    }
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return; // capture freeze (dev only) — hold the "Turn over" beat so it can be shot
    }
    const timer = setTimeout(() => dispatch({ type: 'END_TURN' }), AUTO_END_MS);
    return () => clearTimeout(timer);
  }, [state, dispatch]);

  // F4: flash the human's just-played card on centre stage for a beat, so their play is SEEN the
  // same way a bot's is held (I1). A bot holds its card for the whole ~700ms step; the human is
  // still playing, so theirs clears after a short beat.
  const [humanPlayCardId, setHumanPlayCardId] = useState<string | null>(null);
  useEffect(() => {
    if (!state || handoffSeat !== null) {
      return;
    }
    const turnActor = actorOf(state);
    if (seats[turnActor]?.kind !== 'human') {
      return;
    }
    const played = lastPlayedCard(lastEvents, turnActor);
    if (played === null) {
      return;
    }
    setHumanPlayCardId(played);
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return; // capture freeze (dev only) — hold the play beat so it can be shot
    }
    const timer = setTimeout(() => setHumanPlayCardId(null), HUMAN_PLAY_BEAT_MS);
    return () => clearTimeout(timer);
  }, [lastEvents, state, seats, handoffSeat]);

  if (!state) {
    return null;
  }

  const actor = actorOf(state);
  const view = viewSeat({ revealedSeat, seats });
  const observation = observe(state, view);
  const actorObservation = observe(state, actor); // the acting human's own view
  const isBotTurn = seats[actor]?.kind === 'bot';
  const gameOver = state.phase === 'gameOver';
  const tickerLines = log.slice(-2).map((line) => line.text);
  // Spotlight the acting bot's last card on centre stage so its turn is watchable (I1); on my own
  // turn, the transient human-play beat (above) fills the same slot (F4).
  const botSpotlightCardId = isBotTurn && handoffSeat === null ? lastPlayedCard(lastEvents, actor) : null;
  const spotlightCardId = botSpotlightCardId ?? humanPlayCardId;

  // The human actor's legal moves (empty on a bot's turn / at game over). Turn plays feed
  // the board's drag/tap→stage→rail; the RESPOND_* moves each raise their own surface.
  const humanActions = !isBotTurn && !gameOver ? legalActions(state, actor) : [];
  const isResponse = humanActions.some((action) => action.type.startsWith('RESPOND_'));
  const payAction = humanActions.find((action) => action.type === 'RESPOND_PAY');
  const nahiAction = humanActions.find((action) => action.type === 'RESPOND_NAHI_CHALEGA');
  const receiveOptions = humanActions.filter(
    (action): action is Extract<Action, { type: 'RESPOND_PLACE_RECEIVED' }> =>
      action.type === 'RESPOND_PLACE_RECEIVED',
  );
  const receiveHead = receiveOptions[0];
  // G6: a received wildcard awaiting placement (C7) lands ON THE BOARD stage — its legal sets glow,
  // I drag it home (or tap a set). One at a time: the engine offers only the head card's options.
  const receive =
    handoffSeat === null && receiveHead
      ? {
          cardId: receiveHead.cardId,
          bySet: new Map<SetId, Action>(receiveOptions.map((option) => [option.set, option])),
          onPlace: dispatch,
        }
      : null;
  // C4 opens no sheet — the beat auto-submits it. The sheet renders only with real cards.
  const showPaymentSheet = payAction?.type === 'RESPOND_PAY' && autoResolve === null;

  return (
    <div className="table" style={{ background: STAGE.felt, color: STAGE.textOnFelt, minHeight: '100vh', paddingBottom: 24 }}>
      <Board
        observation={observation}
        seats={seats}
        actions={isResponse ? [] : humanActions}
        onAct={dispatch}
        tickerLines={tickerLines}
        spotlightCardId={spotlightCardId}
        autoEnding={autoEndNote !== null}
        receive={receive}
      />

      {/* F6: any game end presents the full-screen end overlay (fixed, so it never grows the page
          the way the old in-flow winner strip did). Board sleeps behind the scrim. */}
      {gameOver && state.winnerIndex !== null && (
        <EndOverlay
          title={seats[state.winnerIndex]?.kind === 'human' ? 'SAUDA!' : `${seatLabel(seats, state.winnerIndex)} wins`}
          sets={completedSets(state, state.winnerIndex).slice(0, 3)}
          onNewGame={reset}
        />
      )}

      {/* L1: a brief non-interactive beat while the game auto-resolves a no-choice window. */}
      {autoResolve && (
        <div style={beatOverlayStyle}>
          <div style={beatNoteStyle}>{autoResolve.note}</div>
        </div>
      )}

      {/* F2: the "turn over" beat — the turn is ending itself; the manual End turn button is
          hidden (Board `autoEnding`) so it never reads as the game asking permission. */}
      {autoEndNote && (
        <div style={beatOverlayStyle}>
          <div style={beatNoteStyle}>{autoEndNote}</div>
        </div>
      )}

      {/* a standing charge raises the payment sheet over the table (INTERACTION_SPEC §6).
          Private response UI waits until any pass-and-play hand-off is acked (E2). */}
      {handoffSeat === null && showPaymentSheet && payAction?.type === 'RESPOND_PAY' && (
        <PaymentSheet
          observation={actorObservation}
          seats={seats}
          onPay={(cardIds) => dispatch({ type: 'RESPOND_PAY', cardIds })}
        />
      )}

      {/* D1: the NAHI CHALEGA window opens ONLY when I actually hold the counter. With only
          Allow legal there is no choice — the L1 beat above resolves it (D2), no prompt. */}
      {handoffSeat === null && nahiAction?.type === 'RESPOND_NAHI_CHALEGA' && actorObservation.interrupt && (
        <InterruptPrompt
          interrupt={actorObservation.interrupt}
          canNahi
          onNahi={() => dispatch(nahiAction)}
          onAllow={() => dispatch({ type: 'RESPOND_ALLOW' })}
        />
      )}

      {/* C7 (G6): a wildcard reached me as payment — it now lands ON the board stage with its legal
          sets glowing (see the Board `receive` prop), so there is no separate chooser overlay. */}

      {handoffSeat !== null && <HandoffOverlay seat={handoffSeat} onReady={ackHandoff} />}
    </div>
  );
}

const beatOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 8,
  background: STAGE.scrimDrag,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
} as const;
const beatNoteStyle = {
  background: STAGE.cardCream,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  padding: '10px 18px',
  borderRadius: 999,
  boxShadow: STAGE.glowGold,
  maxWidth: '80vw',
  textAlign: 'center',
} as const;
