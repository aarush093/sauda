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
    // The Table renders the play table straight from the engine observation. It is the human's turn at
    // game start (human is seat 0), so the landscape MY TURN view renders — assert my own "You" header,
    // a stable board signal (LAYOUT v3 replaced the old "Your turn" table band with the focus-follows-
    // turn composition; the turn state now reads on the turn token, not a text chip).
    expect(screen.getByText('You')).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
