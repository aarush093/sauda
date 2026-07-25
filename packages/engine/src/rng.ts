/**
 * Seeded random number generation.
 *
 * §8.1 / CONTRIBUTING.md: the engine must be deterministic — the same seed must
 * reproduce the same game (needed for replay, debugging and ML trajectories).
 * So `Math.random` is banned in the engine (enforced by ESLint); we use
 * mulberry32, a tiny, well-known seeded PRNG, instead.
 */

// A source of randomness: call it to get a float in [0, 1), like Math.random
// but deterministic given its seed.
export type Rng = () => number;

// mulberry32: a compact 32-bit seeded PRNG. Given the same seed it always
// produces the same sequence, which is exactly the determinism we need.
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates shuffle driven by a seeded Rng. Returns a new array and leaves
// the input untouched, so a given (deck, seed) pair always shuffles the same way.
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const atI = result[i]!;
    const atJ = result[j]!;
    result[i] = atJ;
    result[j] = atI;
  }
  return result;
}

// --- Serialisable RNG state (used inside GameState) ---
//
// mulberry32 keeps its entire state in one 32-bit integer. Storing that integer
// in GameState (instead of a closure) is what lets a mid-game reshuffle stay
// deterministic AND lets the whole state be saved to disk (M4) and replayed.
// Each step is a pure function: state in, {value, next state} out.

// Normalises a seed into the integer form we store in GameState.
export function initialRngState(seed: number): number {
  return seed >>> 0;
}

// One deterministic step of mulberry32: returns the random value and the next state.
export function nextRandom(state: number): { value: number; state: number } {
  const advanced = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(advanced ^ (advanced >>> 15), 1 | advanced);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: advanced };
}

// Fisher–Yates shuffle that threads and returns the RNG state, so the caller can
// store the advanced state back into GameState after a shuffle.
export function shuffleWithState<T>(
  items: readonly T[],
  state: number,
): { items: T[]; state: number } {
  const result = items.slice();
  let rngState = state;
  for (let i = result.length - 1; i > 0; i--) {
    const step = nextRandom(rngState);
    rngState = step.state;
    const j = Math.floor(step.value * (i + 1));
    const atI = result[i]!;
    const atJ = result[j]!;
    result[i] = atJ;
    result[j] = atI;
  }
  return { items: result, state: rngState };
}
