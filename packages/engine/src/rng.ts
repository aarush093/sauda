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
