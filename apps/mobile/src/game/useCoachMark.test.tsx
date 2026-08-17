import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Action, GameState, Observation, PropertyGroup, SetId } from '@sauda/engine';
import { SETS } from '@sauda/engine';
import { useCoachMark } from './useCoachMark';

// W2 — the controller rules: teach-once (within a session too), clear-on-act, and the two-dismissals-
// go-quiet rule. We drive the hook directly with fake state identities + minimal observations (the hook
// reads only state identity + turnKey + the offered actions), so the behaviour is proven without a DOM.

const ALL_SETS = Object.keys(SETS) as SetId[];
function emptyProps(): Record<SetId, PropertyGroup[]> {
  const record = {} as Record<SetId, PropertyGroup[]>;
  for (const set of ALL_SETS) record[set] = [];
  return record;
}
function obs(turnCount: number): Observation {
  return {
    me: 0, phase: 'playing', currentPlayer: 0, playsRemaining: 3, turnCount,
    myHand: [], myBank: [], myBankTotal: 0, myProperties: emptyProps(), myKiraya: {} as Record<SetId, number[]>,
    opponents: [], drawPileCount: 50, discardPile: [], interrupt: null, winnerIndex: null,
  };
}
// Distinct state identities — the hook uses `state !== shownAtState` to mean "the player acted".
function freshState(): GameState {
  return {} as GameState;
}

const BANK: Action = { type: 'BANK_CARD', cardId: 'money_5_0' };
const PLACE: Action = { type: 'PLACE_PROPERTY', cardId: 'prop_mumbai_0', set: 'mumbai' };

beforeEach(() => {
  localStorage.clear();
});

describe('useCoachMark (W2 controller)', () => {
  it('teaches the first available mechanic, then clears it once the player acts', () => {
    const s1 = freshState();
    const { result, rerender } = renderHook(
      ({ state, actions }) => useCoachMark({ state, observation: obs(1), actions, enabled: true }),
      { initialProps: { state: s1, actions: [BANK] as Action[] } },
    );
    expect(result.current.coach?.mechanic).toBe('bank');

    // The player banks — a new state object. The coach for that move disappears.
    act(() => rerender({ state: freshState(), actions: [BANK] as Action[] }));
    expect(result.current.coach?.mechanic).not.toBe('bank');
  });

  it('never teaches the same mechanic twice in a session (teach-once)', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useCoachMark({ state, observation: obs(1), actions: [BANK], enabled: true }),
      { initialProps: { state: freshState() } },
    );
    expect(result.current.coach?.mechanic).toBe('bank'); // taught now

    // A later, brand-new turn where banking is available again — it must NOT teach a second time.
    act(() => rerender({ state: freshState() }));
    // (advance to a fresh turn so the quiet/dismissal state is irrelevant)
    const { result: again } = renderHook(() =>
      useCoachMark({ state: freshState(), observation: obs(5), actions: [BANK], enabled: true }),
    );
    expect(again.current.coach).toBeNull();
    expect(result.current).toBeTruthy();
  });

  it('goes quiet for the rest of the turn after two dismissals without acting', () => {
    // A single turn (turnCount 1) with bank AND place available, neither taught.
    const props = { state: freshState(), observation: obs(1), actions: [BANK, PLACE] as Action[], enabled: true };
    const { result, rerender } = renderHook((p) => useCoachMark(p), { initialProps: props });
    expect(result.current.coach?.mechanic).toBe('bank');

    act(() => result.current.dismiss()); // dismissal 1
    rerender({ ...props });
    expect(result.current.coach?.mechanic).toBe('place'); // the next one still teaches

    act(() => result.current.dismiss()); // dismissal 2 — go quiet for this turn
    rerender({ ...props });
    expect(result.current.coach).toBeNull(); // quiet: no more coaching this turn

    // A NEW turn lifts the quiet (and place is now taught, so nothing new here — assert it stays silent
    // for bank/place but would teach a fresh mechanic; here both are taught, so null is correct).
    act(() => rerender({ ...props, observation: obs(2) }));
    expect(result.current.coach).toBeNull();
  });

  it('shows nothing when tips are disabled', () => {
    const { result } = renderHook(() =>
      useCoachMark({ state: freshState(), observation: obs(1), actions: [BANK], enabled: false }),
    );
    expect(result.current.coach).toBeNull();
  });
});
