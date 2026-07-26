/**
 * CardFace — the SAUDA Deed Card (M4 §3). Two layers:
 *   • Plate (static art): a raster plate if one exists, else an SVG fallback.
 *     The plate carries NO text/numerals — ever.
 *   • Live layer (this code): every number, name and icon that means something,
 *     drawn from engine data in the shared vintage styles, identical at all sizes.
 *
 * Degrades across FULL / MID / CHIP with one zone contract — never a second layout.
 * No rules live here; values come from theme/engine data.
 */
import type { CSSProperties } from 'react';
import { ACTIONS, KIRAYA_DESCRIPTOR, SETS } from '@sauda/engine';
import type { Card, SetId } from '@sauda/engine';
import { CARD, FONT, INK, cardWidth } from '../design/tokens';
import type { CardSize } from '../design/tokens';
import { cardById, propertyName, setLabels } from '../design/cardData';
import { plateUrl } from '../design/plates';

export interface CardFaceProps {
  cardId: string;
  size?: CardSize;
  heldCount?: number; // properties owned of this colour (MID pips)
}

export function CardFace({ cardId, size = 'full', heldCount }: CardFaceProps) {
  const card = cardById(cardId);
  if (!card) {
    return null;
  }
  if (size === 'chip') {
    return <ChipFace card={card} heldCount={heldCount} />;
  }
  if (size === 'mid') {
    return <MidFace card={card} heldCount={heldCount} />;
  }
  return <FullFace card={card} />;
}

// The dominant set ink for a card, or null for money / ANY cards.
function primarySet(card: Card): SetId | null {
  if (card.kind === 'property') return card.set;
  if (card.kind === 'wildcard' && card.colors !== 'ANY') return card.colors[0] ?? null;
  if (card.kind === 'kiraya' && card.colors !== 'ANY') return card.colors[0] ?? null;
  return null;
}

function frameStyle(size: CardSize): CSSProperties {
  const width = cardWidth(size);
  return {
    width,
    height: Math.round(width * CARD.ratio),
    position: 'relative',
    boxSizing: 'border-box',
    borderRadius: 6,
    overflow: 'hidden',
    background: INK.cardCream,
    color: INK.deepInk,
    border: `2px solid ${INK.agedLine}`,
    fontFamily: FONT.body,
    userSelect: 'none',
  };
}

// --- plate layer -----------------------------------------------------------

function Plate({ card }: { card: Card }) {
  const url = plateUrl(card.id);
  if (url) {
    return (
      <img
        src={url}
        alt=""
        decoding="async"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  return <FallbackPlate set={primarySet(card)} />;
}

// A flat two-ink screen-print scene used until a raster plate is dropped in.
// Pure shapes — no baked text, matching the plate contract.
function FallbackPlate({ set }: { set: SetId | null }) {
  const ink = set ? SETS[set].hex : INK.tableIndigo;
  return (
    <svg
      viewBox="0 0 100 145"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden
    >
      <rect x="0" y="0" width="100" height="145" fill={INK.cardCream} />
      {/* hero band (0.20–0.52 H) in the set ink */}
      <rect x="0" y="29" width="100" height="46" fill={ink} opacity="0.9" />
      {/* an abstract medallion motif (no letters) */}
      <circle cx="50" cy="52" r="13" fill={INK.cardCream} opacity="0.92" />
      <circle cx="50" cy="52" r="13" fill="none" stroke={ink} strokeWidth="1.5" />
      <rect x="44" y="46" width="12" height="12" rx="2" fill="none" stroke={ink} strokeWidth="1.5" />
      <circle cx="50" cy="52" r="2.4" fill={INK.stampRed} />
    </svg>
  );
}

// --- FULL faces ------------------------------------------------------------

function FullFace({ card }: { card: Card }) {
  switch (card.kind) {
    case 'property':
      return <PropertyFull card={card} />;
    case 'action':
      return <ActionFull card={card} />;
    case 'kiraya':
      return <KirayaFull card={card} />;
    case 'wildcard':
      return <WildcardFull card={card} />;
    case 'money':
      return <MoneyFull card={card} />;
    default:
      return <div style={frameStyle('full')} />;
  }
}

const mono = (weight = 500): CSSProperties => ({ fontFamily: FONT.mono, fontWeight: weight });
const display: CSSProperties = { fontFamily: FONT.display, fontWeight: 700, letterSpacing: '0.02em' };

// Value badge: keeps the ₹N Cr unit but stacks "Cr" under the number so it never
// overflows the disc (abbreviate the layout, not the unit).
function ValueBadge({ value, ink }: { value: number; ink: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 5,
        left: 5,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: INK.cardCream,
        border: `2px solid ${ink}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 8, ...mono(700) }}>₹{value}</span>
      <span style={{ fontSize: 5, ...mono(500) }}>Cr</span>
    </div>
  );
}

function Seal() {
  return (
    <div
      title="SAUDA PRESS"
      style={{
        position: 'absolute',
        right: 4,
        bottom: '13%',
        width: 26,
        height: 26,
        borderRadius: '50%',
        border: `1.5px solid ${INK.gold}`,
        color: INK.gold,
        background: 'rgba(20,18,31,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        ...display,
      }}
    >
      सौ
    </div>
  );
}

function CornerChip({ value }: { value: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 4,
        bottom: 3,
        padding: '1px 4px',
        borderRadius: 3,
        background: INK.gold,
        color: INK.deepInk,
        fontSize: 8,
        ...mono(700),
      }}
    >
      ₹{value} Cr
    </div>
  );
}

function FooterBand({ set }: { set: SetId }) {
  const theme = SETS[set];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '16%',
        background: theme.hex,
        color: INK.cardCream,
        padding: '2px 4px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <div style={{ fontSize: 5.2, ...display, letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {theme.works}
      </div>
      <div style={{ fontSize: 4.6, display: 'flex', justifyContent: 'space-between', ...mono(500) }}>
        <span>SAFETY DEEDS</span>
        <span>EST. {theme.est}</span>
      </div>
    </div>
  );
}

function MatchIcon({ count, ink }: { count: number; ink: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 18,
        border: `1px solid ${ink}`,
        borderRadius: 2,
        background: INK.cardCream,
        position: 'relative',
        fontSize: 8,
        ...mono(700),
      }}
    >
      <span style={{ position: 'absolute', top: 0, right: 0, width: 4, height: 4, background: INK.stampRed }} />
      {count}
    </span>
  );
}

function RentLadder({ set }: { set: SetId }) {
  const theme = SETS[set];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontSize: 4.8, fontStyle: 'italic', color: '#5b5344' }}>(deeds held of this colour)</div>
      {theme.rent.map((rent, index) => {
        const count = index + 1;
        const isFullSet = count === theme.size;
        return (
          <div
            key={count}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              color: isFullSet ? INK.stampRed : INK.deepInk,
              fontWeight: isFullSet ? 700 : 400,
              fontSize: isFullSet ? 8 : 7,
            }}
          >
            {isFullSet ? (
              <span style={{ ...display, fontSize: 7 }}>FULL SET</span>
            ) : (
              <MatchIcon count={count} ink={theme.hex} />
            )}
            <span style={{ flex: 1, borderBottom: `1px dotted ${INK.agedLine}`, margin: '0 2px', height: 1 }} />
            <span style={mono(isFullSet ? 700 : 500)}>₹{rent} Cr</span>
          </div>
        );
      })}
    </div>
  );
}

function PropertyFull({ card }: { card: Extract<Card, { kind: 'property' }> }) {
  const theme = SETS[card.set];
  return (
    <div style={frameStyle('full')}>
      <Plate card={card} />
      <ValueBadge value={card.value} ink={theme.hex} />

      {/* title zone (0.06–0.20 H) */}
      <div style={{ position: 'absolute', top: '6.5%', left: 0, right: 0, textAlign: 'center', padding: '0 24px' }}>
        <div style={{ ...display, fontSize: 8.5, lineHeight: 1.05, textTransform: 'uppercase' }}>
          {propertyName(card)}
        </div>
        <div style={{ fontSize: 5.5, ...mono(500), color: '#5b5344', textTransform: 'uppercase' }}>
          {theme.label}
        </div>
      </div>

      {/* ledger zone (0.52–0.84 H) with a readability scrim */}
      <div
        style={{
          position: 'absolute',
          top: '52%',
          left: '5%',
          right: '5%',
          height: '32%',
          background: 'rgba(242,233,210,0.82)',
          border: `1px solid ${INK.agedLine}`,
          borderRadius: 3,
          padding: '3px 4px',
        }}
      >
        <RentLadder set={card.set} />
      </div>

      <FooterBand set={card.set} />
      <Seal />
      <CornerChip value={card.value} />
    </div>
  );
}

function ActionFull({ card }: { card: Extract<Card, { kind: 'action' }> }) {
  const info = ACTIONS[card.action];
  return (
    <div style={frameStyle('full')}>
      <FallbackPlate set={null} />
      {/* ACTION ribbon */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 0,
          right: 0,
          textAlign: 'center',
          background: INK.stampRed,
          color: INK.cardCream,
          fontSize: 6,
          padding: '1px 0',
          ...mono(700),
          letterSpacing: '0.15em',
        }}
      >
        ACTION
      </div>
      {/* name as a skewed stamp */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          left: 0,
          right: 0,
          textAlign: 'center',
          transform: 'rotate(-8deg)',
          color: INK.stampRed,
          ...display,
          fontSize: 12,
          textTransform: 'uppercase',
        }}
      >
        {info.name}
      </div>
      {/* descriptor + bank value on a scrim */}
      <div
        style={{
          position: 'absolute',
          top: '54%',
          left: '6%',
          right: '6%',
          height: '30%',
          background: 'rgba(242,233,210,0.86)',
          border: `1px solid ${INK.agedLine}`,
          borderRadius: 3,
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 4,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 7, lineHeight: 1.15 }}>{info.descriptor}</div>
        <div style={{ fontSize: 6, color: '#5b5344', ...mono(500) }}>or bank as ₹{info.value} Cr</div>
      </div>
      <div style={actionFooterStyle}>SAUDA ACTION PRESS</div>
      <Seal />
    </div>
  );
}

const actionFooterStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: '12%',
  background: INK.deepInk,
  color: INK.cardCream,
  fontSize: 5,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  letterSpacing: '0.12em',
  ...mono(500),
};

function KirayaFull({ card }: { card: Extract<Card, { kind: 'kiraya' }> }) {
  const isWild = card.colors === 'ANY';
  const inks = card.colors === 'ANY' ? (Object.keys(SETS) as SetId[]) : card.colors;
  return (
    <div style={frameStyle('full')}>
      {/* ink band(s) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20%', display: 'flex' }}>
        {inks.map((set, i) => (
          <div key={`${set}-${i}`} style={{ flex: 1, background: SETS[set].hex }} />
        ))}
      </div>
      <div style={{ position: 'absolute', top: '24%', left: 0, right: 0, textAlign: 'center', ...display, fontSize: 12, color: INK.stampRed }}>
        KIRAYA
      </div>
      <div style={{ position: 'absolute', top: '46%', left: '8%', right: '8%', textAlign: 'center', fontSize: 7 }}>
        <div>{isWild ? 'One rival pays' : 'All rivals pay'}</div>
        <div style={{ fontSize: 6, color: '#5b5344', marginTop: 3 }}>{KIRAYA_DESCRIPTOR}</div>
        <div style={{ fontSize: 6, color: '#5b5344', marginTop: 3 }}>
          {card.colors === 'ANY' ? 'any colour' : setLabels(card.colors)}
        </div>
      </div>
      <div style={actionFooterStyle}>SAUDA RENT PRESS</div>
      <CornerChip value={card.value} />
    </div>
  );
}

function WildcardFull({ card }: { card: Extract<Card, { kind: 'wildcard' }> }) {
  const isAny = card.colors === 'ANY';
  const inks = card.colors === 'ANY' ? (Object.keys(SETS) as SetId[]) : card.colors;
  return (
    <div style={frameStyle('full')}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '22%', display: 'flex' }}>
        {inks.map((set, i) => (
          <div key={`${set}-${i}`} style={{ flex: 1, background: SETS[set].hex }} />
        ))}
      </div>
      <div style={{ position: 'absolute', top: '26%', left: 0, right: 0, textAlign: 'center', ...display, fontSize: 9 }}>
        WILDCARD
      </div>
      <div style={{ position: 'absolute', top: '44%', left: '8%', right: '8%', textAlign: 'center', fontSize: 6.5, lineHeight: 1.4 }}>
        {card.colors === 'ANY' ? (
          <div>Counts for any colour · ₹0 · cannot pay</div>
        ) : (
          card.colors.map((set) => (
            <div key={set}>
              {SETS[set].label} — SET ₹{SETS[set].rent[SETS[set].rent.length - 1]} Cr
            </div>
          ))
        )}
      </div>
      {!isAny && <CornerChip value={card.value} />}
    </div>
  );
}

function MoneyFull({ card }: { card: Extract<Card, { kind: 'money' }> }) {
  const big = card.value === 10;
  return (
    <div style={{ ...frameStyle('full'), border: `2px solid ${INK.gold}` }}>
      <div style={{ position: 'absolute', inset: 4, border: `1.5px double ${INK.gold}`, borderRadius: 4 }} />
      {big && <div style={{ position: 'absolute', top: 4, left: 4, right: 4, height: 8, background: INK.gold }} />}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'center', ...mono(700), color: INK.deepInk }}>
        <span style={{ fontSize: 30 }}>₹{card.value}</span>
        <span style={{ fontSize: 12, marginLeft: 2, ...mono(500) }}>Cr</span>
      </div>
    </div>
  );
}

// --- MID (your own table sets) --------------------------------------------

function MidFace({ card, heldCount }: { card: Card; heldCount: number | undefined }) {
  const set = primarySet(card);
  if (card.kind === 'property' || (card.kind === 'wildcard' && set)) {
    const theme = SETS[set!];
    const held = heldCount ?? (card.kind === 'property' ? 1 : 1);
    return (
      <div style={frameStyle('mid')}>
        <div style={{ background: theme.hex, color: INK.cardCream, ...display, fontSize: 8, textAlign: 'center', padding: '2px 0', textTransform: 'uppercase' }}>
          {theme.label}
        </div>
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', padding: '4px 0' }}>
          {Array.from({ length: theme.size }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i < held ? theme.hex : 'transparent',
                border: `1px solid ${theme.hex}`,
              }}
            />
          ))}
        </div>
        <div style={{ textAlign: 'center', color: INK.stampRed, ...mono(700), fontSize: 8 }}>
          SET ₹{theme.rent[theme.rent.length - 1]} Cr
        </div>
        <CornerChip value={card.value} />
      </div>
    );
  }
  // Non-set cards get a compact neutral MID.
  return (
    <div style={{ ...frameStyle('mid'), display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono(700), fontSize: 11 }}>
      {card.kind === 'money' ? `₹${card.value} Cr` : miniLabel(card)}
    </div>
  );
}

// --- CHIP (rivals / log) ---------------------------------------------------

function ChipFace({ card, heldCount }: { card: Card; heldCount: number | undefined }) {
  const set = primarySet(card);
  if (set) {
    const theme = SETS[set];
    const complete = (heldCount ?? 0) >= theme.size;
    return (
      <div
        style={{
          ...frameStyle('chip'),
          background: theme.hex,
          color: INK.cardCream,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: complete ? `2px solid ${INK.gold}` : `2px solid ${INK.agedLine}`,
        }}
      >
        <span style={{ ...display, fontSize: 11 }}>{theme.label[0]}</span>
        <span style={{ ...mono(700), fontSize: 8, color: INK.gold }}>
          {complete ? '✓' : `${heldCount ?? 0}/${theme.size}`}
        </span>
      </div>
    );
  }
  return (
    <div style={{ ...frameStyle('chip'), display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', ...mono(700), fontSize: card.kind === 'money' ? 7 : 10 }}>
      {card.kind === 'money' ? `₹${card.value} Cr` : miniLabel(card)}
    </div>
  );
}

function miniLabel(card: Card): string {
  if (card.kind === 'action') return ACTIONS[card.action].name.slice(0, 3).toUpperCase();
  if (card.kind === 'kiraya') return 'KIR';
  if (card.kind === 'wildcard') return 'WILD';
  return '?';
}
