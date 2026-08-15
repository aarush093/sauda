/**
 * The wildcard COMBINATION ASSISTANT surface (S4, owner playtest 13 Aug). When the pure evaluator
 * (arrangeAssistant.ts) finds a strictly better FREE arrangement of my placed wildcards, this shows a
 * quiet gold "◈ arrange" nudge near the affected colour. It NEVER auto-executes: a tap opens a preview
 * of the suggested end-state (real cards + the moves in words); Confirm fires the engine's own
 * REARRANGE_WILDCARD actions in order (free moves, no play consumed); Cancel dismisses. The caller
 * gates WHEN it appears (my play turn only, never in SPECTATE / inside another overlay / during the
 * auto-end drain) and re-evaluates after every state change, keying this by the suggestion so a new
 * board resets it.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Action, SetId } from '@sauda/engine';
import { SETS } from '@sauda/engine';
import type { ArrangeSuggestion } from '../game/arrangeAssistant';
import { SetCascade } from './SetCascade';
import { Surface } from './Surface';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

const PREVIEW_CARD_PX = 72; // the end-state cascade in the preview — readable real cards

export function ArrangeAssistant({
  suggestion,
  onConfirm,
  onDismiss,
}: {
  suggestion: ArrangeSuggestion;
  onConfirm: (moves: Action[]) => void; // fire the REARRANGE sequence through the engine
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  // T3: anchor the nudge to the AFFECTED group (the colour the suggestion completes), measured from
  // its live DOM tag, rather than the my-sets column head. Falls back to the head if it can't be found.
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const el = typeof document !== 'undefined' ? document.querySelector(`[data-myset="${suggestion.targetSet}"]`) : null;
    if (el) {
      const rect = el.getBoundingClientRect();
      setAnchor({ left: Math.round(rect.left), top: Math.round(Math.max(4, rect.top - 30)) }); // just above the group
    } else {
      setAnchor(null);
    }
  }, [suggestion.targetSet]);

  if (!open) {
    return (
      <button style={nudgeStyle(anchor)} onClick={() => setOpen(true)} aria-label={`Arrange: ${suggestion.summary}`}>
        ◈ arrange
      </button>
    );
  }

  const endGroup = groupForSet(suggestion, suggestion.targetSet);
  const moves: Action[] = suggestion.moves.map((move) => ({ type: 'REARRANGE_WILDCARD', cardId: move.cardId, toSet: move.toSet }));
  return (
    <div style={overlayStyle} onClick={() => setOpen(false)}>
      <Surface style={panelStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }} onClick={(event) => event.stopPropagation()}>
          <div style={titleStyle}>{suggestion.summary}</div>
          {endGroup && <SetCascade group={endGroup} width={PREVIEW_CARD_PX} />}
          <ol style={movesListStyle}>
            {suggestion.moves.map((move, index) => (
              <li key={`${move.cardId}-${index}`}>{move.label}</li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={confirmStyle} onClick={() => { onConfirm(moves); setOpen(false); }}>Confirm</button>
            <button style={cancelStyle} onClick={() => { setOpen(false); onDismiss(); }}>Cancel</button>
          </div>
          <div style={hintStyle}>Free moves — no play used.</div>
        </div>
      </Surface>
    </div>
  );
}

// The suggested end-state group for a colour (what the preview cascade shows).
function groupForSet(suggestion: ArrangeSuggestion, set: SetId) {
  const groups = suggestion.endGroups[set] ?? [];
  return groups.find((group) => group.cards.length >= SETS[set].size) ?? groups[0] ?? null;
}

// A quiet gold chip, pinned above the hand near the affected colour. Deliberately understated (never
// modal): it invites, it does not demand.
// The nudge sits BESIDE the affected group (measured), or — if that group can't be located — at the
// head of the my-sets column (clear of the far-left bot rail) as a safe fallback.
function nudgeStyle(anchor: { left: number; top: number } | null): CSSProperties {
  return {
  position: 'fixed',
  left: anchor ? anchor.left : 52,
  top: anchor ? anchor.top : 50,
  zIndex: LAYERS.board + 1,
  padding: '5px 12px',
  borderRadius: 999,
  background: STAGE.scrimSheet,
  color: STAGE.accentGold,
  border: `1px solid ${INK.gold}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  boxShadow: STAGE.glowGold,
  };
}
const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.surface,
  background: STAGE.scrimSheet,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
};
const panelStyle: CSSProperties = { maxWidth: 420, padding: 16 };
const titleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 16, color: STAGE.cardCream, textAlign: 'center' };
const movesListStyle: CSSProperties = { margin: 0, paddingLeft: 20, fontFamily: FONT.serif, fontSize: 13, color: STAGE.textOnFelt, lineHeight: 1.5 };
const confirmStyle: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 999,
  border: `2px solid ${INK.gold}`,
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
const cancelStyle: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 999,
  border: `1px solid ${INK.agedLine}`,
  background: 'transparent',
  color: STAGE.textOnFelt,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
const hintStyle: CSSProperties = { fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 11, color: STAGE.textOnFelt, opacity: 0.7 };
