/**
 * THE BOOK — Niyam, the chaptered rules reference (P8 shell / K7, never built before). A contents
 * page and eight chapters, readable at 360px, each scrolling on its own. Two hard rules keep it
 * honest:
 *   1. Every NUMBER is derived from the engine's own constants (DEFAULT_RULES, SETS, ACTIONS, GAME),
 *      read at module load — so the Book can never drift from the rules the code actually enforces.
 *   2. The property/action pictures are REAL CardFace renders (representative ids from the deck),
 *      never redrawn stand-ins.
 * The one number with no exported constant — the win count (3 distinct complete colours, sets.ts) —
 * is a clearly-labelled literal that mirrors the engine; everything else is computed.
 *
 * Consult-only: the Book renders over the felt (or over a paused game via the in-game nav) and is
 * dismissed by the ✕ or a backdrop tap. It dispatches no engine action.
 */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { GAME, SETS, ACTIONS, DEFAULT_RULES, KIRAYA_NAME } from '@sauda/engine';
import type { ActionKind, SetId } from '@sauda/engine';
import { ScaledCard } from '../components/CardFace';
import { representativePropertyId, actionCardId } from '../design/cardData';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

const RULES = DEFAULT_RULES;
const SETS_TO_WIN = 3; // §4.1 (sets.ts hasThreeCompleteSets): 3 complete sets of DISTINCT colours.
const SET_ORDER = Object.keys(SETS) as SetId[];
const CURRENCY = GAME.currency;

// NAHI CHALEGA cancels an action PLAYED AGAINST you; self-plays and attachments can't be countered.
// (Game knowledge — there is no single engine flag for it; kept beside the actions it describes.)
const COUNTERABLE: Record<ActionKind, boolean> = {
  kabza: true,
  haathKiSafai: true,
  adlaBadli: true,
  vasooli: true,
  shagun: true,
  nahiChalega: false,
  aageBadho: false,
  makaan: false,
  haveli: false,
  dugna: false,
};

interface Chapter {
  title: string;
  body: () => ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    title: 'Goal & Winning',
    body: () => (
      <>
        <P>
          {GAME.name} is a race to build property empires. You win the moment you own{' '}
          <B>{SETS_TO_WIN} complete sets of {SETS_TO_WIN} different colours</B> — declared on your own
          turn.
        </P>
        <P>Two same-colour sets still count as one colour, so spread your building across the board.</P>
        <P>Everything else — money, rent, action cards — exists to get you those three sets first, or
          to slow the others down.</P>
      </>
    ),
  },
  {
    title: 'Your Turn',
    body: () => (
      <>
        <P><B>Draw.</B> Your turn opens by drawing {RULES.drawPerTurn} cards automatically (or{' '}
          {RULES.emptyHandDraw} if your hand is empty).</P>
        <P><B>Play up to {RULES.playsPerTurn}.</B> Each turn you may make {RULES.playsPerTurn} plays:
          place a property, bank a card, or play an action. The gold turn token shows how many plays
          remain and ends your turn for you when they run out — tap it to end early.</P>
        <P><B>Hand limit {RULES.handLimit}.</B> If you finish a turn holding more than {RULES.handLimit}{' '}
          cards, you discard down to {RULES.handLimit}. House rule: discards go face-down UNDER the
          draw pile, not onto a discard heap.</P>
      </>
    ),
  },
  {
    title: 'Properties & Wildcards',
    body: () => (
      <>
        <P>Each colour needs a set number of properties to complete. Rent rises as you add to a set —
          the ladder below is the exact rent the engine charges.</P>
        {SET_ORDER.map((set) => (
          <SetRow key={set} set={set} />
        ))}
        <P style={{ marginTop: 14 }}>
          <B>Wildcards.</B> A dual wildcard counts as EITHER of its two printed colours (you choose,
          and may move it later). An ANY wildcard joins any set — but a set of ONLY wildcards can
          never be completed; a real property of that colour must anchor it.
        </P>
      </>
    ),
  },
  {
    title: 'Money & Payment',
    body: () => (
      <>
        <P>Cards banked as money pay debts (rent, Vasooli, Shagun). Your bank is public.</P>
        <P>When you owe, YOU choose which cards to hand over — from your bank or even your properties —
          up to the debt. <B>No change is given:</B> overpaying loses the difference, so pay tight.</P>
        <P>If you have nothing of value, you pay nothing — a debt can't be owed forward.</P>
      </>
    ),
  },
  {
    title: `${KIRAYA_NAME} & DUGNA ${KIRAYA_NAME}`,
    body: () => (
      <>
        <P><B>{KIRAYA_NAME}</B> charges rent for a colour you own. The more of that colour's set you
          hold, the higher the rent (see the ladders in chapter 3). A dual {KIRAYA_NAME} lets you pick
          which of its two colours to charge.</P>
        <P><B>Dugna {KIRAYA_NAME}</B> attaches to a rent charge and doubles it. You may stack up to{' '}
          {RULES.maxDugnaPerCharge} — so a single charge can reach{' '}
          {2 ** RULES.maxDugnaPerCharge}× its printed rent.</P>
        <P>Buildings raise rent too: a Makaan adds {CURRENCY.replace(' ', '')}{ACTIONS.makaan.value}, a
          Haveli adds {ACTIONS.haveli.value} more (a Makaan must come first).</P>
      </>
    ),
  },
  {
    title: 'Action Cards',
    body: () => (
      <>
        <P>Action cards bend the game. Each can also be banked as money instead of played.</P>
        {(Object.keys(ACTIONS) as ActionKind[]).map((action) => (
          <ActionRow key={action} action={action} />
        ))}
      </>
    ),
  },
  {
    title: 'Nahi Chalega',
    body: () => (
      <>
        <P><B>{ACTIONS.nahiChalega.name}</B> — "{ACTIONS.nahiChalega.descriptor}". When an action is
          played against you, you may answer with a Nahi Chalega to cancel it outright.</P>
        <P>It can be countered in turn: a Nahi Chalega on a Nahi Chalega revives the original action,
          and so on up the chain — the last one standing decides what happens.</P>
        <P>Self-plays and attachments (drawing, building, doubling) target no one, so there is nothing
          to cancel.</P>
      </>
    ),
  },
  {
    title: 'Munshi ki Salah',
    body: () => (
      <>
        <P>Your Munshi (accountant) offers up to three hints a game. Seven of his standing tips:</P>
        <Tip n={1}>Bank early — you can't pay rent with properties you're still collecting.</Tip>
        <Tip n={2}>Chase three DIFFERENT colours; a fourth of one you own doesn't win.</Tip>
        <Tip n={3}>Hold a Nahi Chalega for the Kabza that steals a finished set.</Tip>
        <Tip n={4}>Small sets (2 cards) complete fastest — good first targets.</Tip>
        <Tip n={5}>Don't overpay: no change is given.</Tip>
        <Tip n={6}>A wildcard is flexible — place it where it completes a set soonest.</Tip>
        <Tip n={7}>Watch opponents' banks; charge rent when they can't pay.</Tip>
      </>
    ),
  },
];

export function Book({ onClose }: { onClose: () => void }) {
  // Deep-link: the Home ribbon opens #/niyam?chapter=1. 0 = the contents page.
  const initial = readChapterParam();
  const [chapter, setChapter] = useState<number>(initial);
  const current = chapter >= 1 && chapter <= CHAPTERS.length ? CHAPTERS[chapter - 1]! : null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      {/* R7: the Book is a natural TWO-PANE in landscape — a persistent contents rail on the left, the
          selected chapter on the right. The rail replaces the old toggle between a contents page and a
          chapter, so the reader always sees where they are. Dismiss patterns unchanged (✕ / backdrop). */}
      <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
        <nav style={railStyle}>
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 18, color: STAGE.cardCream, padding: '0 4px 8px' }}>Niyam</div>
          <ol style={contentsStyle}>
            {CHAPTERS.map((ch, index) => (
              <li key={ch.title}>
                <button style={contentsItem(chapter === index + 1)} onClick={() => setChapter(index + 1)}>
                  <span style={{ color: STAGE.accentGold, marginRight: 8 }}>{index + 1}</span>
                  {ch.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div style={contentPaneStyle}>
          <div style={headerStyle}>
            <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 15, color: STAGE.accentGold }}>
              {current ? `${chapter}. ${current.title}` : 'The rules of the game'}
            </div>
            <button style={closeButton} onClick={onClose} aria-label="Close the book">✕</button>
          </div>
          <div style={scrollStyle}>
            {current ? (
              current.body()
            ) : (
              <P>Pick a chapter on the left to read the rules. New here? Start with{' '}
                <B>1. Goal &amp; Winning</B>.</P>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function readChapterParam(): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  const query = window.location.hash.split('?')[1] ?? '';
  const value = new URLSearchParams(query).get('chapter');
  const n = value ? Number(value) : 0;
  return Number.isInteger(n) && n >= 1 && n <= CHAPTERS.length ? n : 0;
}

// One set's row: its real card, colour swatch, size, bank value, and the exact rent ladder.
function SetRow({ set }: { set: SetId }) {
  const theme = SETS[set];
  const cardId = representativePropertyId(set);
  return (
    <div style={setRowStyle}>
      {cardId && <ScaledCard cardId={cardId} width={54} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: theme.hex, flexShrink: 0 }} />
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 14, color: STAGE.cardCream }}>{theme.label}</span>
        </div>
        <div style={dataLine}>Set of {theme.size} · bank {CURRENCY.replace(' ', '')}{theme.value} each</div>
        <div style={dataLine}>Rent: {theme.rent.map((r, i) => `${i + 1}→${r}`).join('  ')}</div>
      </div>
    </div>
  );
}

// One action's row: its real card, name, effect, how many are in the deck, and counterable-or-not.
function ActionRow({ action }: { action: ActionKind }) {
  const theme = ACTIONS[action];
  const cardId = actionCardId(action);
  return (
    <div style={setRowStyle}>
      {cardId && <ScaledCard cardId={cardId} width={54} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 14, color: STAGE.cardCream }}>{theme.name}</div>
        <div style={dataLine}>{theme.descriptor}</div>
        <div style={dataLine}>
          {theme.count} in the deck · {COUNTERABLE[action] ? 'can be Nahi Chalega’d' : 'cannot be countered'}
        </div>
      </div>
    </div>
  );
}

function P({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ ...paraStyle, ...style }}>{children}</p>;
}
function B({ children }: { children: ReactNode }) {
  return <strong style={{ color: STAGE.cardCream }}>{children}</strong>;
}
function Tip({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p style={{ ...paraStyle, display: 'flex', gap: 8 }}>
      <span style={{ color: STAGE.accentGold, fontWeight: 700 }}>{n}.</span>
      <span>{children}</span>
    </p>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.surface,
  background: `radial-gradient(120% 80% at 50% 30%, ${INK.tableIndigo}, ${INK.deepInk})`,
  display: 'flex',
  justifyContent: 'center',
  padding: 'calc(env(safe-area-inset-top, 0px)) 0 calc(env(safe-area-inset-bottom, 0px))',
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
};
// R7: the two-pane book fills the landscape width — a fixed contents rail + a flexible chapter pane.
const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: 900,
  height: '100dvh',
  display: 'flex',
  flexDirection: 'row',
  padding: '0 env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px)',
};
const railStyle: CSSProperties = {
  width: 260,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  padding: '14px 10px',
  borderRight: `1px solid ${STAGE.scrimSheet}`,
  overflowY: 'auto',
};
const contentPaneStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};
const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: `1px solid ${STAGE.scrimSheet}`,
};
const scrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '12px 18px 40px',
  WebkitOverflowScrolling: 'touch',
};
const paraStyle: CSSProperties = {
  fontFamily: FONT.serif,
  fontSize: 14,
  lineHeight: 1.5,
  color: STAGE.textOnFelt,
  margin: '0 0 12px',
};
const contentsStyle: CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 };
// R7: the rail item, with an active state so the reader sees which chapter is open (gold ring + fill).
function contentsItem(active: boolean): CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    minHeight: 44,
    border: `1px solid ${active ? INK.gold : STAGE.scrimSheet}`,
    borderRadius: 10,
    background: active ? STAGE.scrimSheet : 'transparent',
    color: active ? STAGE.accentGold : STAGE.cardCream,
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 14,
    padding: '0 12px',
    cursor: 'pointer',
  };
}
const setRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: `1px solid ${STAGE.scrimSheet}`,
};
const dataLine: CSSProperties = { fontFamily: FONT.mono, fontSize: 11, color: STAGE.textOnFelt, opacity: 0.85, marginTop: 2 };
const closeButton: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: `1.5px solid ${INK.gold}`,
  background: STAGE.scrimSheet,
  color: STAGE.accentGold,
  fontSize: 15,
  cursor: 'pointer',
};
