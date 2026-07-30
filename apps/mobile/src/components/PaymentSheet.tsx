/**
 * The payment sheet (INTERACTION_SPEC §6; STATE_MATRIX C1-C3, C6; F3). When a charge stands
 * against me, a cream bottom sheet slides up over the dimmed table: "Pay ₹N Cr to <name>", my
 * payable cards as tappable CardFaces (gold ring when chosen), a running meter that surfaces
 * "no change given" on overpay, and one gold commit button.
 *
 * F3 (owner playtest 30 Jul) — trustworthy, money-first disclosure: the DEFAULT selection is the
 * least-overpay, money-preferring pick (paymentModel.refinePaymentSelection — never overpays when
 * an exact subset exists), so it opens honest. Money notes are always shown; when money covers the
 * debt the property sets hide behind one quiet "Pay with property instead" expander so the sheet
 * reads as money only. I may still edit freely — reduce re-validates the final choice.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { CardId, Observation } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import type { PayableCard } from '../game/paymentModel';
import { paymentDetails, paymentDisclosure, selectedTotal } from '../game/paymentModel';
import { ScaledCard } from './CardFace';
import { STAGE, INK, FONT, SHADOW } from '../design/tokens';

const PAY_CARD_PX = 76; // the payment options — REAL scaled card faces (G4 · fixes the F4 regression)

function seatName(seats: SeatConfig[], id: number): string {
  return seats[id]?.kind === 'bot' ? `Bot ${id}` : `Player ${id}`;
}

export function PaymentSheet({
  observation,
  seats,
  onPay,
}: {
  observation: Observation;
  seats: SeatConfig[];
  onPay: (cardIds: CardId[]) => void;
}) {
  const details = paymentDetails(observation);
  // Hooks before any early return. The sheet opens on the trustworthy money-first default (F3),
  // and starts with the property expander collapsed.
  const disclosure = details ? paymentDisclosure(details) : null;
  const [selected, setSelected] = useState<Set<CardId>>(() => new Set(disclosure?.defaultSelection ?? []));
  const [propertyExpanded, setPropertyExpanded] = useState(false);
  if (details === null || disclosure === null) {
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

  const payableCard = (card: PayableCard) => {
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
        <ScaledCard cardId={card.id} width={PAY_CARD_PX} />
      </div>
    );
  };

  // Money first, then the default's own property cards; the rest of the property sets wait behind
  // the expander so a money-covered debt reads as money only (F3 · L6).
  const shownProperties = propertyExpanded
    ? [...disclosure.shownProperties, ...disclosure.hiddenProperties]
    : disclosure.shownProperties;

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
          {disclosure.money.map(payableCard)}
          {shownProperties.map(payableCard)}
        </div>

        {/* F3: the quiet property expander — only when money already covers the debt and there
            are property sets to reveal. Collapsed by default so money reads as the first choice. */}
        {!details.mustPayAll && disclosure.hiddenProperties.length > 0 && (
          <button style={expanderStyle} onClick={() => setPropertyExpanded((open) => !open)}>
            {propertyExpanded ? 'Hide property' : 'Pay with property instead'}
          </button>
        )}

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
const expanderStyle: CSSProperties = {
  alignSelf: 'center',
  padding: '6px 14px',
  borderRadius: 999,
  background: 'transparent',
  color: INK.mutedBrown,
  border: `1px solid ${INK.agedLine}`,
  fontFamily: FONT.serif,
  fontSize: 13,
  cursor: 'pointer',
};
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
