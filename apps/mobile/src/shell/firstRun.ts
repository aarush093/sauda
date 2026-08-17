/**
 * First-run memory (P8 shell). A tiny localStorage flag so the Home ribbon "Naye ho? Niyam se shuru
 * karo →" shows to a newcomer but never again after they finish a game. Guarded for jsdom / private
 * mode where localStorage may throw or be absent — it degrades to "treat as a returning player",
 * which just hides the ribbon (the safe default: never nag someone twice).
 */
const KEY = 'sauda:hasCompletedGame';

export function hasCompletedGame(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked → assume returning, so we don't nag
  }
}

export function markGameCompleted(): void {
  try {
    localStorage?.setItem(KEY, '1');
  } catch {
    // ignore — the ribbon simply may show once more; no harm
  }
}

// U3: the guided tutorial is auto-OFFERED once on the very first visit — an invitation, never a wall.
// After the player watches, skips, or declines it, the offer never auto-appears again (the permanent
// "Sikho" entry on Home always remains). Same jsdom / private-mode safety as above: a blocked store
// degrades to "already offered", so we never nag.
const TUTORIAL_KEY = 'sauda:tutorialOffered';

export function hasSeenTutorialOffer(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTutorialOfferSeen(): void {
  try {
    localStorage?.setItem(TUTORIAL_KEY, '1');
  } catch {
    // ignore — the offer may show once more; no harm
  }
}
