import { describe, it, expect } from 'vitest';
import { titleInkForPlate } from './titleInk';
import { INK } from './tokens';

// §3 title legibility: the ink is chosen per plate by contrast against the banner
// (the set colour), with an override map for plates whose banner differs.
describe('titleInkForPlate', () => {
  it('uses cream ink on dark banners', () => {
    expect(titleInkForPlate('prop_puraniDilli_0', 'puraniDilli').name).toBe(INK.cardCream); // brown
    expect(titleInkForPlate('prop_kashi_2', 'kashi').name).toBe(INK.cardCream); // teal
    expect(titleInkForPlate('prop_jaipur_2', 'jaipur').name).toBe(INK.cardCream); // magenta
    expect(titleInkForPlate('prop_mumbai_1', 'mumbai').name).toBe(INK.cardCream); // navy
  });

  it('uses dark ink on bright banners', () => {
    expect(titleInkForPlate('prop_kolkata_0', 'kolkata').name).toBe(INK.deepInk); // orange
    expect(titleInkForPlate('prop_bangalore_0', 'bangalore').name).toBe(INK.deepInk); // amber
  });

  it('honours the banner override for off-convention plates', () => {
    // mumbai_0 has a light gold banner (not the set's navy), so it keeps dark ink.
    expect(titleInkForPlate('prop_mumbai_0', 'mumbai').name).toBe(INK.deepInk);
  });

  it('adds a keyline only when the ink is cream', () => {
    expect(titleInkForPlate('prop_puraniDilli_0', 'puraniDilli').keyline).toBe(true);
    expect(titleInkForPlate('prop_kolkata_0', 'kolkata').keyline).toBe(false);
  });
});
