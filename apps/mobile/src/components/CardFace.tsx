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
import { ACTIONS, KIRAYA_DESCRIPTOR, KIRAYA_NAME, SETS } from '@sauda/engine';
import type { Card, SetId } from '@sauda/engine';
import { CARD, FONT, INK, cardWidth } from '../design/tokens';
import type { CardSize } from '../design/tokens';
import { cardById, plateKey, propertyName, setLabels } from '../design/cardData';
import { plateUrl, hasPlate } from '../design/plates';
import { titleInkForPlate, inkForBanner, actionBannerHex, ACTION_BANNER_HEX } from '../design/titleInk';

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
    fontFamily: FONT.serif, // vintage letterpress voice on the card face (no modern sans)
    userSelect: 'none',
  };
}

// --- plate layer -----------------------------------------------------------

function Plate({ card }: { card: Card }) {
  // Action cards resolve to a single per-kind plate; others use their own id.
  const url = plateUrl(plateKey(card));
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

// A thin dark halo (the vintage-label "keyline") so cream title text lifts cleanly
// off a coloured banner. Only applied when the adaptive ink is cream (§3).
const TITLE_KEYLINE = '0 0 1.5px rgba(20,18,31,0.85), 0 1px 1px rgba(20,18,31,0.55)';

// Footer band height as a single source, shared by FooterBand and the corner marks.
const FOOTER_HEIGHT_PCT = 19;
// The band's vertical centre (in % from the card bottom). The seal (bottom-right)
// and the value chip (bottom-left) are both centred on this line, in the corners.
const FOOTER_MID_PCT = FOOTER_HEIGHT_PCT / 2;
const SEAL_SIZE = 20;

// Shared gold value-chip look, used by the corner chip on all card kinds.
const valueChipStyle: CSSProperties = {
  padding: '1px 4px',
  borderRadius: 3,
  background: INK.gold,
  color: INK.deepInk,
  fontSize: 8,
  whiteSpace: 'nowrap',
  ...mono(700),
};

// Value badge: a SOLID cream seal that completely covers the plate's printed
// top-left circle (the empty placeholder disc the art leaves for the value).
// Owner item C: the disc is fully opaque and sized a touch LARGER than that
// printed circle. Measured across all 38 plates, the printed circles sit slightly
// RIGHT of centre (~(20–25, 18–21) card units, up to ~28 wide; Junctions' is the
// largest/most offset). A 36-unit disc centred ~(23,20) covers the worst case, so
// no painted ring ever peeks around it.
function ValueBadge({ value, ink }: { value: number; ink: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 2,
        left: 5,
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: INK.cardCream, // opaque hex — no alpha, so the printed disc is hidden
        border: `1.5px solid ${ink}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.03em',
        fontSize: 7,
        ...mono(700),
      }}
    >
      ₹{value} Cr
    </div>
  );
}

// Press seal: a gold line-stamp with the सौ monogram, in the footer band's
// bottom-right corner, vertically centred on the band, clear of the centred text.
function Seal() {
  return (
    <div
      title="SAUDA PRESS"
      style={{
        position: 'absolute',
        right: 3,
        bottom: `${FOOTER_MID_PCT}%`,
        transform: 'translateY(50%)',
        width: SEAL_SIZE,
        height: SEAL_SIZE,
        borderRadius: '50%',
        border: `1.5px solid ${INK.gold}`,
        color: INK.stampRed,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        ...display,
      }}
    >
      सौ
    </div>
  );
}

// Corner value chip so fanned cards always read. Defaults bottom-right; property
// cards pass side="left" so it never collides with the seal.
function CornerChip({ value, side = 'right' }: { value: number; side?: 'left' | 'right' }) {
  const horizontal = side === 'left' ? { left: 4 } : { right: 4 };
  return <div style={{ position: 'absolute', bottom: 3, ...horizontal, ...valueChipStyle }}>₹{value} Cr</div>;
}

// Vintage footer: a warm cream/gold band with dark-ink letterpress text and thin
// rules top and bottom (not a modern solid-colour UI bar).
function FooterBand({ set }: { set: SetId }) {
  const theme = SETS[set];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: `${FOOTER_HEIGHT_PCT}%`,
        background: '#E7D3A1',
        color: INK.deepInk,
        borderTop: `1px solid ${INK.agedLine}`,
        borderBottom: `1px solid ${INK.agedLine}`,
        // generous side padding keeps the centred text inside the corner marks
        padding: '1px 30px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1.5,
        fontFamily: FONT.serif,
        textAlign: 'center',
      }}
    >
      {/* works line: one line, small fine-print, centred inside the side padding so
          the corner chip/seal never cover a letter (fits the longest city name). */}
      <div style={{ fontSize: 3.4, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        {theme.works}
      </div>
      <div style={{ fontSize: 3.8 }}>SAFETY DEEDS · EST. {theme.est}</div>
    </div>
  );
}

// A stacked matchbox-card count icon: `count` cards fanned up-and-right, the front
// card carrying the red match-tip corner and the count numeral. So a player reads
// the set size at a glance (1 card, 2 stacked, 3 stacked…). Sized by the caller.
function MatchIcon({
  count,
  ink,
  w,
  h,
  fs,
  off,
}: {
  count: number;
  ink: string;
  w: number;
  h: number;
  fs: number;
  off: number;
}) {
  const tip = Math.round(w * 0.34);
  const cards = [];
  // Draw back-to-front so the front card (i=0, bottom-left) paints on top.
  for (let i = count - 1; i >= 0; i--) {
    const isFront = i === 0;
    cards.push(
      <span
        key={i}
        style={{
          position: 'absolute',
          left: i * off,
          bottom: i * off,
          width: w,
          height: h,
          border: `1px solid ${ink}`,
          borderRadius: 2,
          background: INK.cardCream,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fs,
          ...mono(700),
        }}
      >
        {isFront && (
          <span style={{ position: 'absolute', top: 0, right: 0, width: tip, height: tip, background: INK.stampRed }} />
        )}
        {isFront ? count : ''}
      </span>,
    );
  }
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: w + (count - 1) * off,
        height: h + (count - 1) * off,
      }}
    >
      {cards}
    </span>
  );
}

// The rent ladder: a confident, horizontally-centred ledger with even rhythm.
// Each row is one line (icon/label · leader · value); type is kept small enough
// that "FULL SET" and its value never wrap. The caption/label use the serif voice.
function RentLadder({ set }: { set: SetId }) {
  const theme = SETS[set];
  const big = theme.size <= 2;
  const size3 = theme.size === 3;
  // Sized so all rows (with the stacked icon) fit the fixed ledger area, even for
  // 4-row sets (Junctions). Small sets get the boldest icons; 3–4-row sets are
  // compacted so they always clear the art frame above and the footer below.
  const iconW = big ? 14 : size3 ? 12 : 10;
  const iconH = big ? 17 : size3 ? 12 : 10;
  const iconFs = big ? 8 : size3 ? 7 : 6;
  const off = big ? 2 : size3 ? 1 : 0.75;
  const textFs = big ? 8 : size3 ? 7 : 6;
  const rowGap = big ? 2 : 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: rowGap, width: '100%' }}>
      {/* The stacked count icons already show "deeds held", so the caption only
          appears on 2-card sets (where there's room); on 3–4-card sets it is
          dropped so the extra rows always clear the art frame — no per-city art
          tuning needed. */}
      {big && (
        <div style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 5, color: '#5b5344' }}>
          deeds held of this colour
        </div>
      )}
      {theme.rent.map((rent, index) => {
        const count = index + 1;
        const isFullSet = count === theme.size;
        return (
          <div
            key={count}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '90%', // rides inside the ledger slip; wide enough that the big
              // 2-card "FULL SET ₹N Cr" row never overflows the slip's edge
              gap: 2,
              color: isFullSet ? INK.stampRed : INK.deepInk,
            }}
          >
            {/* every row shows its count icon; the full-set row shows the set size
                (stacked) plus the FULL SET label */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <MatchIcon count={count} ink={theme.hex} w={iconW} h={iconH} fs={iconFs} off={off} />
              {isFullSet && (
                <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: textFs, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  FULL SET
                </span>
              )}
            </span>
            <span style={{ flex: 1, borderBottom: `1px dotted ${INK.agedLine}`, margin: '0 3px', height: 1 }} />
            <span style={{ ...mono(700), fontSize: textFs, whiteSpace: 'nowrap' }}>₹{rent} Cr</span>
          </div>
        );
      })}
    </div>
  );
}

// The "ledger slip": a worn aged-cream panel pasted behind the rent ladder, like a
// ruled parchment slip on a vintage deed. Owner call (DECISIONS.md) — a UNIFORM,
// subtle ~93%-opaque wash that REVERSES the old no-wash law now that plate QC is
// complete: robustness (the rent rows always read over any art) now beats the
// zero-scrim purity that art QC no longer needs. Same treatment on every property
// card — never per-plate tuning.
const ledgerSlipStyle: CSSProperties = {
  width: '96%',
  boxSizing: 'border-box',
  padding: '4px 6px',
  background: 'rgba(238,229,205,0.93)', // aged cream at ~93% — the art only whispers through
  border: `1px solid ${INK.agedLine}`,
  borderRadius: 3,
  // a pasted-slip lift plus a faint inner age-stain for the worn, aged edge
  boxShadow: '0 1px 2px rgba(20,18,31,0.20), inset 0 0 5px rgba(150,120,60,0.14)',
};

function PropertyFull({ card }: { card: Extract<Card, { kind: 'property' }> }) {
  const theme = SETS[card.set];
  // §3: pick cream-vs-dark title ink per plate so the name reads on its banner.
  const titleInk = titleInkForPlate(card.id, card.set);
  const keyline = titleInk.keyline ? { textShadow: TITLE_KEYLINE } : {};
  return (
    <div style={frameStyle('full')}>
      <Plate card={card} />
      <ValueBadge value={card.value} ink={theme.hex} />

      {/* title zone (0.06–0.20 H). Owner item B: the LARGE letterpress title is the
          set / city name (MUMBAI, KOLKATA, JUNCTIONS…); the small serif sublabel is
          the individual locality (Marine Drive, T. Nagar…). Swapped on every card.
          Inset from the left so it clears the enlarged value badge (item C) — the two
          read as an emblem + title header, and cream titles never vanish onto the
          cream badge. */}
      <div style={{ position: 'absolute', top: '6.5%', left: 43, right: 5, textAlign: 'center' }}>
        <div style={{ ...display, letterSpacing: '0', fontSize: 9, lineHeight: 1.02, textTransform: 'uppercase', color: titleInk.name, ...keyline }}>
          {theme.label}
        </div>
        <div style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 5.5, letterSpacing: '0.08em', color: titleInk.sub, textTransform: 'uppercase', ...keyline }}>
          {propertyName(card)}
        </div>
      </div>

      {/* ledger zone — the rent ladder rides on the aged-cream ledger slip (item A),
          centred in the upper-middle, clear of the footer band below (~81%). */}
      <div
        style={{
          position: 'absolute',
          top: '52%',
          left: '6%',
          right: '6%',
          bottom: '22%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={ledgerSlipStyle}>
          <RentLadder set={card.set} />
        </div>
      </div>

      <FooterBand set={card.set} />
      <Seal />
      {/* value chip in the footer band's bottom-LEFT corner, vertically centred on
          the band — same level as the seal, both clear of the centred footer text. */}
      <div
        style={{
          position: 'absolute',
          left: 3,
          bottom: `${FOOTER_MID_PCT}%`,
          transform: 'translateY(50%)',
          padding: '0.5px 3px',
          borderRadius: 2,
          background: INK.gold,
          color: INK.deepInk,
          fontSize: 6,
          whiteSpace: 'nowrap',
          ...mono(700),
        }}
      >
        ₹{card.value} Cr
      </div>
    </div>
  );
}

function ActionFull({ card }: { card: Extract<Card, { kind: 'action' }> }) {
  const info = ACTIONS[card.action];
  // §5: the ACTION label sits on the plate's deep-crimson banner. Pick its ink by
  // the same contrast rule as property titles — cream + keyline on the crimson band,
  // and the original red stamp on the gold/fallback banners where it already reads.
  const bannerInk = inkForBanner(actionBannerHex(plateKey(card), hasPlate(plateKey(card))));
  const onDarkBanner = bannerInk.name === INK.cardCream;
  return (
    <div style={frameStyle('full')}>
      <Plate card={card} />
      {/* bank value in the banner circle, from engine data (ACTIONS[kind].value) */}
      <ValueBadge value={info.value} ink={ACTION_BANNER_HEX} />
      {/* ACTION label — cream+keyline on crimson, red stamp on the gold/fallback banner */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: onDarkBanner ? INK.cardCream : INK.stampRed,
          fontSize: 6,
          ...mono(700),
          letterSpacing: '0.25em',
          ...(onDarkBanner ? { textShadow: TITLE_KEYLINE } : {}),
        }}
      >
        ACTION
      </div>
      {/* name stamp + descriptor + bank, centred in the clear lower cream below the
          hero art (keeps the hand/bundle vignette uncovered), clear of the footer. */}
      <div
        style={{
          position: 'absolute',
          top: '62%',
          left: '8%',
          right: '8%',
          bottom: '20%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            transform: 'rotate(-8deg)',
            color: INK.stampRed,
            ...display,
            fontSize: 12,
            lineHeight: 1,
            textTransform: 'uppercase',
          }}
        >
          {info.name}
        </div>
        <div style={{ fontFamily: FONT.serif, fontSize: 7, lineHeight: 1.15 }}>{info.descriptor}</div>
        <div style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 5.5, color: '#5b5344' }}>
          or bank as ₹{info.value} Cr
        </div>
      </div>
      <div style={actionFooterStyle}>SAUDA ACTION PRESS</div>
      <Seal />
    </div>
  );
}

// Action footer: same vintage cream/gold band as property (not a dark UI bar).
const actionFooterStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: `${FOOTER_HEIGHT_PCT}%`,
  background: '#E7D3A1',
  color: INK.deepInk,
  borderTop: `1px solid ${INK.agedLine}`,
  borderBottom: `1px solid ${INK.agedLine}`,
  fontFamily: FONT.serif,
  fontSize: 5,
  letterSpacing: '0.08em',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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
        {KIRAYA_NAME}
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

// A denomination numeral centred in one of the note plate's four corner circles.
// Bare number (the ₹ reads from the painted note) — and distinct from the centre
// "₹N" so a text lookup of the denomination finds exactly one match. `at` is the
// circle's centre (% of the card); translate(-50%,-50%) centres the glyph on it.
function MoneyCorner({ value, at }: { value: number; at: { left: string; top: string } }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: at.left,
        top: at.top,
        transform: 'translate(-50%, -50%)',
        fontSize: 8,
        ...mono(700),
        color: INK.deepInk,
      }}
    >
      {value}
    </div>
  );
}

function MoneyFull({ card }: { card: Extract<Card, { kind: 'money' }> }) {
  // Note-plate present (money_<value>.webp): the painting carries an empty centre
  // cartouche + four empty corner circles, and the live layer drops ONLY the
  // numerals in, like real currency (IBM Plex Mono). Corner positions are best-fit
  // to the incoming note design and can be nudged when the art lands — same
  // discipline as the property value badge.
  if (hasPlate(plateKey(card))) {
    return (
      <div style={frameStyle('full')}>
        <Plate card={card} />
        {/* centre cartouche: big ₹N over a small Cr, centred in the painted oval */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            ...mono(700),
            color: INK.deepInk,
          }}
        >
          <span style={{ fontSize: 30 }}>₹{card.value}</span>
          <span style={{ fontSize: 11, marginTop: 1, ...mono(500) }}>Cr</span>
        </div>
        {/* four corner circles — numerals centred on each (circle centres measured
            off the art: ~15.5/84.5% across, ~11.5/88% down) */}
        <MoneyCorner value={card.value} at={{ left: '15.5%', top: '11.5%' }} />
        <MoneyCorner value={card.value} at={{ left: '84.5%', top: '11.5%' }} />
        <MoneyCorner value={card.value} at={{ left: '15.5%', top: '88%' }} />
        <MoneyCorner value={card.value} at={{ left: '84.5%', top: '88%' }} />
      </div>
    );
  }
  // Fallback (no note art yet): the current plain gold-ruled note design.
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
  if (card.kind === 'kiraya') return KIRAYA_NAME.slice(0, 3).toUpperCase(); // "LAG"
  if (card.kind === 'wildcard') return 'WILD';
  return '?';
}
