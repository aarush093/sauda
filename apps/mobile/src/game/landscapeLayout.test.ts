import { describe, it, expect } from 'vitest';
import { resolveMyTurn, resolveSpectate, LANDSCAPE } from './landscapeLayout';

// The four landscape testbed profiles (deviceProfiles.json, rotated). The zone maths must hold at
// every one — the layout is judged on device-emulated evidence, so it is proven here first.
const PROFILES: [number, number][] = [
  [740, 360], // legacy small — the tightest budget
  [800, 360],
  [832, 384],
  [915, 412],
];

describe('landscape MY TURN zones', () => {
  it('tiles the full width exactly: rail + three columns + three gutters === width', () => {
    for (const [width, height] of PROFILES) {
      const z = resolveMyTurn(width, height);
      expect(z.rail + z.leftCol + z.centre + z.rightCol + LANDSCAPE.gap * 3).toBe(width);
    }
  });

  it('splits the full height into a top row and a wheel band with no gap or overlap', () => {
    for (const [width, height] of PROFILES) {
      const z = resolveMyTurn(width, height);
      expect(z.topRow + z.wheelBand).toBe(height);
      expect(z.wheelBand).toBeGreaterThanOrEqual(LANDSCAPE.wheelBandMin);
      expect(z.wheelBand).toBeLessThanOrEqual(LANDSCAPE.wheelBandMax);
    }
  });

  it('keeps the side columns legible and the centre stage the widest column', () => {
    for (const [width, height] of PROFILES) {
      const z = resolveMyTurn(width, height);
      expect(z.leftCol).toBe(z.rightCol); // symmetric side columns
      expect(z.leftCol).toBeGreaterThanOrEqual(LANDSCAPE.sideColMin);
      expect(z.leftCol).toBeLessThanOrEqual(LANDSCAPE.sideColMax);
      expect(z.centre).toBeGreaterThan(z.leftCol); // the stage is always the widest
    }
  });

  it('gives the wheel the full content width (everything but the rail) to breathe', () => {
    for (const [width, height] of PROFILES) {
      const z = resolveMyTurn(width, height);
      expect(z.wheelContainer).toBe(width - z.rail);
      // the wheel container is far wider than the old portrait my-area (~344px) — the owner's ask.
      expect(z.wheelContainer).toBeGreaterThan(600);
    }
  });

  it('never produces a negative or zero centre even on the narrowest phone', () => {
    const z = resolveMyTurn(740, 360);
    expect(z.centre).toBeGreaterThan(0);
    expect(z.topRow).toBeGreaterThan(0);
  });
});

describe('landscape SPECTATE zones', () => {
  it('tiles the width: rail + gutter + acting panel + my panel === width', () => {
    for (const [width, height] of PROFILES) {
      const z = resolveSpectate(width, height);
      expect(z.rail + LANDSCAPE.gap + z.acting + z.mine).toBe(width);
    }
  });

  it('gives the acting bot the larger share, and keeps my panel real (non-zero)', () => {
    for (const [width, height] of PROFILES) {
      const z = resolveSpectate(width, height);
      expect(z.acting).toBeGreaterThanOrEqual(z.mine); // focus on the bot acting on me…
      expect(z.acting).toBeGreaterThanOrEqual(LANDSCAPE.spectateActingMin);
      expect(z.mine).toBeGreaterThan(0); // …but I always see my own board
    }
  });
});
