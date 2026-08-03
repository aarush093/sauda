import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FocusTransition } from './FocusTransition';

afterEach(cleanup);

// R1: the focus swap is a wrapper that must always RENDER its child (the layout) — the transition is
// transform/opacity only, so it can never remove or hide the content, only slide it. jsdom reports
// reduced motion as off by default, but the child is present either way.
describe('FocusTransition (focus-follows-turn swap)', () => {
  it('always renders the wrapped layout, in either direction', () => {
    render(<FocusTransition direction="mine">my world</FocusTransition>);
    expect(screen.getByText('my world')).toBeTruthy();
  });

  it('renders the spectate direction too', () => {
    render(<FocusTransition direction="spectate">spectating</FocusTransition>);
    expect(screen.getByText('spectating')).toBeTruthy();
  });
});
