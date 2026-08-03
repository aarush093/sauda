import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { buildDeck } from '@sauda/engine';
import type { Card } from '@sauda/engine';
import { BankView } from './BankView';

afterEach(cleanup);

const DECK: Card[] = buildDeck();
const money = DECK.filter((c) => c.kind === 'money').slice(0, 3).map((c) => c.id);

// R3: the bank inspect shows the banked cards as real faces + the gold total, and closes on the
// backdrop / ✕ / Esc. The bank is public in this genre, so it renders whatever ids it is handed.
describe('BankView (R3 bank inspect)', () => {
  it('shows the title and the total', () => {
    render(<BankView title="You" cards={money} total={9} onClose={() => {}} />);
    expect(screen.getByText(/You — bank/)).toBeTruthy();
    expect(screen.getByText('₹9 Cr')).toBeTruthy();
  });

  it('shows an empty-bank message when there are no cards', () => {
    render(<BankView title="You" cards={[]} total={0} onClose={() => {}} />);
    expect(screen.getByText('The bank is empty.')).toBeTruthy();
  });

  it('closes on the ✕ control', () => {
    const onClose = vi.fn();
    render(<BankView title="Bot 1" cards={money} total={9} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
