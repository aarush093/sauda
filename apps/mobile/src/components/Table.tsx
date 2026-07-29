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
import { useEffect, useRef } from 'react';
import { legalActions, observe } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { actorOf, useGame, viewSeat } from '../game/store';
import { paymentDetails } from '../game/paymentModel';
import { zeroPayableResponse } from '../game/interaction';
import { describeThreat } from '../game/labels';
import { Board } from './Board';
import { PaymentSheet } from './PaymentSheet';
import { InterruptPrompt } from './InterruptPrompt';
import { ReceivePrompt } from './ReceivePrompt';
import { HandoffOverlay } from './HandoffOverlay';
import { STAGE, INK, FONT } from '../design/tokens';

const BOT_MOVE_DELAY_MS = 300;
const BEAT_MS = 500; // L1: the pause before an auto-resolve so the player reads it

// A move the UI plays for the human because there is nothing to decide (|legalActions|==1):
// D2 auto-allow (no counter in hand) or C4 (nothing to pay with). Shown as a brief beat.
interface AutoResolve {
  action: Action;
  note: string;
}

export function Table() {
  const state = useGame((store) => store.state);
  const seats = useGame((store) => store.seats);
  const revealedSeat = useGame((store) => store.revealedSeat);
  const handoffSeat = useGame((store) => store.handoffSeat);
  const log = useGame((store) => store.log);
  const dispatch = useGame((store) => store.dispatch);
  const stepBot = useGame((store) => store.stepBot);
  const ackHandoff = useGame((store) => store.ackHandoff);
  const reset = useGame((store) => store.reset);

  // Drive bot turns one step at a time; each step updates state and re-runs this.
  useEffect(() => {
    if (!state || state.phase === 'gameOver' || handoffSeat !== null) {
      return;
    }
    const actor = actorOf(state);
    if (seats[actor]?.kind !== 'bot') {
      return;
    }
    const timer = setTimeout(() => stepBot(), BOT_MOVE_DELAY_MS);
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
  const autoDrawRef = useRef(false);
  autoDrawRef.current = autoDraw;
  const autoResolveRef = useRef<AutoResolve | null>(null);
  autoResolveRef.current = autoResolve;

  // L4: auto-draw. Keyed on `state` so it re-checks after every applied action, and reduce
  // rejects a stray second DRAW (wrong phase), so it fires exactly once per awaitingDraw.
  useEffect(() => {
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
    const timer = setTimeout(() => dispatch(pending.action), BEAT_MS);
    return () => clearTimeout(timer);
  }, [state, dispatch]);

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
      />

      {gameOver && (
        <div className="winner">
          Player {state.winnerIndex} wins! <button onClick={reset}>New game</button>
        </div>
      )}

      {/* L1: a brief non-interactive beat while the game auto-resolves a no-choice window. */}
      {autoResolve && (
        <div style={beatOverlayStyle}>
          <div style={beatNoteStyle}>{autoResolve.note}</div>
        </div>
      )}

      {/* a standing charge raises the payment sheet over the table (INTERACTION_SPEC §6).
          Private response UI waits until any pass-and-play hand-off is acked (E2). */}
      {handoffSeat === null && showPaymentSheet && payAction?.type === 'RESPOND_PAY' && (
        <PaymentSheet
          observation={actorObservation}
          seats={seats}
          suggestion={payAction.cardIds}
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

      {/* C7: a wildcard reached me as payment — choose which of my legal groups it joins. */}
      {handoffSeat === null && receiveHead && (
        <ReceivePrompt cardId={receiveHead.cardId} options={receiveOptions} onChoose={dispatch} />
      )}

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
