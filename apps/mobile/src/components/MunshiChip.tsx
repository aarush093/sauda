/**
 * The Munshi chip (M4b H-rows) — a small gold token by my avatar that opens a READ-ONLY
 * advice card. Tapping it spends one of the game's three consults (store.consultMunshi) and
 * shows the recommended legal move + one templated line of counsel. It NEVER performs the
 * move: there is no action button on the card, only Dismiss — the player still plays it
 * themselves. (Placement law: the game volunteers strategy only here and on the Learn screen.)
 *
 * While the card is open it is the one live decision surface (L2): a full-screen scrim puts
 * the hand, rail, sheet and prompt to sleep beneath it; Dismiss returns to REST.
 *
 * `available` (my own play turn, with legal moves) is decided by the Board from legalActions;
 * the 3-use budget lives in the store so it resets per game and never carries over.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { SETS } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { MUNSHI_USES_PER_GAME } from '@sauda/bots';
import type { MunshiAdvice } from '@sauda/bots';
import { useGame } from '../game/store';
import { actionCardId, describeCard } from '../game/labels';
import { ScaledCard } from './CardFace';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

// The recommended move as one brief label, plus the hand card it concerns (if any) so the
// advice card can show its face. Presentation only — it reads the action, decides no rule.
function describeMove(action: Action): { cardId: string | null; label: string } {
  const cardId = actionCardId(action);
  switch (action.type) {
    case 'PLACE_PROPERTY':
      return { cardId, label: `Place in ${SETS[action.set].label}` };
    case 'BANK_CARD':
      return { cardId, label: `Bank ${describeCard(action.cardId)}` };
    case 'PLAY_ACTION':
    case 'PLAY_KIRAYA':
      return { cardId, label: `Play ${describeCard(action.cardId)}` };
    case 'REARRANGE_WILDCARD':
      return { cardId, label: `Move wildcard to ${SETS[action.toSet].label}` };
    case 'DECLARE_WIN':
      return { cardId: null, label: 'Declare SAUDA!' };
    case 'END_TURN':
      return { cardId: null, label: 'End your turn' };
    default:
      return { cardId, label: 'Make your move' };
  }
}

export function MunshiChip({ available }: { available: boolean }) {
  const usesRemaining = useGame((store) => store.munshiUsesRemaining);
  const consultMunshi = useGame((store) => store.consultMunshi);
  const [advice, setAdvice] = useState<MunshiAdvice | null>(null);

  const spent = usesRemaining <= 0;
  const enabled = available && !spent;

  function openAdvisor(): void {
    if (!enabled) {
      return;
    }
    const next = consultMunshi(); // spends one use; NEVER dispatches an engine action
    if (next) {
      setAdvice(next); // null only in a race where it stopped being my turn — then stay at REST
    }
  }

  const move = advice ? describeMove(advice.action) : null;

  return (
    <>
      <button
        type="button"
        disabled={!enabled}
        onClick={openAdvisor}
        title={spent ? 'Munshi — no advice left this game' : `Munshi — ${usesRemaining} of ${MUNSHI_USES_PER_GAME} advice left`}
        style={chipStyle(enabled)}
        aria-label={spent ? 'Munshi advisor — no advice left' : `Munshi advisor — ${usesRemaining} of ${MUNSHI_USES_PER_GAME} advice left`}
      >
        {/* K3: the munshi's seal (◈) + a "Munshi" microlabel + one pip per unused consult — so the
            advisor reads unmistakably as an advisor and is never confused with the turn token. */}
        <span aria-hidden style={{ fontSize: 13 }}>◈</span>
        <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 10, letterSpacing: 0.2 }}>Munshi</span>
        <span style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: MUNSHI_USES_PER_GAME }).map((_, index) => (
            <span key={index} style={pipStyle(index < usesRemaining)} />
          ))}
        </span>
      </button>

      {/* The read-only advice card. The scrim (SCRIM_SHEET) sleeps everything beneath it (L2);
          tapping the scrim or Got it returns to REST. No control here plays the move. */}
      {advice && move && (
        <div style={scrimStyle} onClick={() => setAdvice(null)}>
          <div style={cardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 16, color: INK.deepInk }}>Munshi ki Salah</div>
            <div style={{ fontFamily: FONT.serif, fontSize: 12, color: INK.mutedBrown }}>Advice only — you still make the move.</div>
            <div style={moveRowStyle}>
              {move.cardId && <ScaledCard cardId={move.cardId} width={46} />}
              <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 15, color: INK.deepInk }}>{move.label}</div>
            </div>
            <div style={{ fontFamily: FONT.serif, fontSize: 14, color: INK.deepInk, lineHeight: 1.35 }}>{advice.line}</div>
            <button type="button" onClick={() => setAdvice(null)} style={dismissStyle}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}

// The chip pill: a gold-outline token. Enabled → the one gold glow invites a tap; spent or
// off-turn → dimmed and inert (the my-area zone also dims off-turn, so it sleeps with it).
function chipStyle(enabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 999,
    border: `1px solid ${INK.gold}`,
    background: 'transparent',
    color: STAGE.accentGold,
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 11,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.45,
    boxShadow: enabled ? STAGE.glowGold : 'none',
  };
}

// One budget pip: filled gold for a use still in hand, a hollow gold ring once spent.
function pipStyle(filled: boolean): CSSProperties {
  return {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: filled ? STAGE.accentGold : 'transparent',
    border: `1px solid ${INK.gold}`,
  };
}

const scrimStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.advice, // above the sheets — they sleep under the advice card (it explains them)
  background: STAGE.scrimSheet,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const cardStyle: CSSProperties = {
  maxWidth: 300,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '16px 18px',
  borderRadius: 12,
  background: STAGE.cardCream,
  boxShadow: STAGE.glowGold,
};

const moveRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
  borderTop: `1px solid ${INK.agedLine}`,
  borderBottom: `1px solid ${INK.agedLine}`,
};

const dismissStyle: CSSProperties = {
  alignSelf: 'flex-end',
  marginTop: 2,
  padding: '8px 18px',
  borderRadius: 999,
  border: `1.5px solid ${INK.gold}`,
  background: 'transparent',
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
