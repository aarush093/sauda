/**
 * NAHI CHALEGA chain resolution (§5).
 *
 * TEACHING NOTE: the spec describes a last-in-first-out stack of cancels — a NAHI
 * cancels the charge, a second NAHI cancels that cancel, and so on. Unwinding such
 * a stack always lands on a simple truth: the charge stands if an EVEN number of
 * NAHI cards were played, and is cancelled if ODD. So instead of pushing and
 * popping a stack, we just count. `chargeStandsByParity` is what the engine uses;
 * `chargeStandsByLifo` is the literal stack simulation kept only to PROVE the two
 * are identical (see interrupts.test.ts, chain depths 0–4).
 */

// What the engine uses: even NAHI count ⇒ the charge stands.
export function chargeStandsByParity(nahiCount: number): boolean {
  return nahiCount % 2 === 0;
}

// The literal spec model: start with the charge active, and let each NAHI flip
// whether the thing beneath it is cancelled. Used only to verify parity is correct.
export function chargeStandsByLifo(nahiCount: number): boolean {
  let cancelled = false;
  for (let i = 0; i < nahiCount; i++) {
    cancelled = !cancelled;
  }
  return !cancelled;
}
