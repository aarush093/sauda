import { describe, it, expect } from 'vitest';
import { resolveZones, ZONE_LIMITS } from './zoneLayout';

// The clamped-flex law (P1 — owner phone test 1 Aug). These lock the promises the owner cares about:
// no void (the zones always sum to the exact viewport), an idle stage stays collapsed, surplus goes
// to the thumb zone first, and the tightest screen never clips a legal move out of reach.
describe('zone layout (clamped flex v2)', () => {
  it('always fills the viewport exactly — no void, no overflow', () => {
    for (const h of [560, 700, 740, 800, 832, 915, 1000]) {
      const z = resolveZones(h);
      expect(z.opponents + z.table + z.stage + z.myArea).toBe(h);
    }
  });

  it('keeps the table band fixed at every height', () => {
    for (const h of [560, 740, 915]) {
      expect(resolveZones(h).table).toBe(ZONE_LIMITS.tableBand);
    }
  });

  it('collapses the idle stage toward its content (surplus does not inflate it first)', () => {
    // On the common 360x740 there is surplus, but the stage should stay near its min, not balloon.
    const z = resolveZones(740);
    expect(z.stage).toBe(ZONE_LIMITS.stageMin);
    // Only once my area AND opponents are capped does the stage grow — on a very tall screen.
    const tall = resolveZones(1100);
    expect(tall.stage).toBeGreaterThan(ZONE_LIMITS.stageMin);
    expect(tall.stage).toBeLessThanOrEqual(ZONE_LIMITS.stageMax);
  });

  it('flows surplus to my area first (the thumb zone is the largest, A2)', () => {
    const z = resolveZones(740);
    expect(z.myArea).toBeGreaterThanOrEqual(ZONE_LIMITS.myAreaMin);
    expect(z.myArea).toBeGreaterThan(z.stage);
    expect(z.myArea).toBeGreaterThan(z.opponents);
  });

  it('respects the max caps and grows opponents only after my area is full', () => {
    const mid = resolveZones(832);
    expect(mid.myArea).toBeLessThanOrEqual(ZONE_LIMITS.myAreaMax);
    expect(mid.opponents).toBeGreaterThanOrEqual(ZONE_LIMITS.opponentsMin);
    expect(mid.opponents).toBeLessThanOrEqual(ZONE_LIMITS.opponentsMax);
  });

  it('protects my area when the screen is too short (shrinks stage + opponents first)', () => {
    const starved = resolveZones(500); // below the sum of the soft mins
    expect(starved.opponents + starved.table + starved.stage + starved.myArea).toBe(500);
    // My area keeps its full min; the stage and opponents are the ones that dipped below their mins.
    expect(starved.myArea).toBe(ZONE_LIMITS.myAreaMin);
    expect(starved.stage).toBeLessThanOrEqual(ZONE_LIMITS.stageMin);
    expect(starved.stage).toBeGreaterThanOrEqual(ZONE_LIMITS.stageHardMin);
  });
});
