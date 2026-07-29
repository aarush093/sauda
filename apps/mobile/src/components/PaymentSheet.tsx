/**
 * The payment sheet (INTERACTION_SPEC §6; STATE_MATRIX C1-C3, C6). When a charge stands
 * against me, a cream bottom sheet slides up over the dimmed table: "Pay ₹N Cr to <name>",
 * my payable cards as tappable CardFaces (gold ring when chosen), a running meter that
 * surfaces "no change given" on overpay, and one gold commit button. The engine's
 * suggestPayment is pre-selected (C1); I may edit freely — reduce validates the final
 * choice, so nothing here decides a rule.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { CardId, Observation } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import { paymentDetails, selectedTotal } from '../game/paymentModel';
import { CardFace } from './CardFace';
import { STAGE, INK, FONT, SHADOW } from '../design/tokens';

function seatName(seats: SeatConfig[], id: number): string {
  return seats[id]?.kind === 'bot' ? `Bot ${id}` : `Player ${id}`;
}

export function PaymentSheet({
  observation,
  seats,
  suggestion,
  onPay,
}: {
  observation: Observation;
  seats: SeatConfig[];
  suggestion: CardId[];
  onPay: (cardIds: CardId[]) => void;
}) {
  const details = paymentDetails(observation);
  // The sheet opens with the engine's suggestion selected (C1). Hooks must run before any
  // early return, so this is declared unconditionally.
  const [selected, setSelected] = useState<Set<CardId>>(() => new Set(suggestion));
  if (details === null) {
    return null;
  }

  const chosen = selectedTotal(details.payable, selected);
  const enough = details.mustPayAll ? selected.size === details.payable.length : chosen >= details.amount;
  const overpaying = !details.mustPayAll && chosen > details.amount;

  function toggle(id: CardId): void {
    // C3: when the table can't cover the debt, every card must go — selection is locked.
    if (details === null || details.mustPayAll) {
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <div style={titleStyle}>
          Pay ₹{details.amount} Cr to {seatName(seats, details.creditor)}
        </div>

        <div style={meterStyle}>
          ₹{chosen} / {details.amount} Cr{overpaying ? ' · no change given' : ''}
        </div>

        <div style={cardRowStyle}>
          {details.payable.map((card) => {
            const isSelected = selected.has(card.id);
            return (
              <div
                key={card.id}
                onClick={() => toggle(card.id)}
                style={{
                  borderRadius: 8,
                  cursor: details.mustPayAll ? 'default' : 'pointer',
                  boxShadow: isSelected ? STAGE.glowGold : 'none',
                  opacity: isSelected ? 1 : 0.6,
                }}
              >
                <CardFace cardId={card.id} size="mid" />
              </div>
            );
          })}
        </div>

        <button disabled={!enough} onClick={() => onPay([...selected])} style={{ ...payButtonStyle, opacity: enough ? 1 : 0.5 }}>
          {details.mustPayAll ? 'Pay all I have' : `Pay ₹${details.amount} Cr`}
        </button>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10,
  background: STAGE.scrimSheet,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
};
const sheetStyle: CSSProperties = {
  background: STAGE.cardCream,
  color: INK.deepInk,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: 16,
  maxHeight: '62vh',
  overflowY: 'auto',
  boxShadow: SHADOW.ledgerSlip,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};
const titleStyle: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, fontSize: 18, textAlign: 'center' };
const meterStyle: CSSProperties = { fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, textAlign: 'center' };
const cardRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' };
const payButtonStyle: CSSProperties = {
  alignSelf: 'center',
  minWidth: 160,
  padding: '12px 20px',
  borderRadius: 999,
  border: 'none',
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};
