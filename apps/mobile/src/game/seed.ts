/**
 * Seed source (S6a — owner playtest, 13 Aug). Every NEW game draws a fresh, unpredictable seed, so
 * no two games deal the same. Before this, the Home/KHELO path used `Math.random()` (fresh, but not
 * crypto-strength) and — the real fault the owner hit — the `#/autostart` route dealt one FIXED seed
 * (424242) every time, so playing through the tunnel replayed a single identical deal forever.
 *
 * Determinism is preserved for tooling through exactly ONE explicit door here: `?seed=<n>` on any
 * route (the query may sit before the hash — `/?seed=7#/play` — or inside the hash's own query —
 * `#/play?seed=7`). `window.__replay(seed, …)` (store.ts) is the other deterministic door and is
 * untouched, so every capture/measure/scenario harness keeps producing identical output.
 *
 * The active seed is surfaced in the HUD (`?hud=1`) so a game worth keeping — one the owner loves or
 * hates — can be reproduced exactly by re-opening it with `?seed=<that number>`.
 */

// Parse an explicit `?seed=<n>` override out of a full URL. Checks both the pre-hash query and the
// hash's own query (hash routing puts route params after `#`), so the override works on any route.
// Returns a uint32 seed, or null when absent/invalid (the caller then falls back to a fresh seed).
export function parseSeedOverride(href: string): number | null {
  const hashIdx = href.indexOf('#');
  const beforeHash = hashIdx === -1 ? href : href.slice(0, hashIdx);
  const afterHash = hashIdx === -1 ? '' : href.slice(hashIdx + 1);
  const queries: string[] = [];
  const q1 = beforeHash.indexOf('?');
  if (q1 !== -1) {
    queries.push(beforeHash.slice(q1 + 1));
  }
  const q2 = afterHash.indexOf('?');
  if (q2 !== -1) {
    queries.push(afterHash.slice(q2 + 1));
  }
  for (const query of queries) {
    const raw = new URLSearchParams(query).get('seed');
    if (raw !== null && raw.trim() !== '') {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0) {
        return n >>> 0; // clamp to mulberry32's uint32 domain
      }
    }
  }
  return null;
}

// A fresh unpredictable uint32 — crypto-strength wherever the Web Crypto API exists (every target
// browser and jsdom), falling back to Math.random only if it does not.
export function freshSeed(): number {
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    cryptoObj.getRandomValues(buffer);
    return buffer[0]! >>> 0;
  }
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

// The seed a new game should use: an explicit `?seed` override when present (deterministic, for
// tooling and for replaying a remembered game), else a fresh crypto seed.
export function resolveSeed(): number {
  const href = typeof window !== 'undefined' ? window.location.href : '';
  return parseSeedOverride(href) ?? freshSeed();
}
