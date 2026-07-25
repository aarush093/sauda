/**
 * Render tests for CardFace (M4a): every distinct face renders at all three sizes
 * without throwing, and the live layer shows the right engine-derived text.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SETS } from '@sauda/engine';
import { CardFace } from './CardFace';
import { representativeCardIds } from '../design/cardData';

afterEach(cleanup);

describe('CardFace', () => {
  it('renders every distinct face at FULL, MID and CHIP without throwing', () => {
    const ids = representativeCardIds();
    expect(ids.length).toBeGreaterThan(40);
    for (const cardId of ids) {
      for (const size of ['full', 'mid', 'chip'] as const) {
        expect(() => {
          const { unmount } = render(<CardFace cardId={cardId} size={size} heldCount={1} />);
          unmount();
        }, `${cardId} @ ${size}`).not.toThrow();
      }
    }
  });

  it('shows a property’s name, ledger rent and full-set value from the engine', () => {
    // mumbai (size 2) — full-set rent is ₹8; the FULL SET row and value come from theme.
    render(<CardFace cardId="prop_mumbai_0" size="full" />);
    expect(screen.getByText('Marine Drive')).toBeTruthy();
    expect(screen.getByText('FULL SET')).toBeTruthy();
    expect(screen.getByText(`₹${SETS.mumbai.rent[SETS.mumbai.rent.length - 1]} Cr`)).toBeTruthy();
  });

  it('renders money as a rupee note', () => {
    render(<CardFace cardId="money_10_0" size="full" />);
    expect(screen.getByText('₹10')).toBeTruthy();
  });

  it('shows an action’s English descriptor next to its desi name', () => {
    render(<CardFace cardId="action_kabza_0" size="full" />);
    expect(screen.getByText('Kabza')).toBeTruthy();
    expect(screen.getByText('Steal a complete set')).toBeTruthy();
  });
});
