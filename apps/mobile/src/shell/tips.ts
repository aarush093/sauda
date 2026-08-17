/**
 * ONBOARDING TIPS — persistence (W2, first-player pass). Three tiny pieces of localStorage back the
 * just-in-time coach marks:
 *   - `enabled`: the single "Show tips" switch (Home + the pause sheet). Default ON for a new player.
 *   - `taught`: the set of mechanics already taught — so each teaches ONCE, ever, then never again.
 *   - `resetTips()`: makes every mechanic eligible again (clears `taught`), for a player who wants the
 *     coaching back.
 *
 * Same jsdom / private-mode safety as firstRun.ts: a blocked or absent store degrades to a safe default
 * (tips ON, nothing taught yet) and simply doesn't persist — the coaching still works for the session,
 * it just won't remember across reloads. Never throws.
 */
import type { Mechanic } from '../game/onboarding';

const ENABLED_KEY = 'sauda:tipsEnabled';
const TAUGHT_KEY = 'sauda:tipsTaught';

// Tips are ON unless the player explicitly turned them off (the value is stored only as '0').
export function tipsEnabled(): boolean {
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true; // storage blocked → default to teaching (the helpful default for a first-timer)
  }
}

export function setTipsEnabled(on: boolean): void {
  try {
    localStorage?.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // ignore — the session still respects the in-memory choice via the caller's state
  }
}

// The mechanics already taught. Stored as a JSON array; a malformed value degrades to "nothing taught".
export function taughtMechanics(): Set<Mechanic> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TAUGHT_KEY) : null;
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as Mechanic[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markTaught(mechanic: Mechanic): void {
  try {
    const taught = taughtMechanics();
    taught.add(mechanic);
    localStorage?.setItem(TAUGHT_KEY, JSON.stringify([...taught]));
  } catch {
    // ignore — the in-memory set the hook keeps still stops a repeat within this session
  }
}

// "Reset tips" — every mechanic becomes eligible to teach again (does NOT change the on/off switch).
export function resetTips(): void {
  try {
    localStorage?.removeItem(TAUGHT_KEY);
  } catch {
    // ignore
  }
}
