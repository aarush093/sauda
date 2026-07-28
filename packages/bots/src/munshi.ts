/**
 * MUNSHI — an offline, read-only in-game advisor (owner feature). Vintage-clerk
 * framing: a munshi is a trusted accounts-keeper who reads the table and whispers
 * one line of counsel.
 *
 * It shares the HeuristicBot brain: `recommend` ranks the CURRENT legal options
 * exactly as the bot does, and Munshi returns the top move (to highlight in gold in
 * the existing UI) plus one templated line of reasoning. Because both call the same
 * `recommend`, Munshi can never disagree with the bot.
 *
 * Hard constraints (see DECISIONS.md):
 *  - READ-ONLY: it consumes an Observation + the offered legalActions and returns a
 *    recommendation. It has no access to reduce or GameState — it is structurally
 *    incapable of mutating game state.
 *  - Project law: 3 uses per game, flat. No ads / purchases / earn-loops / carry-over.
 *  - Reasoning lines are a small template set keyed by WHY the top move ranked first.
 *    No free-form generation, no LLM — fully offline and deterministic.
 *  - UI wiring is M4b: this ships the module only.
 */
import type { Action, Observation, SetId } from '@sauda/engine';
import { SETS } from '@sauda/engine';
import { recommend } from './heuristic-bot';
import type { Difficulty, MunshiReason } from './heuristic-bot';

// Flat budget for the whole game (project law: no earn loops, no carry-over).
export const MUNSHI_USES_PER_GAME = 3;

export interface MunshiAdvice {
  action: Action; // the recommended legal action — highlight it with the gold glow
  reason: MunshiReason; // why it ranked first (keys the reasoning template)
  line: string; // one short, templated line of counsel (never free-form text)
}

export class Munshi {
  private uses: number;

  // A fresh Munshi per game (no carry-over). Difficulty picks the same evaluation
  // tier as the bot, so counsel matches the strength the player is facing.
  constructor(
    private readonly difficulty: Difficulty = 'medium',
    maxUses: number = MUNSHI_USES_PER_GAME,
  ) {
    this.uses = maxUses;
  }

  get usesRemaining(): number {
    return this.uses;
  }

  // One consultation at a decision the human owns (their turn / payment sheet /
  // interrupt prompt). Evaluates the current legal options and spends one use.
  // Returns null when the budget is spent, or when there is nothing to decide —
  // no use is spent in those cases.
  advise(observation: Observation, legalActions: Action[]): MunshiAdvice | null {
    if (this.uses <= 0 || legalActions.length === 0) {
      return null;
    }
    const { action, reason } = recommend(observation, legalActions, this.difficulty);
    this.uses -= 1;
    return { action, reason, line: reasoningLine(reason, action) };
  }
}

// The set colour a move concerns, if any — used by the two set-specific templates.
function setLabelOf(action: Action): string {
  let set: SetId | null = null;
  if (action.type === 'PLACE_PROPERTY') {
    set = action.set;
  } else if (action.type === 'REARRANGE_WILDCARD') {
    set = action.toSet;
  } else if (action.type === 'RESPOND_PLACE_RECEIVED') {
    set = action.set;
  } else if (action.type === 'PLAY_ACTION' && action.params.action === 'kabza') {
    set = action.params.set;
  }
  return set ? SETS[set].label : '';
}

// The reasoning template — ONE line per reason category, lightly parameterised by
// the set colour. Fully deterministic and offline (no free-form generation).
function reasoningLine(reason: MunshiReason, action: Action): string {
  const label = setLabelOf(action);
  switch (reason) {
    case 'completesSet':
      return label ? `Play it — that completes your ${label} set.` : 'Play it — that completes a set.';
    case 'deniesSet':
      return label
        ? `Kabza their ${label} set — a full colour, taken and denied.`
        : 'Kabza the set — a full colour, taken and denied.';
    case 'protectsSet':
      return 'Play Nahi Chalega — this threat is worth cancelling.';
    case 'bestValue':
      return 'Best value on the board right now — take it.';
    case 'preservesCounter':
      return 'Let it through — save your Nahi Chalega for a bigger threat.';
    case 'generic':
      return 'The solid play — keep building toward your sets.';
  }
}
