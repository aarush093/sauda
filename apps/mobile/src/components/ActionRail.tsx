/**
 * The right-hand action rail for a staged card (v1.2 A1). It shows the card's legal
 * verbs as buttons — exactly one gold-filled primary, the rest gold-rim outlines, plus
 * Cancel. A verb with one option commits on tap; a verb with several drills down to its
 * labelled option chips (wildcard colours, LAGAAN targets, steal targets), each backed
 * by one engine action. It renders railForCard's output; it decides no rules.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Action } from '@sauda/engine';
import type { RailVerb } from '../game/staging';
import { STAGE, INK, FONT } from '../design/tokens';

const buttonBase: CSSProperties = {
  minWidth: 96,
  padding: '10px 14px',
  borderRadius: 999,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
const primaryButton: CSSProperties = { ...buttonBase, background: STAGE.accentGold, color: INK.deepInk, border: 'none' };
const outlineButton: CSSProperties = { ...buttonBase, background: 'transparent', color: STAGE.accentGold, border: `1.5px solid ${INK.gold}` };
const quietButton: CSSProperties = { ...buttonBase, background: 'transparent', color: STAGE.textOnFelt, border: `1px solid ${INK.agedLine}` };
// F7: a greyed, inert hint chip (no pointer) — it explains, it never acts.
const hintChip: CSSProperties = {
  ...buttonBase,
  background: 'transparent',
  color: STAGE.textOnFelt,
  border: `1px dashed ${INK.agedLine}`,
  opacity: 0.6,
  cursor: 'default',
  fontWeight: 400,
  fontSize: 12,
  textAlign: 'center',
};

const railColumn: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  alignItems: 'stretch',
};

export function ActionRail({
  verbs,
  hint = null,
  onAct,
  onCancel,
}: {
  verbs: RailVerb[];
  hint?: string | null; // F7: a greyed reason for a canonical verb that legalActions doesn't offer
  onAct: (action: Action) => void;
  onCancel: () => void;
}) {
  // Which verb (if any) is drilled open to show its option chips.
  const [drilledVerbKey, setDrilledVerbKey] = useState<string | null>(null);
  const drilledVerb = verbs.find((verb) => verb.key === drilledVerbKey) ?? null;

  if (drilledVerb) {
    return (
      <div style={railColumn}>
        {drilledVerb.options.map((option) => (
          <button key={option.key} style={outlineButton} onClick={() => onAct(option.action)}>
            {option.label}
          </button>
        ))}
        <button style={quietButton} onClick={() => setDrilledVerbKey(null)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={railColumn}>
      {verbs.map((verb) => {
        // One option → commit straight away; several → open the drill-down chips.
        const soleOption = verb.options.length === 1 ? verb.options[0] : undefined;
        return (
          <button
            key={verb.key}
            style={verb.primary ? primaryButton : outlineButton}
            onClick={() => (soleOption ? onAct(soleOption.action) : setDrilledVerbKey(verb.key))}
          >
            {verb.label}
          </button>
        );
      })}
      {/* F7: one greyed, non-tappable hint — teaches WHY the card's main verb isn't offered. */}
      {hint !== null && (
        <div aria-disabled style={hintChip}>
          {hint}
        </div>
      )}
      <button style={quietButton} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
