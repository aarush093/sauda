import { describe, it, expect } from 'vitest';
import { titleInkForPlate } from './titleInk';
import { INK } from './tokens';

// §3 title legibility: the ink is chosen per plate by contrast against the banner
// (normally the set colour), with an override map for plates whose painted banner
// differs. 'freshPlate' is any plate id NOT in the override map, so it exercises
// the pure set-colour path.
const freshPlate = 'freshPlate';

describe('titleInkForPlate', () => {
  it('uses cream ink on dark set banners', () => {
    expect(titleInkForPlate(freshPlate, 'puraniDilli').name).toBe(INK.cardCream); // brown
    expect(titleInkForPlate(freshPlate, 'jaipur').name).toBe(INK.cardCream); // magenta
    expect(titleInkForPlate(freshPlate, 'kolkata').name).toBe(INK.cardCream); // royal violet (v2)
    expect(titleInkForPlate(freshPlate, 'mumbai').name).toBe(INK.cardCream); // prussian navy
    expect(titleInkForPlate(freshPlate, 'newDelhi').name).toBe(INK.cardCream); // leaf green
    expect(titleInkForPlate(freshPlate, 'junction').name).toBe(INK.cardCream); // press-ink black
  });

  it('uses dark ink on light/bright set banners', () => {
    expect(titleInkForPlate(freshPlate, 'kashi').name).toBe(INK.deepInk); // kesari saffron (v2)
    expect(titleInkForPlate(freshPlate, 'chennai').name).toBe(INK.deepInk); // chrome yellow
    expect(titleInkForPlate(freshPlate, 'bangalore').name).toBe(INK.deepInk); // azure sky blue
    expect(titleInkForPlate(freshPlate, 'utility').name).toBe(INK.deepInk); // sage green
  });

  it('keeps dark ink on the early gold-band plates (override)', () => {
    expect(titleInkForPlate('prop_mumbai_0', 'mumbai').name).toBe(INK.deepInk);
    expect(titleInkForPlate('prop_kashi_0', 'kashi').name).toBe(INK.deepInk);
    expect(titleInkForPlate('prop_jaipur_0', 'jaipur').name).toBe(INK.deepInk);
    expect(titleInkForPlate('prop_jaipur_1', 'jaipur').name).toBe(INK.deepInk);
  });

  it('pins the actual banner for palette-lock stragglers (override)', () => {
    expect(titleInkForPlate('prop_chennai_0', 'chennai').name).toBe(INK.cardCream); // still-red banner
    expect(titleInkForPlate('prop_bangalore_0', 'bangalore').name).toBe(INK.deepInk); // still-amber banner
    expect(titleInkForPlate('prop_newDelhi_0', 'newDelhi').name).toBe(INK.deepInk); // still-yellow banner
    expect(titleInkForPlate('prop_kashi_1', 'kashi').name).toBe(INK.cardCream); // still-teal banner (v2)
    expect(titleInkForPlate('prop_kolkata_0', 'kolkata').name).toBe(INK.deepInk); // still-vermillion banner (v2)
  });

  it('adds a keyline only when the ink is cream', () => {
    expect(titleInkForPlate(freshPlate, 'kolkata').keyline).toBe(true); // violet -> cream
    expect(titleInkForPlate(freshPlate, 'chennai').keyline).toBe(false); // chrome yellow -> dark
  });
});
