import { describe, it, expect } from 'vitest';
import { legalActions, observe, reduce } from '@sauda/engine';
import type { GameState } from '@sauda/engine';
import { buildTutorialState, TUTORIAL_STEPS } from './tutorial';
import type { TutorialMove } from './tutorial';
import { availableMechanics } from './onboarding';
import type { Mechanic } from './onboarding';

// W2 — PROVE the coach marks fire at the right moments in a REAL, engine-legal game the human plays.
// We reuse the deterministic tutorial game (a full legal match, seat 0 = the human) purely as a driver:
// at every human move, we check that the onboarding trigger — reading ONLY the engine's own legalActions
// + Observation — already reports the mechanic that move demonstrates as available, BEFORE the move is
// applied. That is exactly "teach the mechanic the instant it becomes relevant", verified against the
// engine, with nothing scripted about the onboarding itself.

// Each tutorial move class maps to the onboarding mechanic that would coach it (or null = no coach:
// draws are automatic, and the structural flow steps aren't teachable moves).
const MOVE_TO_MECHANIC: Record<TutorialMove, Mechanic | null> = {
  draw: null,
  flow: null,
  place: 'place',
  complete: 'complete',
  bank: 'bank',
  rearrange: 'rearrange',
  pay: 'pay',
  wildcard: 'wildcard',
  steal: 'target', // HAATH KI SAFAI is a targeted action
  makaan: 'building',
  haveli: 'building',
  lagaan: 'lagaan',
  nahi: 'nahi',
  discard: 'discard',
  declare: 'declare',
};

describe('onboarding fires at the right moment in a real player game (W2)', () => {
  it('every human teaching move is reported available by the trigger, the instant before it is made', () => {
    let state: GameState = buildTutorialState();
    const firedInOrder: Mechanic[] = [];

    for (const step of TUTORIAL_STEPS) {
      if (step.by === 'you') {
        const mechanic = MOVE_TO_MECHANIC[step.move];
        if (mechanic) {
          // The human is seat 0. The trigger sees exactly what the UI would: the human's legalActions +
          // Observation at this instant. The mechanic this move teaches must already be available.
          const available = availableMechanics(observe(state, 0), legalActions(state, 0));
          expect(available, `${step.move}/${mechanic} available before it is played`).toContain(mechanic);
          if (!firedInOrder.includes(mechanic)) {
            firedInOrder.push(mechanic);
          }
        }
      }
      // Apply the real engine action and carry on — the script is proven legal by tutorial.test.
      const result = reduce(state, step.action);
      expect(result.ok, `step ${step.move}/${step.action.type} is legal`).toBe(true);
      if (result.ok) {
        state = result.value.state;
      }
    }

    // Far more than the required four coach marks fire across one real game, and the win is reached.
    expect(firedInOrder.length).toBeGreaterThanOrEqual(4);
    expect(firedInOrder).toEqual(
      expect.arrayContaining(['place', 'complete', 'bank', 'pay', 'nahi', 'declare']),
    );
    expect(state.phase).toBe('gameOver');
    expect(state.winnerIndex).toBe(0);
  });

  it('a bot turn (the human is offered nothing) surfaces no coach', () => {
    // Drive to a bot turn: the tutorial's second step-block is the bot's. Find a state where seat 0 has
    // no legal actions of its own by replaying to just after the human ends turn 1.
    let state: GameState = buildTutorialState();
    for (const step of TUTORIAL_STEPS) {
      const isHumanEndingTurn1 = step.by === 'you' && step.action.type === 'END_TURN';
      const result = reduce(state, step.action);
      if (result.ok) {
        state = result.value.state;
      }
      if (isHumanEndingTurn1) {
        break; // now it is the bot's turn
      }
    }
    // On the bot's turn the human is offered nothing to do — the onboarding stays silent.
    expect(availableMechanics(observe(state, 0), legalActions(state, 0))).toEqual([]);
  });
});
