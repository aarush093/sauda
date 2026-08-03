/**
 * Targeting (v1.2 A10 · matrix B13/B14/B16/B17/B18). After a targeted action is played its
 * card plants on stage and ONLY its legal targets — derived from legalActions — glow as
 * tappable chips; one tap fires the exact enumerated engine action, so BAD_TARGET is
 * unreachable from the UI. VASOOLI / KABZA / HAATH KI SAFAI pick once; ADLA-BADLI picks
 * mine → theirs; wild LAGAAN picks colour → opponent with a ×2/×4 DUGNA attach (L6). Cancel
 * returns the card to hand — no play consumed.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Action, CardId, PlayerId, PropertyGroup, SetId } from '@sauda/engine';
import { actionTargeting, kirayaPlan } from '../game/interaction';
import type { KirayaPlan, TargetStep } from '../game/interaction';
import { ScaledCard } from './CardFace';
import { GroupRow } from './BoardParts';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

const REFERENCE_CARD_PX = 44; // my-sets reference cascade width — readable, non-interactive

export function TargetingOverlay({
  cardId,
  actions,
  me,
  myProperties,
  myKiraya,
  onCommit,
  onCancel,
}: {
  cardId: CardId;
  actions: Action[];
  me: PlayerId;
  // R5: my own boards, shown read-only in the reference panel so a target can be chosen strategically
  // ("I hold 2 Jaipur; take their Jaipur"). Reference only — it never changes what is targetable.
  myProperties: Record<SetId, PropertyGroup[]>;
  myKiraya?: Record<SetId, number[]> | undefined;
  onCommit: (action: Action) => void;
  onCancel: () => void;
}) {
  const plan = kirayaPlan(actions, cardId);
  const step = actionTargeting(actions, cardId, me);
  // R5: the MY SETS reference panel is default OPEN in landscape; it can be toggled shut for room.
  const [showReference, setShowReference] = useState(true);
  return (
    <div style={overlayStyle} onClick={onCancel}>
      {/* the split: targets (~60%) + my-sets reference (~40%). Stops propagation so a tap inside the
          split never hits the backdrop's cancel; only the felt around it cancels. */}
      <div style={splitStyle} onClick={(event) => event.stopPropagation()}>
        <div style={targetsPaneStyle}>
          <ScaledCard cardId={cardId} width={88} />
          {plan ? (
            <KirayaPicker plan={plan} onCommit={onCommit} onCancel={onCancel} />
          ) : step ? (
            <StepPicker firstStep={step} onCommit={onCommit} onCancel={onCancel} />
          ) : (
            <CancelRow onCancel={onCancel} />
          )}
        </div>

        {showReference && (
          <div style={referencePaneStyle}>
            <div style={referenceHeaderStyle}>
              <span>Your sets — reference</span>
              <button style={referenceToggleStyle} onClick={() => setShowReference(false)} aria-label="Hide my sets">Hide</button>
            </div>
            {/* read-only: no dropSets, no rearrange, no onExpand → nothing glows, nothing taps. It
                cannot change what is targetable; it is a strategic read of my own board only. */}
            <div style={referenceBoardStyle}>
              <GroupRow properties={myProperties} kiraya={myKiraya} width={REFERENCE_CARD_PX} mine />
            </div>
          </div>
        )}
        {!showReference && (
          <button style={referenceReopenStyle} onClick={() => setShowReference(true)} aria-label="Show my sets">My sets</button>
        )}
      </div>
    </div>
  );
}

// Walks the TargetStep tree: single-pick actions have one step; ADLA-BADLI has a `.next`.
function StepPicker({ firstStep, onCommit, onCancel }: { firstStep: TargetStep; onCommit: (action: Action) => void; onCancel: () => void }) {
  const [step, setStep] = useState<TargetStep>(firstStep);
  return (
    <div style={panelStyle}>
      <div style={promptStyle}>{step.prompt}</div>
      <div style={chipRowStyle}>
        {step.choices.map((choice) => (
          <button
            key={choice.key}
            style={targetChip}
            onClick={() => {
              if (choice.action) {
                onCommit(choice.action);
              } else if (choice.next) {
                setStep(choice.next);
              }
            }}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <CancelRow onCancel={onCancel} />
    </div>
  );
}

// LAGAAN: pick colour → (paired charges all; wild picks one opponent), with the ×2/×4
// DUGNA attach chosen first (L6). Every fired move is one plan.resolve() had enumerated.
function KirayaPicker({ plan, onCommit, onCancel }: { plan: KirayaPlan; onCommit: (action: Action) => void; onCancel: () => void }) {
  const [dugnaCount, setDugnaCount] = useState(0);
  const [color, setColor] = useState<SetId | null>(null);

  function pickColor(chosen: SetId) {
    if (!plan.targeted) {
      const action = plan.resolve(chosen, dugnaCount, null); // paired → charges all opponents
      if (action) onCommit(action);
    } else {
      setColor(chosen); // wild → choose an opponent next
    }
  }
  function pickTarget(target: PlayerId) {
    if (color === null) return;
    const action = plan.resolve(color, dugnaCount, target);
    if (action) onCommit(action);
  }

  return (
    <div style={panelStyle}>
      {plan.dugna.length > 1 && (
        <div style={chipRowStyle}>
          {plan.dugna.map((option) => (
            <button
              key={option.count}
              style={option.count === dugnaCount ? targetChipActive : targetChip}
              onClick={() => setDugnaCount(option.count)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {color === null ? (
        <>
          <div style={promptStyle}>Charge which colour?</div>
          <div style={chipRowStyle}>
            {plan.colors.map((choice) => (
              <button key={choice.color} style={targetChip} onClick={() => pickColor(choice.color)}>
                {choice.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={promptStyle}>Charge which opponent?</div>
          <div style={chipRowStyle}>
            {plan.opponents.map((target) => (
              <button key={target} style={targetChip} onClick={() => pickTarget(target)}>
                Player {target}
              </button>
            ))}
          </div>
        </>
      )}
      <CancelRow onCancel={onCancel} />
    </div>
  );
}

function CancelRow({ onCancel }: { onCancel: () => void }) {
  return (
    <button style={cancelChip} onClick={onCancel}>
      Cancel
    </button>
  );
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
// R5: the landscape split — targets ~60%, my-sets reference ~40%. Fills the overlay so both panes
// get real room on the short landscape height.
const splitStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 12,
  width: '100%',
  height: '100%',
};
const targetsPaneStyle: CSSProperties = {
  flex: 6, // ~60%
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
};
const referencePaneStyle: CSSProperties = {
  flex: 4, // ~40%
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  borderRadius: 12,
  border: `1px solid ${STAGE.scrimSheet}`,
  background: STAGE.scrimDrag,
};
const referenceHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontFamily: FONT.serif,
  fontSize: 12,
  color: STAGE.textOnFelt,
};
const referenceToggleStyle: CSSProperties = {
  padding: '2px 10px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.textOnFelt,
  border: `1px solid ${INK.agedLine}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
};
// the reopen tab when the reference is hidden — a slim gold chip on the right edge.
const referenceReopenStyle: CSSProperties = {
  alignSelf: 'center',
  padding: '8px 6px',
  borderRadius: 8,
  background: STAGE.scrimSheet,
  color: STAGE.accentGold,
  border: `1px solid ${INK.gold}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  writingMode: 'vertical-rl',
};
const referenceBoardStyle: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto' };
const panelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 };
const promptStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 15, color: STAGE.cardCream, textAlign: 'center' };
const chipRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' };
const targetChip: CSSProperties = {
  padding: '9px 15px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.accentGold,
  border: `1.5px solid ${INK.gold}`,
  boxShadow: STAGE.glowGold, // legal targets glow (A10 / STATE_MATRIX §1)
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
const targetChipActive: CSSProperties = { ...targetChip, background: STAGE.accentGold, color: INK.deepInk };
const cancelChip: CSSProperties = {
  marginTop: 2,
  padding: '8px 16px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.textOnFelt,
  border: `1px solid ${INK.agedLine}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};
