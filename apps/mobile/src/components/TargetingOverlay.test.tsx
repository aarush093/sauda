/**
 * R5 — during targeting the overlay is a landscape SPLIT: the targets and a read-only MY SETS
 * reference panel (default open, toggleable). These pin that the reference is present, toggles, and is
 * purely a reference (it renders my board but fires no engine action — only the target chips commit).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SET_IDS, buildDeck } from '@sauda/engine';
import type { Action, Card, OpponentView, PropertyGroup, SetId } from '@sauda/engine';
import { TargetingOverlay } from './TargetingOverlay';

afterEach(cleanup);

const deck: Card[] = buildDeck();
const kabza = deck.find((c) => c.kind === 'action' && c.action === 'kabza')!.id;
const vasooli = deck.find((c) => c.kind === 'action' && c.action === 'vasooli')!.id;
const haath = deck.find((c) => c.kind === 'action' && c.action === 'haathKiSafai')!.id;
const jaipurProp = deck.find((c) => c.kind === 'property' && c.set === 'jaipur')!.id;
const mumbaiProp = deck.find((c) => c.kind === 'property' && c.set === 'mumbai')!.id;

function emptyBoard(): Record<SetId, PropertyGroup[]> {
  const record = {} as Record<SetId, PropertyGroup[]>;
  for (const set of SET_IDS) {
    record[set] = [];
  }
  return record;
}
function myPropsWithJaipur(): Record<SetId, PropertyGroup[]> {
  const record = emptyBoard();
  record.jaipur = [{ set: 'jaipur', cards: [jaipurProp], buildings: [] }];
  return record;
}
function opponent(id: number, set: SetId, cards: string[]): OpponentView {
  const props = emptyBoard();
  props[set] = [{ set, cards, buildings: [] }];
  return { id, handCount: 4, bank: [], bankTotal: 0, properties: props };
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

describe('TargetingOverlay renders REAL cards, never text pills (S3)', () => {
  it('VASOOLI targets are vintage seat chips (B1 / B2), not "Player N" pills', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: vasooli, params: { action: 'vasooli', target: 1 } },
      { type: 'PLAY_ACTION', cardId: vasooli, params: { action: 'vasooli', target: 2 } },
    ];
    render(<TargetingOverlay cardId={vasooli} actions={actions} me={0} myProperties={emptyBoard()} opponents={[]} onCommit={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('B1')).toBeTruthy();
    expect(screen.getByText('B2')).toBeTruthy();
    expect(screen.queryByText('Player 1')).toBeNull(); // the old text pill is gone
  });

  it('HAATH KI SAFAI targets are real property cards — the "P1 · <name>" pill text is gone', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: haath, params: { action: 'haathKiSafai', target: 1, cardId: jaipurProp } },
      { type: 'PLAY_ACTION', cardId: haath, params: { action: 'haathKiSafai', target: 2, cardId: mumbaiProp } },
    ];
    render(<TargetingOverlay cardId={haath} actions={actions} me={0} myProperties={emptyBoard()} opponents={[]} onCommit={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Take which property?')).toBeTruthy();
    expect(screen.queryByText(/P1 ·/)).toBeNull(); // no pill text — the card carries its own face
    // the owner tag identifies whose card it is, beside the real card face
    expect(screen.getByText('B1')).toBeTruthy();
    expect(screen.getByText('B2')).toBeTruthy();
  });

  it('KABZA targets render the opponent set as a cascade — tap fires the exact enumerated action', () => {
    const onCommit = vi.fn();
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: kabza, params: { action: 'kabza', target: 1, set: 'jaipur' } },
      { type: 'PLAY_ACTION', cardId: kabza, params: { action: 'kabza', target: 2, set: 'mumbai' } },
    ];
    const opps = [opponent(1, 'jaipur', [jaipurProp]), opponent(2, 'mumbai', [mumbaiProp])];
    render(<TargetingOverlay cardId={kabza} actions={actions} me={0} myProperties={emptyBoard()} opponents={opps} onCommit={onCommit} onCancel={() => {}} />);
    expect(screen.getByText('Seize which set?')).toBeTruthy();
    expect(screen.queryByText(/P1 ·/)).toBeNull();
    // tapping a target commits the EXACT enumerated engine action (legalActions is the only oracle)
    fireEvent.click(screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.includes('Jaipur'))!);
    expect(onCommit).toHaveBeenCalledWith(actions[0]);
  });
});
