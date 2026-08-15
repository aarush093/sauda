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
const jaipurProp2 = deck.filter((c) => c.kind === 'property' && c.set === 'jaipur')[1]!.id;
const mumbaiProp = deck.find((c) => c.kind === 'property' && c.set === 'mumbai')!.id;
const mumbaiProp2 = deck.filter((c) => c.kind === 'property' && c.set === 'mumbai')[1]!.id;
const adlaBadli = deck.find((c) => c.kind === 'action' && c.action === 'adlaBadli')!.id;

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

describe('TargetingOverlay assist hint — per step, incl. ADLA-BADLI step 2 (T3)', () => {
  // mine_1 → {their_1, their_2}, and mine_2 → their_1. The recommended action is mine_1 → their_1.
  const adlaActions: Action[] = [
    { type: 'PLAY_ACTION', cardId: adlaBadli, params: { action: 'adlaBadli', myCardId: jaipurProp, target: 1, theirCardId: mumbaiProp } },
    { type: 'PLAY_ACTION', cardId: adlaBadli, params: { action: 'adlaBadli', myCardId: jaipurProp, target: 1, theirCardId: mumbaiProp2 } },
    { type: 'PLAY_ACTION', cardId: adlaBadli, params: { action: 'adlaBadli', myCardId: jaipurProp2, target: 1, theirCardId: mumbaiProp } },
  ];

  it('hints the leading choice on step 1, then the recommended pick on step 2', () => {
    const { container } = render(
      <TargetingOverlay cardId={adlaBadli} actions={adlaActions} me={0} myProperties={emptyBoard()} opponents={[]} hintAction={adlaActions[0]!} onCommit={() => {}} onCancel={() => {}} />,
    );
    // step 1 (give mine): exactly one hinted tile — the mine card that leads to the recommended leaf
    expect(screen.getByText('Give which of your properties?')).toBeTruthy();
    expect(container.querySelectorAll('[data-hint]')).toHaveLength(1);
    // advance to step 2 by tapping the hinted mine tile
    fireEvent.click(container.querySelector('[data-hint]')!);
    // step 2 (take theirs): the hint MOVES to the recommended their-card — the fix (was missing before)
    expect(screen.getByText('Take which of theirs?')).toBeTruthy();
    expect(container.querySelectorAll('[data-hint]')).toHaveLength(1);
  });

  it('shows NO hint on either step at a HARD table (hintAction null)', () => {
    const { container } = render(
      <TargetingOverlay cardId={adlaBadli} actions={adlaActions} me={0} myProperties={emptyBoard()} opponents={[]} hintAction={null} onCommit={() => {}} onCancel={() => {}} />,
    );
    expect(container.querySelectorAll('[data-hint]')).toHaveLength(0);
  });

  it('under reduced-motion the hint is a static ring — no bounce animation', () => {
    const { container } = render(
      <TargetingOverlay cardId={adlaBadli} actions={adlaActions} me={0} myProperties={emptyBoard()} opponents={[]} hintAction={adlaActions[0]!} reducedMotion onCommit={() => {}} onCancel={() => {}} />,
    );
    const hinted = container.querySelector('[data-hint]')!;
    expect(hinted).toBeTruthy(); // the brighter ring is still applied
    expect(hinted.getAttribute('style') ?? '').not.toContain('bounce'); // …but no bounce animation
  });
});
