import { describe, it, expect, beforeEach } from 'vitest';
import { tipsEnabled, setTipsEnabled, taughtMechanics, markTaught, resetTips } from './tips';

// W2 — teach-once persistence. Tips default ON for a first-timer; each mechanic is remembered as taught
// so it never fires twice; "Reset tips" makes them all eligible again. jsdom provides a real
// localStorage, so these exercise the actual persistence.

beforeEach(() => {
  localStorage.clear();
});

describe('tips persistence (W2)', () => {
  it('defaults to ON, and remembers being switched off then on', () => {
    expect(tipsEnabled()).toBe(true); // a new player is taught by default
    setTipsEnabled(false);
    expect(tipsEnabled()).toBe(false);
    setTipsEnabled(true);
    expect(tipsEnabled()).toBe(true);
  });

  it('marks a mechanic taught once and remembers it (teach-once)', () => {
    expect(taughtMechanics().size).toBe(0);
    markTaught('bank');
    expect(taughtMechanics().has('bank')).toBe(true);
    markTaught('bank'); // idempotent — still just one
    markTaught('place');
    const taught = taughtMechanics();
    expect(taught.has('bank')).toBe(true);
    expect(taught.has('place')).toBe(true);
    expect(taught.size).toBe(2);
  });

  it('resetTips makes every mechanic eligible again but leaves the on/off switch alone', () => {
    setTipsEnabled(true);
    markTaught('bank');
    markTaught('declare');
    expect(taughtMechanics().size).toBe(2);
    resetTips();
    expect(taughtMechanics().size).toBe(0);
    expect(tipsEnabled()).toBe(true); // the switch is untouched by a reset
  });

  it('a corrupt taught value degrades to "nothing taught" instead of throwing', () => {
    localStorage.setItem('sauda:tipsTaught', 'not-json{');
    expect(taughtMechanics().size).toBe(0);
  });
});
