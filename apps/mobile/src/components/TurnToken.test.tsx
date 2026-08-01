/**
 * K3 turn-token state matrix. The token's mode decision is a pure function, so the whole matrix the
 * owner called out — plays>0, plays==0, win-legal, early-end arming, and the win-overrides-drain
 * safety — is provable without a DOM or timers. (The rAF drain and the rearrange-pause are timing
 * behaviours over this same mode; a rearrange never CHANGES the mode, it only pauses the countdown,
 * which the tests below make explicit.)
 */
import { describe, it, expect } from 'vitest';
import { turnTokenMode } from './TurnToken';

const base = { active: true, playsRemaining: 3, winLegal: false, endTurnLegal: true, armed: false };

describe('turnTokenMode', () => {
  it('is inert off my turn, whatever else is true', () => {
    expect(turnTokenMode({ ...base, active: false })).toBe('inert');
    expect(turnTokenMode({ ...base, active: false, winLegal: true, playsRemaining: 0 })).toBe('inert');
  });

  it('is idle with plays remaining and not armed', () => {
    expect(turnTokenMode(base)).toBe('idle');
    expect(turnTokenMode({ ...base, playsRemaining: 1 })).toBe('idle');
  });

  it('arms an early end while plays remain', () => {
    expect(turnTokenMode({ ...base, armed: true })).toBe('armed');
    expect(turnTokenMode({ ...base, playsRemaining: 2, armed: true })).toBe('armed');
  });

  it('drains once every play is spent and END_TURN is legal', () => {
    expect(turnTokenMode({ ...base, playsRemaining: 0 })).toBe('draining');
  });

  it('does not drain if END_TURN is somehow not legal yet (never auto-ends an illegal move)', () => {
    expect(turnTokenMode({ ...base, playsRemaining: 0, endTurnLegal: false })).toBe('idle');
  });

  it('shows the SAUDA! declare whenever a win is legal — and win OVERRIDES the drain', () => {
    expect(turnTokenMode({ ...base, winLegal: true })).toBe('win');
    // the critical safety: 0 plays + declarable win must be win, NOT draining, so the turn can never
    // auto-end before the player claims the game.
    expect(turnTokenMode({ ...base, playsRemaining: 0, winLegal: true })).toBe('win');
  });

  it('an armed flag is ignored once a win is declarable or the turn is draining', () => {
    expect(turnTokenMode({ ...base, winLegal: true, armed: true })).toBe('win');
    expect(turnTokenMode({ ...base, playsRemaining: 0, armed: true })).toBe('draining');
  });
});
