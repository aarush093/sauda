/**
 * The Table screen. It renders the play table for the revealed player and overlays the
 * response surfaces the engine calls for: the payment sheet (a charge on me), the NAHI
 * CHALEGA prompt (an action I can counter), the received-wildcard chooser, and the
 * pass-and-play hand-off. A small effect drives bot turns on a timer.
 *
 * Everything actionable is `legalActions(state, actor)`; every move is `dispatch`
 * (== reduce). No rule is decided here — the screen only routes the engine's offer to the
 * right surface. Turn plays (draw, place, bank, play, end turn, discard, declare) all live
 * on the Board itself (tap → centre stage → rail, A1); this file handles only responses.
 */
import { useEffect } from 'react';
import { legalActions, observe } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { actorOf, useGame, viewSeat } from '../game/store';
import { Board } from './Board';
import { PaymentSheet } from './PaymentSheet';
import { InterruptPrompt } from './InterruptPrompt';
import { ReceivePrompt } from './ReceivePrompt';
import { HandoffOverlay } from './HandoffOverlay';
import { STAGE } from '../design/tokens';

const BOT_MOVE_DELAY_MS = 300;

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

  // D2: when an action lands on me and I do NOT hold NAHI CHALEGA, my only legal move is
  // RESPOND_ALLOW — there is no decision, so no prompt appears and we auto-play that single
  // Allow (once the device is with me). Computed before the early return below so the hook
  // order stays stable; gated on a plain boolean so the effect fires once, on open.
  let canAutoAllow = false;
  if (state && state.phase !== 'gameOver' && handoffSeat === null) {
    const openActor = actorOf(state);
    if (seats[openActor]?.kind === 'human') {
      const open = legalActions(state, openActor);
      canAutoAllow =
        open.some((action) => action.type === 'RESPOND_ALLOW') &&
        !open.some((action) => action.type === 'RESPOND_NAHI_CHALEGA');
    }
  }
  useEffect(() => {
    if (canAutoAllow) {
      dispatch({ type: 'RESPOND_ALLOW' });
    }
  }, [canAutoAllow, dispatch]);

  if (!state) {
    return null;
  }

  const actor = actorOf(state);
  const view = viewSeat({ revealedSeat, seats });
  const observation = observe(state, view);
  const actorObservation = observe(state, actor); // the acting human's own view
  const isBotTurn = seats[actor]?.kind === 'bot';
  const gameOver = state.phase === 'gameOver';

  // The human actor's legal moves (empty on a bot's turn / at game over). Turn plays feed
  // the board's tap→stage→rail; the RESPOND_* moves each raise their own surface below.
  const humanActions = !isBotTurn && !gameOver ? legalActions(state, actor) : [];
  const isResponse = humanActions.some((action) => action.type.startsWith('RESPOND_'));
  const payAction = humanActions.find((action) => action.type === 'RESPOND_PAY');
  const nahiAction = humanActions.find((action) => action.type === 'RESPOND_NAHI_CHALEGA');
  const receiveOptions = humanActions.filter(
    (action): action is Extract<Action, { type: 'RESPOND_PLACE_RECEIVED' }> =>
      action.type === 'RESPOND_PLACE_RECEIVED',
  );
  const receiveHead = receiveOptions[0];

  return (
    <div className="table" style={{ background: STAGE.felt, color: STAGE.textOnFelt, minHeight: '100vh', paddingBottom: 24 }}>
      <Board
        observation={observation}
        seats={seats}
        actions={isResponse ? [] : humanActions}
        onAct={dispatch}
      />

      {gameOver ? (
        <div className="winner">
          Player {state.winnerIndex} wins! <button onClick={reset}>New game</button>
        </div>
      ) : isBotTurn ? (
        <div className="waiting">Player {actor} is thinking…</div>
      ) : null}

      {/* a standing charge raises the payment sheet over the table (INTERACTION_SPEC §6).
          Private response UI waits until any pass-and-play hand-off is acked (E2). */}
      {handoffSeat === null && payAction?.type === 'RESPOND_PAY' && (
        <PaymentSheet
          observation={actorObservation}
          seats={seats}
          suggestion={payAction.cardIds}
          onPay={(cardIds) => dispatch({ type: 'RESPOND_PAY', cardIds })}
        />
      )}

      {/* D1: the NAHI CHALEGA window opens ONLY when I actually hold the counter (the engine
          offers RESPOND_NAHI_CHALEGA). With only Allow legal there is no choice, so no
          prompt — the effect above resolves it. A chain flips the prompt to the next side. */}
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

      <div className="zone">
        <h3>Log</h3>
        <div className="log">
          {log
            .slice(-40)
            .map((line) => line.text)
            .join('\n')}
        </div>
      </div>

      {handoffSeat !== null && <HandoffOverlay seat={handoffSeat} onReady={ackHandoff} />}
    </div>
  );
}
