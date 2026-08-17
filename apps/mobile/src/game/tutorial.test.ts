/**
 * THE GUIDED TUTORIAL script (U3). These lock the demo's contract: it is a real, deterministic, fully
 * LEGAL engine game that ends in a human win; every teaching beat fires in order and links to a real
 * Book chapter; and it covers every move class the owner listed. If any scripted move ever became
 * illegal (a rules or crafted-state drift), the replay fails here — a broken demo can never ship.
 */
import { describe, it, expect } from 'vitest';
import {
  runTutorial,
  TUTORIAL_STEPS,
  BOOK_CHAPTER_COUNT,
  buildTutorialState,
} from './tutorial';
import type { TutorialMove } from './tutorial';

describe('guided tutorial script (U3)', () => {
  it('replays through the engine with every step legal, ending in a human SAUDA win', () => {
    const run = runTutorial();
    expect(run.error).toBeNull(); // names the first illegal step if this ever breaks
    expect(run.finishedInHumanWin).toBe(true);
    expect(run.states.length).toBe(TUTORIAL_STEPS.length + 1); // start + one per step
  });

  it('is fully deterministic — the same crafted start every time, all 106 cards present', () => {
    const a = buildTutorialState();
    const b = buildTutorialState();
    expect(a).toEqual(b);
    const count =
      a.drawPile.length +
      a.discardPile.length +
      a.players.reduce((sum, p) => sum + p.hand.length + p.bank.length +
        Object.values(p.properties).reduce((s, groups) => s + groups.reduce((g, grp) => g + grp.cards.length + grp.buildings.length, 0), 0), 0);
    expect(count).toBe(106);
  });

  it('covers every move class the owner listed, at least once', () => {
    const covered = new Set(TUTORIAL_STEPS.map((step) => step.move));
    const required: TutorialMove[] = [
      'draw', 'bank', 'place', 'complete', 'steal', 'lagaan', 'pay', 'nahi',
      'makaan', 'haveli', 'wildcard', 'rearrange', 'discard', 'declare',
    ];
    for (const move of required) {
      expect(covered.has(move), `missing tutorial move: ${move}`).toBe(true);
    }
  });

  it('shows a teaching beat before the FIRST occurrence of each move class, and never repeats one', () => {
    const beatMoves = TUTORIAL_STEPS.filter((step) => step.teach).map((step) => step.move);
    // one beat per distinct move that has a beat (no duplicate beats for the same move)
    expect(beatMoves.length).toBe(new Set(beatMoves).size);
    // the beat is on the FIRST step of that move class (nothing of that move appears before its beat)
    for (const step of TUTORIAL_STEPS) {
      if (!step.teach) continue;
      const firstIndex = TUTORIAL_STEPS.findIndex((s) => s.move === step.move);
      expect(TUTORIAL_STEPS.indexOf(step)).toBe(firstIndex);
    }
  });

  it('every teaching beat links to a real Book chapter with a non-empty label', () => {
    for (const step of TUTORIAL_STEPS) {
      if (!step.teach) continue;
      expect(step.teach.niyam).toBeGreaterThanOrEqual(1);
      expect(step.teach.niyam).toBeLessThanOrEqual(BOOK_CHAPTER_COUNT);
      expect(step.teach.title.length).toBeGreaterThan(0);
      expect(step.teach.niyamLabel.length).toBeGreaterThan(0);
    }
  });
});
