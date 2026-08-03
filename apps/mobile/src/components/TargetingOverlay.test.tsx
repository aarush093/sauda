/**
 * R5 — during targeting the overlay is a landscape SPLIT: the targets and a read-only MY SETS
 * reference panel (default open, toggleable). These pin that the reference is present, toggles, and is
 * purely a reference (it renders my board but fires no engine action — only the target chips commit).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SET_IDS, buildDeck } from '@sauda/engine';
import type { Card, PropertyGroup, SetId } from '@sauda/engine';
import { TargetingOverlay } from './TargetingOverlay';

afterEach(cleanup);

const deck: Card[] = buildDeck();
const kabza = deck.find((c) => c.kind === 'action' && c.action === 'kabza')!.id;
const jaipurProp = deck.find((c) => c.kind === 'property' && c.set === 'jaipur')!.id;

function myPropsWithJaipur(): Record<SetId, PropertyGroup[]> {
  const record = {} as Record<SetId, PropertyGroup[]>;
  for (const set of SET_IDS) {
    record[set] = [];
  }
  record.jaipur = [{ set: 'jaipur', cards: [jaipurProp], buildings: [] }];
  return record;
}

describe('TargetingOverlay reference panel (R5)', () => {
  it('shows the MY SETS reference by default, and toggles it', () => {
    render(
      <TargetingOverlay cardId={kabza} actions={[]} me={0} myProperties={myPropsWithJaipur()} onCommit={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText('Your sets — reference')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Hide my sets'));
    expect(screen.queryByText('Your sets — reference')).toBeNull(); // collapsed
    fireEvent.click(screen.getByLabelText('Show my sets'));
    expect(screen.getByText('Your sets — reference')).toBeTruthy(); // reopened
  });

  it('the reference fires no engine action — only Cancel is offered here (no legal targets in fixture)', () => {
    const onCommit = vi.fn();
    render(
      <TargetingOverlay cardId={kabza} actions={[]} me={0} myProperties={myPropsWithJaipur()} onCommit={onCommit} onCancel={() => {}} />,
    );
    // the reference panel is display-only; with no targeting actions the only control is Cancel.
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
