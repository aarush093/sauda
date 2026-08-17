/**
 * W1 (first-player pass): the landscape-only rotate screen and the app-root orientation guard.
 * Two properties matter and are proven here:
 *   1. In portrait the app shows the rotate INVITATION instead of any real screen — and only in portrait.
 *   2. Rotating a GAME IN PROGRESS to portrait and back returns to EXACTLY the same game state (the
 *      state lives in the external store, so swapping the whole tree loses nothing).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { RotateScreen } from './RotateScreen';
import { App } from '../App';
import { useGame } from '../game/store';

// Drive jsdom's reported viewport, then fire the resize the orientation hook listens for.
function setViewport(width: number, height: number): void {
  (window as unknown as { innerWidth: number }).innerWidth = width;
  (window as unknown as { innerHeight: number }).innerHeight = height;
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

const LANDSCAPE: [number, number] = [844, 390]; // iPhone 12 landscape
const PORTRAIT: [number, number] = [390, 844]; // the same device, rotated

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useGame.getState().reset();
  window.location.hash = '#/';
  setViewport(...LANDSCAPE); // every test starts landscape unless it rotates
});
afterEach(() => {
  cleanup();
  errorSpy.mockRestore();
  setViewport(1024, 768); // restore the jsdom default so other suites see landscape
});

describe('RotateScreen', () => {
  it('renders the invitation — the line and the Go fullscreen control — without errors', () => {
    render(<RotateScreen />);
    expect(screen.getByText(/is played in landscape/i)).toBeTruthy();
    expect(screen.getByText('Go fullscreen')).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('App orientation guard (W1)', () => {
  it('shows the game in landscape and never the rotate screen', () => {
    setViewport(...LANDSCAPE);
    render(<App />);
    expect(screen.getByText('KHELO')).toBeTruthy();
    expect(screen.queryByText(/is played in landscape/i)).toBeNull();
  });

  it('swaps to the rotate screen the moment the device is portrait', () => {
    render(<App />);
    expect(screen.getByText('KHELO')).toBeTruthy();
    setViewport(...PORTRAIT);
    expect(screen.getByText(/is played in landscape/i)).toBeTruthy();
    expect(screen.queryByText('KHELO')).toBeNull();
  });

  it('preserves an in-progress game across a portrait→landscape rotation', () => {
    // Deal a real game straight into the store (human seat 0 + 3 medium bots).
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
    window.location.hash = '#/play';
    setViewport(...LANDSCAPE);
    render(<App />);
    const before = useGame.getState().state;
    expect(before).not.toBeNull();
    expect(screen.getByText('You')).toBeTruthy(); // the board is up

    // Rotate to portrait: the rotate screen replaces the board, the game unchanged in the store.
    setViewport(...PORTRAIT);
    expect(screen.getByText(/is played in landscape/i)).toBeTruthy();
    expect(useGame.getState().state).toBe(before); // same object — nothing was reset

    // Rotate back: the board returns to exactly the same game.
    setViewport(...LANDSCAPE);
    expect(screen.getByText('You')).toBeTruthy();
    expect(useGame.getState().state).toBe(before);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
