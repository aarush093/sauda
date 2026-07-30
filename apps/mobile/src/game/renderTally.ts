/**
 * DEV-ONLY render counter (tree-shaken from prod — every call site is behind `import.meta.env.DEV`).
 * Components bump a global tally on each render so the H4 measurement can PROVE that a drag re-renders
 * only the dragged layer and the zone glows, not the whole board's real-card cascades. Reset the
 * tally, perform an interaction, read `window.__renderTally` — the delta is the render count.
 */
export function tallyRender(name: string): void {
  const globals = globalThis as { __renderTally?: Record<string, number> };
  if (!globals.__renderTally) {
    globals.__renderTally = {};
  }
  globals.__renderTally[name] = (globals.__renderTally[name] ?? 0) + 1;
}
