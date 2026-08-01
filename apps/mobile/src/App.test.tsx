/**
 * React mount smoke tests: the app renders the Home shell, and the KHELO → setup → DEAL flow deals
 * into the Table with the board — all without throwing or logging errors (P8 shell).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { App } from './App';
import { useGame } from './game/store';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useGame.getState().reset();
  window.location.hash = '#/'; // start each test at the Home route
});
afterEach(() => {
  cleanup();
  errorSpy.mockRestore();
});

describe('App', () => {
  it('renders the Home shell with the KHELO door', () => {
    render(<App />);
    expect(screen.getByText('KHELO')).toBeTruthy();
  });

  it('KHELO → DEAL deals a game and shows the board', () => {
    render(<App />);
    fireEvent.click(screen.getByText('KHELO')); // opens the inline setup card
    fireEvent.click(screen.getByText('DEAL')); // deals with the default 3 bots + medium
    // The Table renders the play table straight from the engine observation. Assert the turn chip —
    // a stable label on the human's turn (the human is seat 0, whose turn it is at game start).
    expect(screen.getByText('Your turn')).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
