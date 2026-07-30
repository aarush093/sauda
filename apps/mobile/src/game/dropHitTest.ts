/**
 * Shared drop-zone hit-test for the two drag paths (the hand-fan scrub and the placed-wildcard
 * rearrange token). It asks the DOM which eligible drop zone sits under a screen point — the
 * zone's own `data-drop` id is the answer, so there is no hand-maintained geometry table to
 * drift out of sync. The floating drag preview must be pointer-events:none so it never hides the
 * zone beneath it from elementFromPoint.
 */
export function hotZoneAt(clientX: number, clientY: number, eligible: ReadonlySet<string>): string | null {
  const zone = document.elementFromPoint(clientX, clientY)?.closest('[data-drop]');
  const id = zone?.getAttribute('data-drop') ?? null;
  return id !== null && eligible.has(id) ? id : null;
}
