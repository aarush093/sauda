/**
 * H1b (excellence pass) — find a deterministic seed + action log that lands SEAT 0 (the human) in
 * `awaitingReceive`: a wildcard has been paid TO them and they must choose which set it joins
 * (RESPOND_PLACE_RECEIVED, matrix C7 / G6). The capture pipeline replays {seed, actions} through
 * `window.__replay` (4-seat table = 1 human + 3 medium bots, exactly CAPTURE_SEATS) to reach the
 * state, then films dragging the received card home. Run:
 *   pnpm --filter @sauda/tools exec tsx src/find-receive.ts
 * Prints a JSON {seed, actions} to paste into the capture script's RECEIVE base.
 */
import { createGame, legalActions, mulberry32, observe, reduce } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { HeuristicBot } from '@sauda/bots';

const MAX_ACTIONS = 3000;

function actorOf(state: ReturnType<typeof createGame>['state']): number {
  return state.pendingInterrupts.length > 0 ? state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder : state.currentPlayerIndex;
}

function search(seed: number): Action[] | null {
  const bot = new HeuristicBot('medium');
  const rng = mulberry32(seed);
  let { state } = createGame({ players: 4, seed });
  const log: Action[] = [];
  for (let i = 0; i < MAX_ACTIONS && state.phase !== 'gameOver'; i++) {
    const actor = actorOf(state);
    const legal = legalActions(state, actor);
    if (legal.length === 0) break;
    // The target: seat 0 must place a received card. Stop BEFORE applying it — the log so far lands
    // the UI exactly on the receive stage, with the card glowing on centre stage.
    if (actor === 0 && legal.some((a) => a.type === 'RESPOND_PLACE_RECEIVED')) {
      return log;
    }
    const action = bot.chooseAction(observe(state, actor), legal, rng);
    const result = reduce(state, action);
    if (!result.ok) break;
    log.push(action);
    state = result.value.state;
  }
  return null;
}

function main() {
  for (let seed = 1; seed <= 4000; seed++) {
    const log = search(seed);
    if (log) {
      console.log(`FOUND seed ${seed} — ${log.length} actions to seat-0 awaitingReceive`);
      console.log(JSON.stringify({ seed, actions: log }));
      return;
    }
  }
  console.log('no receive state found in seeds 1..4000');
}

main();
