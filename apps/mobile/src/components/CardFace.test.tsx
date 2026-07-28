/**
 * Render tests for CardFace (M4a): every distinct face renders at all three sizes
 * without throwing, and the live layer shows the right engine-derived text.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SETS, buildDeck } from '@sauda/engine';
import { CardFace } from './CardFace';
import { representativeCardIds, plateKey } from '../design/cardData';

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

  it('shows a property’s set title, locality sublabel, ledger rent and full-set value', () => {
    // mumbai (size 2) — full-set rent is ₹8; the FULL SET row and value come from theme.
    render(<CardFace cardId="prop_mumbai_0" size="full" />);
    // Item B: the LARGE title is the set/city name; the small sublabel is the locality.
    expect(screen.getByText(SETS.mumbai.label)).toBeTruthy(); // "Mumbai" — set title
    expect(screen.getByText('Marine Drive')).toBeTruthy(); // locality sublabel
    expect(screen.getByText('FULL SET')).toBeTruthy();
    expect(screen.getByText(`₹${SETS.mumbai.rent[SETS.mumbai.rent.length - 1]} Cr`)).toBeTruthy();
  });

  it('renders money as a rupee note with the Cr unit', () => {
    render(<CardFace cardId="money_10_0" size="full" />);
    expect(screen.getByText('₹10')).toBeTruthy();
    expect(screen.getByText('Cr')).toBeTruthy(); // unit shown consistently
  });

  it('shows an action’s descriptor, ACTION label, and engine bank value badge', () => {
    render(<CardFace cardId="action_kabza_0" size="full" />);
    expect(screen.getByText('Kabza')).toBeTruthy();
    expect(screen.getByText('Steal a complete set')).toBeTruthy(); // effect text
    expect(screen.getByText('ACTION')).toBeTruthy();
    expect(screen.getByText('₹5 Cr')).toBeTruthy(); // value badge, from ACTIONS.kabza.value
  });

  it('shares one plate across every copy of an action kind', () => {
    const kabza = buildDeck().filter((card) => card.kind === 'action' && card.action === 'kabza');
    expect(kabza).toHaveLength(2);
    for (const card of kabza) {
      expect(plateKey(card)).toBe('action_kabza');
    }
  });

  it('shares one plate across every copy of a money denomination (item F wiring)', () => {
    const ones = buildDeck().filter((card) => card.kind === 'money' && card.value === 1);
    expect(ones).toHaveLength(6); // six ₹1 notes...
    for (const card of ones) {
      expect(plateKey(card)).toBe('money_1'); // ...all share one plate, keyed by denomination not per-copy id
    }
  });
});
