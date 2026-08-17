/**
 * useCoachMark (W2, first-player pass) — the small stateful controller that turns the pure trigger
 * engine (onboarding.ts) into ONE live coach mark at a time, over the player's real game. Its rules,
 * exactly as the owner set them:
 *   - a mechanic teaches the FIRST time it is available and NEVER again (persisted via tips.ts);
 *   - only ONE coach mark on screen at a time;
 *   - the mark disappears the moment the player performs the move (the game state advances) or taps it
 *     off (the ✕);
 *   - if the player dismisses two in a row without acting, onboarding goes QUIET for the rest of that
 *     turn (no nagging);
 *   - it plays NO move and never touches legalActions — it only reads the engine's offer.
 *
 * The controller lives entirely off the store's `state` identity: `state` is a fresh object after every
 * applied action, so "did the player act?" is just `state !== theStateWhenWeShowedThisCoach`. Nothing
 * here schedules on a timer — a coach appears exactly because a move became legal, and clears exactly
 * because a move happened.
 */
import { useEffect, useRef, useState } from 'react';
import type { Action, GameState, Observation } from '@sauda/engine';
import { availableMechanics, coachFor } from './onboarding';
import type { CoachContent, Mechanic } from './onboarding';
import { markTaught, taughtMechanics } from '../shell/tips';

export interface CoachMarkController {
  coach: CoachContent | null;
  dismiss: () => void; // a tap-off (the ✕) — counts toward the two-in-a-row-goes-quiet rule
}

interface Params {
  state: GameState | null; // the live game state — its identity changes on every applied action
  observation: Observation | null; // the acting human's observation (null when it is not a human's moment)
  actions: Action[]; // the acting human's legalActions (empty on a bot's turn)
  enabled: boolean; // tips on, and not paused / handing off / game over
  resetToken?: number; // bump to reload the taught set after "Reset tips" — every mechanic teaches again
}

// The turn this observation belongs to — a coach's dismissal count and quiet flag reset when it changes.
function turnKeyOf(observation: Observation | null): string {
  return observation ? `${observation.turnCount}:${observation.currentPlayer}` : '';
}

export function useCoachMark({ state, observation, actions, enabled, resetToken = 0 }: Params): CoachMarkController {
  // The taught set is loaded once (from storage) and kept in a ref, so a mechanic taught THIS session is
  // suppressed immediately even before storage round-trips.
  const taught = useRef<Set<Mechanic> | null>(null);
  if (taught.current === null) {
    taught.current = taughtMechanics();
  }
  // "Reset tips" clears storage and bumps resetToken — reload the in-memory set so the coaching returns
  // this session too (not only after a reload). The first render (token 0) is a no-op past the load above.
  const seenResetToken = useRef(0);
  if (resetToken !== seenResetToken.current) {
    seenResetToken.current = resetToken;
    taught.current = taughtMechanics();
  }

  const [active, setActive] = useState<Mechanic | null>(null);
  const shownAtState = useRef<GameState | null>(null); // the state when `active` was shown → detects "acted"
  const dismissalsThisTurn = useRef(0);
  const quietForTurn = useRef<string | null>(null); // the turnKey we've gone quiet for (2 dismissals)
  const currentTurn = useRef<string>('');

  // Latest inputs in a ref so the effect (keyed on stable primitives) always reads fresh values without
  // re-subscribing on every new object identity.
  const latest = useRef<Params>({ state, observation, actions, enabled });
  latest.current = { state, observation, actions, enabled };

  const turnKey = turnKeyOf(observation);
  const available = enabled && observation ? availableMechanics(observation, actions) : [];
  const availableKey = available.join(',');

  useEffect(() => {
    const now = latest.current;
    if (!now.enabled || !now.observation) {
      if (active !== null) {
        setActive(null);
      }
      return;
    }

    // A new turn resets the dismissal counter and lifts any quiet flag.
    const key = turnKeyOf(now.observation);
    if (key !== currentTurn.current) {
      currentTurn.current = key;
      dismissalsThisTurn.current = 0;
      quietForTurn.current = null;
    }

    const availableNow = availableMechanics(now.observation, now.actions);

    if (active !== null) {
      // The taught move happened (state advanced since we showed it) or the mechanic is simply gone.
      const acted = now.state !== shownAtState.current;
      if (acted || !availableNow.includes(active)) {
        setActive(null);
      }
      return; // one coach at a time — nothing else while one is up
    }

    if (quietForTurn.current === key) {
      return; // two dismissals this turn — stay quiet until the turn changes
    }

    const next = availableNow.find((mechanic) => !taught.current!.has(mechanic));
    if (next) {
      taught.current!.add(next);
      markTaught(next); // teach-once, persisted
      shownAtState.current = now.state;
      setActive(next);
    }
  }, [state, turnKey, availableKey, enabled, active]);

  const dismiss = () => {
    dismissalsThisTurn.current += 1;
    if (dismissalsThisTurn.current >= 2) {
      quietForTurn.current = currentTurn.current; // gone quiet for the rest of this turn
    }
    setActive(null);
  };

  return { coach: active ? coachFor(active) : null, dismiss };
}
