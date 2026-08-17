/**
 * W2 — the coach mark UI. Two things are proven here: the card renders its teaching content + controls,
 * and (the owner's explicit ask) a coach's Niyam link opens the Book chapter OVER the live game and
 * returns to EXACTLY the same game state — no move made, nothing reset.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { CoachMark } from './CoachMark';
import { Table } from './Table';
import { coachFor } from '../game/onboarding';
import { useGame } from '../game/store';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  localStorage.clear();
  useGame.getState().reset();
});
afterEach(() => {
  cleanup();
  errorSpy.mockRestore();
});

describe('CoachMark card', () => {
  it('renders the title, line, Niyam link and dismiss, and fires their handlers', () => {
    const onDismiss = vi.fn();
    const onOpenNiyam = vi.fn();
    const coach = coachFor('bank');
    render(<CoachMark coach={coach} onDismiss={onDismiss} onOpenNiyam={onOpenNiyam} />);

    expect(screen.getByText(coach.title)).toBeTruthy();
    expect(screen.getByText(coach.line)).toBeTruthy();

    fireEvent.click(screen.getByText(`${coach.niyamLabel} →`));
    expect(onOpenNiyam).toHaveBeenCalledWith(coach.niyam);

    fireEvent.click(screen.getByLabelText('Dismiss tip'));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('coach → Book jump and return keeps the game intact (W2)', () => {
  it('opens the coach\'s chapter over the game and returns to the same state', () => {
    // Deal a real game — human seat 0 + 3 bots. It is the human's turn, so a coach mark appears.
    act(() => {
      useGame.getState().newGame({
        seats: [
          { kind: 'human' },
          { kind: 'bot', difficulty: 'medium' },
          { kind: 'bot', difficulty: 'medium' },
          { kind: 'bot', difficulty: 'medium' },
        ],
        seed: 424242,
      });
    });
    const { container } = render(<Table />);

    // A coach mark is up (the opening hand always offers a bank or a placement to teach first).
    const mark = container.querySelector('[data-coach-mark]');
    expect(mark).not.toBeNull();
    const stateBeforeBook = useGame.getState().state;
    expect(stateBeforeBook).not.toBeNull();

    // Tap the Niyam link → the Book opens over the game.
    const niyamButton = screen.getByText(/^Niyam \d/);
    fireEvent.click(niyamButton);
    expect(screen.getByLabelText('Close the book')).toBeTruthy();
    // Opening the book dispatched no engine action — the game state object is untouched.
    expect(useGame.getState().state).toBe(stateBeforeBook);

    // Close the Book → back to the same game, still the human's board, state still identical.
    fireEvent.click(screen.getByLabelText('Close the book'));
    expect(screen.queryByLabelText('Close the book')).toBeNull();
    expect(screen.getByText('You')).toBeTruthy();
    expect(useGame.getState().state).toBe(stateBeforeBook);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
