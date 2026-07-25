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
import { HandoffOverlay } from './HandoffOverlay';

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
  const isBotTurn = seats[actor]?.kind === 'bot';

  return (
    <div className="table">
      <h2>SAUDA</h2>
      <Board observation={observation} seats={seats} />

      {state.phase === 'gameOver' ? (
        <div className="winner">
          Player {state.winnerIndex} wins! <button onClick={reset}>New game</button>
        </div>
      ) : isBotTurn ? (
        <div className="waiting">Player {actor} is thinking…</div>
      ) : (
        <ActionPanel
          actions={legalActions(state, actor)}
          observation={observe(state, actor)}
          onAct={dispatch}
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
