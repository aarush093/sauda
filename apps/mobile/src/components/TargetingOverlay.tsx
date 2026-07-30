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
import type { Action, CardId, PlayerId, SetId } from '@sauda/engine';
import { actionTargeting, kirayaPlan } from '../game/interaction';
import type { KirayaPlan, TargetStep } from '../game/interaction';
import { ScaledCard } from './CardFace';
import { STAGE, INK, FONT } from '../design/tokens';

export function TargetingOverlay({
  cardId,
  actions,
  me,
  onCommit,
  onCancel,
}: {
  cardId: CardId;
  actions: Action[];
  me: PlayerId;
  onCommit: (action: Action) => void;
  onCancel: () => void;
}) {
  const plan = kirayaPlan(actions, cardId);
  const step = actionTargeting(actions, cardId, me);
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={cardWrapStyle} onClick={(event) => event.stopPropagation()}>
        <ScaledCard cardId={cardId} width={88} />
        {plan ? (
          <KirayaPicker plan={plan} onCommit={onCommit} onCancel={onCancel} />
        ) : step ? (
          <StepPicker firstStep={step} onCommit={onCommit} onCancel={onCancel} />
        ) : (
          <CancelRow onCancel={onCancel} />
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
  zIndex: 6,
  background: STAGE.scrimSheet,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const cardWrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: '88vw' };
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
