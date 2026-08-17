/**
 * HOME — the game's front door (P8 shell, owner phone test 1 Aug; the K6 screen that was never
 * built). Deep-indigo felt, the SAUDA wordmark code-drawn in a rubber-stamp ring, the theme tagline,
 * and three doors:
 *   • KHELO   → an inline vintage setup card (1–3 bots · difficulty) that deals straight into #/play.
 *   • VS FRIENDS → present but stamped COMING SOON (MP1 wires it; pass-and-play is removed from the UI).
 *   • NIYAM   → the Book (#/niyam).
 * A first-run ribbon invites a newcomer into the Book; it never shows again after a completed game.
 *
 * All theme text comes from the engine theme (GAME) — no game strings live here (spec §2).
 */
import { useState } from 'react';
import { GAME } from '@sauda/engine';
import type { Difficulty } from '@sauda/bots';
import { useGame } from '../game/store';
import type { SeatConfig } from '../game/store';
import { useOrientation } from '../game/orientation';
import { resolveSeed } from '../game/seed';
import { hasCompletedGame, hasSeenTutorialOffer, markTutorialOfferSeen } from './firstRun';
import { STAGE, INK, FONT, SHADOW } from '../design/tokens';

function go(hash: string): void {
  if (typeof window !== 'undefined') {
    window.location.hash = hash;
  }
}

export function Home() {
  const newGame = useGame((store) => store.newGame);
  const [setupOpen, setSetupOpen] = useState(false);
  const [bots, setBots] = useState(3); // solo: number of bot opponents (1–3)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const showRibbon = !hasCompletedGame();
  // U3: the guided tutorial auto-offers ONCE on the first visit — an invitation, never a wall (KHELO
  // stays right there). After it is taken or declined it never auto-appears; the permanent "Sikho"
  // door below always remains.
  const [offerTutorial, setOfferTutorial] = useState(() => !hasSeenTutorialOffer());
  // U2: with the rotate gate retired, Home can render in portrait too — stack the two panes vertically
  // there so the wordmark and the doors each get the full width instead of a squeezed half.
  const portrait = useOrientation() === 'portrait';

  function watchTutorial() {
    markTutorialOfferSeen();
    setOfferTutorial(false);
    go('#/sikho');
  }
  function declineTutorial() {
    markTutorialOfferSeen();
    setOfferTutorial(false);
  }

  function deal() {
    const seats: SeatConfig[] = [{ kind: 'human' }];
    for (let i = 0; i < bots; i++) {
      seats.push({ kind: 'bot', difficulty });
    }
    // S6a: a fresh crypto-strength seed per game (resolveSeed), unless `?seed=<n>` pins one for
    // tooling. The engine is deterministic given the seed — the NO-Math.random law is the engine's,
    // not the shell's — but the shell must still deal a DIFFERENT game each time (owner, 13 Aug).
    newGame({ seats, seed: resolveSeed() });
    go('#/play');
  }

  // R7: landscape two-pane front door — the wordmark + tagline on one side, the doors on the other,
  // so the whole shell fits the short landscape height (the old single vertical column would overflow
  // a 360px-tall screen). The rotate gate (R0) guarantees we are always landscape here.
  return (
    <div style={{ ...screenStyle, flexDirection: portrait ? 'column' : 'row' }}>
      <div style={leftPaneStyle}>
        {/* the rubber-stamp wordmark — code-drawn ring, no asset */}
        <StampWordmark />
        <div style={taglineStyle}>{GAME.tagline}</div>
        {/* U3: the first-visit tutorial invitation — an offer, not a wall. Decline drops it forever. */}
        {offerTutorial && !setupOpen && (
          <div style={offerCardStyle}>
            <div style={offerTextStyle}>Pehli baar? Dekho ek demo game.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={offerWatchStyle} onClick={watchTutorial}>Sikho →</button>
              <button style={offerLaterStyle} onClick={declineTutorial}>Baad mein</button>
            </div>
          </div>
        )}
        {showRibbon && !setupOpen && !offerTutorial && (
          <button style={ribbonStyle} onClick={() => go('#/niyam?chapter=1')}>
            Naye ho? Niyam se shuru karo →
          </button>
        )}
      </div>

      <div style={rightPaneStyle}>
        {!setupOpen ? (
          <div style={buttonsColumn}>
            <button style={primaryButton} onClick={() => setSetupOpen(true)}>
              KHELO
            </button>
            <button style={comingSoonButton} disabled title="Online multiplayer is coming soon">
              VS FRIENDS
              <span style={comingSoonStamp}>COMING SOON</span>
            </button>
            <button style={secondaryButton} onClick={() => go('#/niyam')}>
              NIYAM
            </button>
            {/* U3: the permanent tutorial door — always here, first visit or not. */}
            <button style={secondaryButton} onClick={() => go('#/sikho')}>
              SIKHO — watch a demo
            </button>
          </div>
        ) : (
          <SetupCard
            bots={bots}
            difficulty={difficulty}
            onBots={setBots}
            onDifficulty={setDifficulty}
            onDeal={deal}
            onBack={() => setSetupOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// U4 (first-player pass): the OPPONENT described in the owner's framing — an inexperienced player on
// easy, a decent one on medium, a sharp one on hard. So the player knows who they are sitting across
// from, not just an abstract "difficulty".
const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  easy: 'A beginner still learning the game — plays gently, misses the sharp moves.',
  medium: 'Knows the game, but misses a trick now and then.',
  hard: 'Plays to win — as sharp as the advisor.',
};

// The human's rough expected win share, by difficulty × bot count (1/2/3), from the U4 1000-game
// fairness measurement (a competent-player proxy; see DECISIONS "U4"). Shown so the player's
// expectation matches reality — at a 3-bot table a fair share is only ~25%, so even a strong player
// cannot win 4-in-5 there; the copy states that honestly. A first-timer wins less than these; on easy
// the opening-hand assist keeps them in the game (see DECISIONS "U4").
const WIN_SHARE: Record<Difficulty, [number, number, number]> = {
  easy: [91, 88, 84],
  medium: [68, 54, 45],
  hard: [57, 32, 23],
};

function expectedShare(difficulty: Difficulty, bots: number): number {
  return WIN_SHARE[difficulty][Math.min(bots, 3) - 1]!;
}

function fairShare(bots: number): number {
  return Math.round(100 / (bots + 1)); // 1 human + `bots` opponents
}

// The inline setup card (KHELO) — a vintage ledger slip: opponents 1–3, difficulty, then DEAL.
function SetupCard({
  bots,
  difficulty,
  onBots,
  onDifficulty,
  onDeal,
  onBack,
}: {
  bots: number;
  difficulty: Difficulty;
  onBots: (n: number) => void;
  onDifficulty: (d: Difficulty) => void;
  onDeal: () => void;
  onBack: () => void;
}) {
  return (
    <div style={setupCardStyle}>
      <div style={setupHeading}>New game</div>

      <div style={setupRowLabel}>Opponents (bots)</div>
      <div style={segmentRow}>
        {[1, 2, 3].map((n) => (
          <button key={n} style={segmentButton(bots === n)} onClick={() => onBots(n)}>
            {n}
          </button>
        ))}
      </div>

      <div style={setupRowLabel}>Difficulty</div>
      <div style={segmentRow}>
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <button key={d} style={segmentButton(difficulty === d)} onClick={() => onDifficulty(d)}>
            {d[0]!.toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {/* S6e: what the chosen difficulty means, and the human's rough expected win share at this bot
          count — so the owner's expectation matches reality (a 3-bot table is a ~25% fair share). */}
      <div style={setupBlurb}>{DIFFICULTY_BLURB[difficulty]}</div>
      <div style={setupShare}>
        Vs {bots} bot{bots > 1 ? 's' : ''}: you win about{' '}
        <strong>{expectedShare(difficulty, bots)}%</strong> of games (a fair share is {fairShare(bots)}%).
      </div>

      <button style={primaryButton} onClick={onDeal}>
        DEAL
      </button>
      <button style={linkButton} onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}

// The code-drawn rubber-stamp wordmark: two ink rings, the SAUDA name in the centre, small stars —
// the "approved matchbox" mood. Pure SVG/CSS, no asset (the locked plate art is untouched).
function StampWordmark() {
  return (
    <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 200 200" width={200} height={200} aria-hidden style={{ position: 'absolute', inset: 0 }}>
        <circle cx={100} cy={100} r={94} fill="none" stroke={INK.gold} strokeWidth={2} opacity={0.85} />
        <circle cx={100} cy={100} r={82} fill="none" stroke={INK.gold} strokeWidth={1} opacity={0.55} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={wordmarkText}>{GAME.name}</div>
        <div style={{ color: STAGE.accentGold, fontSize: 12, letterSpacing: '0.3em', opacity: 0.8 }}>★ ★ ★</div>
      </div>
    </div>
  );
}

const screenStyle = {
  position: 'fixed',
  inset: 0,
  height: '100dvh',
  width: '100vw',
  display: 'flex',
  flexDirection: 'row', // R7: landscape two-pane
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  padding: 'calc(env(safe-area-inset-top, 0px) + 20px) calc(env(safe-area-inset-right, 0px) + 28px) calc(env(safe-area-inset-bottom, 0px) + 20px) calc(env(safe-area-inset-left, 0px) + 28px)',
  background: `radial-gradient(120% 80% at 50% 30%, ${INK.tableIndigo}, ${INK.deepInk})`,
  color: STAGE.textOnFelt,
  overflow: 'hidden',
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
} as const;

// R7: the identity side (wordmark · tagline · first-run ribbon) and the doors side.
const leftPaneStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
} as const;
const rightPaneStyle = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const wordmarkText = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 40,
  letterSpacing: '0.12em',
  color: STAGE.cardCream,
  textShadow: SHADOW.titleKeyline,
} as const;

const taglineStyle = {
  marginTop: 12,
  fontFamily: FONT.serif,
  fontStyle: 'italic',
  fontSize: 15,
  color: STAGE.accentGold,
} as const;

const buttonsColumn = { width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 } as const;

const baseButton = {
  width: '100%',
  minHeight: 56,
  borderRadius: 12,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: '0.08em',
  cursor: 'pointer',
} as const;

const primaryButton = {
  ...baseButton,
  border: `2px solid ${INK.gold}`,
  background: STAGE.accentGold,
  color: INK.deepInk,
  boxShadow: STAGE.glowGold,
} as const;

const secondaryButton = {
  ...baseButton,
  border: `1.5px solid ${INK.gold}`,
  background: 'transparent',
  color: STAGE.accentGold,
} as const;

const comingSoonButton = {
  ...baseButton,
  position: 'relative',
  border: `1.5px dashed ${INK.agedLine}`,
  background: 'transparent',
  color: STAGE.textOnFelt,
  opacity: 0.7,
  cursor: 'default',
} as const;

const comingSoonStamp = {
  position: 'absolute',
  top: 6,
  right: 8,
  transform: 'rotate(-8deg)',
  border: `1px solid ${INK.stampRed}`,
  color: INK.stampRed,
  fontFamily: FONT.mono,
  fontSize: 8,
  fontWeight: 700,
  padding: '1px 4px',
  borderRadius: 3,
  letterSpacing: '0.1em',
} as const;

const setupCardStyle = {
  width: '100%',
  maxWidth: 320,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 18,
  borderRadius: 14,
  border: `1.5px solid ${INK.agedLine}`,
  background: INK.ledgerSlip,
  color: INK.deepInk,
  boxShadow: SHADOW.ledgerSlip,
} as const;

const setupHeading = { fontFamily: FONT.display, fontWeight: 700, fontSize: 18, color: INK.deepInk } as const;
const setupRowLabel = { fontFamily: FONT.serif, fontSize: 13, color: INK.mutedBrown, marginTop: 4 } as const;
// S6e: the difficulty explainer + expected-win-share lines — quiet ledger ink, not a shouty callout.
const setupBlurb = { fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 12, color: INK.mutedBrown, marginTop: 2 } as const;
const setupShare = { fontFamily: FONT.serif, fontSize: 12, color: INK.deepInk, lineHeight: 1.25 } as const;
const segmentRow = { display: 'flex', gap: 8 } as const;

function segmentButton(active: boolean) {
  return {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    border: `1.5px solid ${active ? INK.gold : INK.agedLine}`,
    background: active ? STAGE.accentGold : 'transparent',
    color: INK.deepInk,
  } as const;
}

const linkButton = {
  border: 'none',
  background: 'transparent',
  color: INK.mutedBrown,
  fontFamily: FONT.serif,
  fontSize: 13,
  cursor: 'pointer',
  minHeight: 36,
} as const;

const ribbonStyle = {
  border: `1px solid ${INK.gold}`,
  borderRadius: 999,
  background: STAGE.scrimSheet,
  color: STAGE.accentGold,
  fontFamily: FONT.serif,
  fontSize: 13,
  padding: '8px 16px',
  cursor: 'pointer',
} as const;

// U3: the first-visit tutorial invitation card — quiet, offered once, easy to decline.
const offerCardStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderRadius: 12,
  border: `1px solid ${INK.gold}`,
  background: STAGE.scrimSheet,
} as const;
const offerTextStyle = {
  fontFamily: FONT.serif,
  fontSize: 13,
  color: STAGE.accentGold,
} as const;
const offerWatchStyle = {
  minHeight: 38,
  padding: '6px 16px',
  borderRadius: 999,
  border: `2px solid ${INK.gold}`,
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 13,
} as const;
const offerLaterStyle = {
  minHeight: 38,
  padding: '6px 14px',
  borderRadius: 999,
  border: `1px solid ${INK.agedLine}`,
  background: 'transparent',
  color: STAGE.textOnFelt,
  fontFamily: FONT.serif,
  fontSize: 13,
} as const;
