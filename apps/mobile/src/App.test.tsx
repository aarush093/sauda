/**
 * React mount smoke tests: the app renders the Home screen, and starting a game
 * shows the Table with the board — all without throwing or logging errors.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { App } from './App';
import { useGame } from './game/store';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useGame.getState().reset();
});
afterEach(() => {
  cleanup();
  errorSpy.mockRestore();
});

describe('App', () => {
  it('renders the Home screen', () => {
    render(<App />);
    expect(screen.getByText('Start game')).toBeTruthy();
  });

  it('starts a game and shows the board', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Start game'));
    // The Table renders the play-table skeleton straight from the engine observation
    // (the hand is now a visual CardFace fan, so we assert a stable structural label).
    expect(screen.getByText('centre stage')).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
