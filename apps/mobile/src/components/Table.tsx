/**
 * The Table screen. It renders the board for the revealed player, and either the
 * legal-move panel (human's turn/response), a "thinking" note (bot's turn), or the
 * hand-off overlay. A small effect drives bot turns on a timer.
 *
 * Everything actionable is `legalActions(state, actor)`; every move is `dispatch`
 * (== reduce). No rule is decided here.
 */
import { useEffect } from 'react';
import { legalActions, observe } from '@sauda/engine';
import { actorOf, useGame, viewSeat } from '../game/store';
import { Board } from './Board';
import { ActionPanel } from './ActionPanel';
import { PaymentSheet } from './PaymentSheet';
import { InterruptPrompt } from './InterruptPrompt';
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
  // the board's tap→stage→rail; a charge-to-pay raises the payment sheet; any other
  // response (RESPOND_*) is left to the interim panel below, which stays functional until
  // the interrupt-prompt screen lands.
  const humanActions = !isBotTurn && !gameOver ? legalActions(state, actor) : [];
  const isResponse = humanActions.some((action) => action.type.startsWith('RESPOND_'));
  const payAction = humanActions.find((action) => action.type === 'RESPOND_PAY');
  const allowAction = humanActions.find((action) => action.type === 'RESPOND_ALLOW');
  const nahiAction = humanActions.find((action) => action.type === 'RESPOND_NAHI_CHALEGA');

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
      ) : (
        <ActionPanel actions={humanActions} observation={actorObservation} onAct={dispatch} />
      )}

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

      {/* an action played against me opens the NAHI CHALEGA window (INTERACTION_SPEC §7) */}
      {handoffSeat === null && allowAction && actorObservation.interrupt && (
        <InterruptPrompt
          interrupt={actorObservation.interrupt}
          canNahi={nahiAction !== undefined}
          onNahi={() => {
            if (nahiAction) {
              dispatch(nahiAction);
            }
          }}
          onAllow={() => dispatch({ type: 'RESPOND_ALLOW' })}
        />
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
