/**
 * G3 (owner playtest 2): the full-screen discard overlay. This proves the overlay's own job — the
 * COUNT-DOWN heading and that tapping a card dispatches exactly that card's DISCARD. The UNDER-PILE
 * routing itself (a discard buried face-down at the bottom of the draw pile, house rule 813f1cd) is
 * the FROZEN engine's behaviour, proven in packages/engine/src/turn.test.ts (#15); the overlay only
 * dispatches the DISCARD the engine then routes there.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { DiscardOverlay } from './DiscardOverlay';

afterEach(cleanup);

// Real card ids so the inner CardFace renders; the click target is the wrapper's data-card-id.
const hand = (n: number): string[] =>
  ['money_1_0', 'money_1_1', 'money_1_2', 'money_1_3', 'money_1_4', 'money_1_5', 'money_2_0', 'money_2_1', 'money_2_2', 'money_2_3', 'money_2_4'].slice(0, n);

describe('DiscardOverlay — count-down + per-card discard (G3)', () => {
  it('counts down how many must still go (hand size − 7)', () => {
    const { rerender } = render(<DiscardOverlay cards={hand(9)} onDiscard={() => {}} />);
    expect(screen.getByText(/tap 2 to discard/)).toBeTruthy();
    rerender(<DiscardOverlay cards={hand(8)} onDiscard={() => {}} />);
    expect(screen.getByText(/tap 1 to discard/)).toBeTruthy();
  });

  it('spreads one tappable face per hand card', () => {
    const { container } = render(<DiscardOverlay cards={hand(9)} onDiscard={() => {}} />);
    expect(container.querySelectorAll('[data-card-id]')).toHaveLength(9);
  });

  it('tapping a card buries exactly that card (dispatches its DISCARD, once)', () => {
    const onDiscard = vi.fn();
    const { container } = render(<DiscardOverlay cards={hand(9)} onDiscard={onDiscard} />);
    fireEvent.click(container.querySelector('[data-card-id="money_2_0"]')!);
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledWith('money_2_0');
  });
});
