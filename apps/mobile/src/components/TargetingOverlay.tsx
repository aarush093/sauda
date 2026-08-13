/**
 * Targeting (v1.2 A10 · matrix B13/B14/B16/B17/B18; S3 real-cards rebuild, owner playtest 13 Aug).
 * After a targeted action is played its card plants on stage and ONLY its legal targets — derived
 * from legalActions — glow as tappable REAL CARDS; one tap fires the exact enumerated engine action,
 * so BAD_TARGET is unreachable from the UI. The owner's screenshot showed text pills ("P1 · MI Road")
 * for HAATH KI SAFAI — a violation of the everything-is-a-real-card law; S3 replaces every pick pill
 * with the real board element:
 *   • a stolen/swapped PROPERTY renders as its real ScaledCard (HAATH KI SAFAI, ADLA-BADLI),
 *   • a seized SET renders as the opponent's real cascade (KABZA),
 *   • a charged PLAYER is a vintage identity chip, not a text pill (VASOOLI, wild LAGAAN),
 *   • a LAGAAN colour renders as my own set's cascade.
 * VASOOLI / KABZA / HAATH KI SAFAI pick once; ADLA-BADLI picks mine → theirs; wild LAGAAN picks
 * colour → opponent with a ×2/×4 DUGNA attach (L6). Cancel returns the card to hand — no play consumed.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Action, CardId, OpponentView, PlayerId, PropertyGroup, SetId } from '@sauda/engine';
import { actionTargeting, kirayaPlan } from '../game/interaction';
import type { KirayaPlan, TargetChoice, TargetStep } from '../game/interaction';
import { ScaledCard } from './CardFace';
import { SetCascade } from './SetCascade';
import { GroupRow } from './BoardParts';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

const REFERENCE_CARD_PX = 44; // my-sets reference cascade width — readable, non-interactive
const TARGET_CARD_PX = 84; // a single-property target — readable (≈ the TableView floor), tap to pick
const TARGET_SET_PX = 72; // a KABZA target set cascade — a touch smaller so a full set still fits

// The group behind a KABZA 'opponentSet' ref — the opponent's real cards for that colour, so the
// seized set renders as its true cascade instead of a "P2 · Jaipur" pill.
function opponentGroup(opponents: OpponentView[], player: PlayerId, set: SetId): PropertyGroup | null {
  const opponent = opponents.find((o) => o.id === player);
  if (!opponent) {
    return null;
  }
  const groups = opponent.properties[set];
  return groups.find((g) => g.cards.length >= 1) ?? groups[0] ?? null;
}

export function TargetingOverlay({
  cardId,
  actions,
  me,
  myProperties,
  myKiraya,
  opponents = [],
  hintedKey = null,
  reducedMotion = false,
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
  // S3: opponents' public boards, so a KABZA target set renders as its real cascade (not a pill).
  opponents?: OpponentView[];
  // S3 assist (difficulty-gated): the key of the choice the frozen recommend() favours — it bounces /
  // brightens. Null = no hint (hard tier, or no clear best). Never alters what is targetable.
  hintedKey?: string | null;
  reducedMotion?: boolean; // under reduced-motion the hint is a static brighter ring, not a bounce
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
            <KirayaPicker plan={plan} myProperties={myProperties} hintedKey={hintedKey} reducedMotion={reducedMotion} onCommit={onCommit} onCancel={onCancel} />
          ) : step ? (
            <StepPicker firstStep={step} opponents={opponents} me={me} hintedKey={hintedKey} reducedMotion={reducedMotion} onCommit={onCommit} onCancel={onCancel} />
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

// A vintage identity chip for a PLAYER target (VASOOLI / wild LAGAAN) — a gold-ringed seat medallion,
// styled like the bot rail chip, NOT a text pill. The target here is a person, not a card.
function SeatChip({ player }: { player: PlayerId }) {
  return <span style={seatChipStyle}>B{player}</span>;
}

// One tappable target, rendered as its REAL board element (a card / a set cascade / a seat chip) with
// the eligibility glow. When it is the assist hint it brightens and (unless reduced-motion) bounces.
function TargetTile({
  choice,
  opponents,
  me,
  hinted,
  reducedMotion,
  onPick,
}: {
  choice: TargetChoice;
  opponents: OpponentView[];
  me: PlayerId;
  hinted: boolean;
  reducedMotion: boolean;
  onPick: (choice: TargetChoice) => void;
}) {
  const { ref } = choice;
  const owner = ref.kind === 'opponent' ? null : ref.player === me ? 'You' : `B${ref.player}`;
  return (
    <button
      style={tileStyle(hinted, reducedMotion)}
      onClick={() => onPick(choice)}
      aria-label={choice.label}
      {...(hinted ? { 'data-hint': 'true' } : {})}
    >
      {ref.kind === 'property' && <ScaledCard cardId={ref.cardId} width={TARGET_CARD_PX} />}
      {ref.kind === 'opponentSet' && (() => {
        const group = opponentGroup(opponents, ref.player, ref.set);
        return group ? <SetCascade group={group} width={TARGET_SET_PX} /> : <SeatChip player={ref.player} />;
      })()}
      {ref.kind === 'opponent' && <SeatChip player={ref.player} />}
      {owner && <span style={ownerTagStyle}>{owner}</span>}
    </button>
  );
}

// Walks the TargetStep tree: single-pick actions have one step; ADLA-BADLI has a `.next`.
function StepPicker({
  firstStep,
  opponents,
  me,
  hintedKey,
  reducedMotion,
  onCommit,
  onCancel,
}: {
  firstStep: TargetStep;
  opponents: OpponentView[];
  me: PlayerId;
  hintedKey: string | null;
  reducedMotion: boolean;
  onCommit: (action: Action) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<TargetStep>(firstStep);
  function pick(choice: TargetChoice): void {
    if (choice.action) {
      onCommit(choice.action);
    } else if (choice.next) {
      setStep(choice.next);
    }
  }
  return (
    <div style={panelStyle}>
      <div style={promptStyle}>{step.prompt}</div>
      <div style={tileScrollStyle}>
        <div style={tileRowStyle}>
          {step.choices.map((choice) => (
            <TargetTile
              key={choice.key}
              choice={choice}
              opponents={opponents}
              me={me}
              hinted={hintedKey === choice.key}
              reducedMotion={reducedMotion}
              onPick={pick}
            />
          ))}
        </div>
      </div>
      <CancelRow onCancel={onCancel} />
    </div>
  );
}

// LAGAAN: pick colour → (paired charges all; wild picks one opponent), with the ×2/×4 DUGNA attach
// chosen first (L6). Colours render as MY real set cascades; opponents as vintage identity chips.
function KirayaPicker({
  plan,
  myProperties,
  hintedKey,
  reducedMotion,
  onCommit,
  onCancel,
}: {
  plan: KirayaPlan;
  myProperties: Record<SetId, PropertyGroup[]>;
  hintedKey: string | null;
  reducedMotion: boolean;
  onCommit: (action: Action) => void;
  onCancel: () => void;
}) {
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
  // My best group for a colour, so the colour choice renders as a real cascade of what I'd charge.
  function myGroup(set: SetId): PropertyGroup | null {
    const groups = myProperties[set] ?? [];
    return groups.find((g) => g.cards.length >= 1) ?? groups[0] ?? null;
  }

  return (
    <div style={panelStyle}>
      {plan.dugna.length > 1 && (
        <div style={tileRowStyle}>
          {plan.dugna.map((option) => (
            <button
              key={option.count}
              style={option.count === dugnaCount ? multiplierChipActive : multiplierChip}
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
          <div style={tileScrollStyle}>
            <div style={tileRowStyle}>
              {plan.colors.map((choice) => {
                const group = myGroup(choice.color);
                const hinted = hintedKey === choice.color;
                return (
                  <button key={choice.color} style={tileStyle(hinted, reducedMotion)} onClick={() => pickColor(choice.color)} aria-label={choice.label} {...(hinted ? { 'data-hint': 'true' } : {})}>
                    {group ? <SetCascade group={group} width={TARGET_SET_PX} /> : <span style={seatChipStyle}>{choice.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={promptStyle}>Charge which opponent?</div>
          <div style={tileRowStyle}>
            {plan.opponents.map((target) => {
              const hinted = hintedKey === `p${target}`;
              return (
                <button key={target} style={tileStyle(hinted, reducedMotion)} onClick={() => pickTarget(target)} aria-label={`Player ${target}`} {...(hinted ? { 'data-hint': 'true' } : {})}>
                  <SeatChip player={target} />
                </button>
              );
            })}
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
  gap: 10,
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
const panelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minHeight: 0, maxHeight: '100%' };
const promptStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 15, color: STAGE.cardCream, textAlign: 'center' };
// S3: the real-card targets. flex-wrap, and the whole row scrolls INTERNALLY on the short profiles so
// a rich list never grazes the hand or clips (owner: 740×360 must not overflow).
const tileScrollStyle: CSSProperties = { maxHeight: 240, overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center' };
const tileRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'flex-end', padding: 4 };

// A target tile: the real card sits in a glowing frame (every offered target is legal, so glows). The
// assist hint brightens the ring and — unless reduced-motion — adds a gentle bounce.
function tileStyle(hinted: boolean, reducedMotion: boolean): CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: 5,
    borderRadius: 10,
    background: 'transparent',
    border: `1.5px solid ${INK.gold}`,
    boxShadow: hinted ? STAGE.glowGoldStrong : STAGE.glowGold, // legal targets glow (A10); the hint glows brighter
    opacity: hinted ? 1 : 0.96,
    cursor: 'pointer',
    ...(hinted && !reducedMotion ? { animation: 'sauda-target-bounce 900ms ease-in-out infinite' } : {}),
  };
}
const ownerTagStyle: CSSProperties = {
  fontFamily: FONT.mono,
  fontWeight: 700,
  fontSize: 10,
  color: STAGE.accentGold,
  letterSpacing: 0.3,
};
// A vintage seat medallion (VASOOLI / LAGAAN player target) — gold ring, cream seat, the rail look.
const seatChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 54,
  height: 54,
  borderRadius: 999,
  border: `2px solid ${INK.gold}`,
  background: STAGE.scrimSheet,
  color: STAGE.cardCream,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 20,
  boxShadow: STAGE.glowGold,
};
const multiplierChip: CSSProperties = {
  padding: '7px 13px',
  borderRadius: 999,
  background: 'transparent',
  color: STAGE.accentGold,
  border: `1.5px solid ${INK.gold}`,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
const multiplierChipActive: CSSProperties = { ...multiplierChip, background: STAGE.accentGold, color: INK.deepInk };
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
