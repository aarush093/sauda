/**
 * The Table screen. It renders the play table for the revealed player and overlays the
 * response surfaces the engine calls for: the payment sheet (a charge on me), the NAHI
 * CHALEGA prompt (an action I can counter), the received-wildcard chooser, and the
 * pass-and-play hand-off. Two small effects run the game's automatic beats:
 *   - bot turns step on a timer;
 *   - L4 auto-draw fires at my turn start; L1 auto-resolves (D2 auto-allow, C4 zero-pay)
 *     run after a ~500 ms beat with a ticker line — nothing resolves silently.
 *
 * Everything actionable is `legalActions(state, actor)`; every move is `dispatch`
 * (== reduce). No rule is decided here — the screen routes the engine's offer to the
 * right surface. Turn plays live on the Board itself (drag / tap → stage → rail, A10).
 */
import { useEffect, useRef, useState } from 'react';
import { SETS, isSetComplete, legalActions, observe } from '@sauda/engine';
import type { Action, GameEvent, GameState, PropertyGroup, SetId } from '@sauda/engine';
import { actorOf, useGame, viewSeat } from '../game/store';
import type { SeatConfig } from '../game/store';
import { useViewport } from '../game/viewport';
import { paymentDetails } from '../game/paymentModel';
import { botBeatDelayMs, zeroPayableResponse } from '../game/interaction';
import { describeThreat, shortLabel, stagePlayFromEvents } from '../game/labels';
import { Board } from './Board';
import { CoachMark } from './CoachMark';
import { useCoachMark } from '../game/useCoachMark';
import { tipsEnabled, setTipsEnabled, resetTips } from '../shell/tips';
import { Surface } from './Surface';
import { PaymentSheet } from './PaymentSheet';
import { InterruptPrompt } from './InterruptPrompt';
import { HandoffOverlay } from './HandoffOverlay';
import { EndOverlay } from './EndOverlay';
import { PauseSheet } from './PauseSheet';
import { Book } from '../shell/Book';
import { STAGE, INK, FONT, LAYERS } from '../design/tokens';

const ALL_SETS = Object.keys(SETS) as SetId[];

// The seat's name for the end title (name only — difficulty is a setup concern, F5).
function seatLabel(seats: SeatConfig[], id: number): string {
  return seats[id]?.kind === 'bot' ? `Bot ${id}` : `Player ${id}`;
}

// The winner's completed sets (the three that won them the game) as real groups, for the end
// panel's card cascades (F6 · G4).
function completedSets(state: GameState, player: number): { set: SetId; group: PropertyGroup }[] {
  const out: { set: SetId; group: PropertyGroup }[] = [];
  for (const set of ALL_SETS) {
    const group = state.players[player]!.properties[set].find((candidate) => isSetComplete(candidate));
    if (group) {
      out.push({ set, group });
    }
  }
  return out;
}

const BEAT_MS = 500; // L1: the pause before an auto-resolve so the player reads it
const HUMAN_PLAY_BEAT_MS = 800; // F4: how long the human's just-played card is held on centre stage

// A move the UI plays for the human because there is nothing to decide (|legalActions|==1):
// D2 auto-allow (no counter in hand) or C4 (nothing to pay with). Shown as a brief beat.
interface AutoResolve {
  action: Action;
  note: string;
}

// The last card `player` just placed / built / banked / played — OR received (G6: an auto-placed
// card that arrived to them) — held on centre stage so it is SEEN, not just read as a ticker line
// (§8/I1 · F4). Newest matching card wins.
function lastPlayedCard(events: GameEvent[], player: number): string | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]!;
    if (
      (event.type === 'ActionPlayed' ||
        event.type === 'CardBanked' ||
        event.type === 'PropertyPlaced' ||
        event.type === 'BuildingPlaced' ||
        event.type === 'CardReceived') &&
      event.player === player
    ) {
      return event.cardId;
    }
  }
  return null;
}

export function Table() {
  const state = useGame((store) => store.state);
  const seats = useGame((store) => store.seats);
  const revealedSeat = useGame((store) => store.revealedSeat);
  const handoffSeat = useGame((store) => store.handoffSeat);
  const log = useGame((store) => store.log);
  const lastEvents = useGame((store) => store.lastEvents);
  const dispatch = useGame((store) => store.dispatch);
  const stepBot = useGame((store) => store.stepBot);
  const ackHandoff = useGame((store) => store.ackHandoff);
  const reset = useGame((store) => store.reset);

  // U1: the LIVE measured viewport — the shell is sized from this, not from static 100dvh/100vw, so
  // the play surface fits the rectangle that ACTUALLY exists on iOS Safari (URL bar / tab strip already
  // subtracted) and re-fits the instant that chrome shows or hides.
  const viewport = useViewport();

  // W1: orientation is handled ONCE at the app root — in portrait the whole tree is swapped for the
  // rotate screen (App.tsx), so the Table only ever renders in landscape and needs no portrait branch.

  // P8 in-game nav (K8): the pause sheet. While `paused`, every automatic beat below is frozen (bot
  // timer, auto-draw, auto-resolve) and the turn token's auto-end drain is held (paused prop → Board),
  // so nothing advances behind the sheet. `showBook` opens Niyam OVER the paused game.
  const [paused, setPaused] = useState(false);
  const [showBook, setShowBook] = useState(false);

  // W2: just-in-time onboarding. One coach mark at a time teaches each mechanic the first time it is
  // available in the player's OWN game — driven purely off legalActions (useCoachMark + onboarding.ts),
  // never a script. `tipsOn` is the Show-tips switch (toggled here from the pause sheet); `coachChapter`
  // holds a Book chapter opened from a coach's Niyam link (over the game, no route change — closing
  // returns to exactly this game). The hook is called every render (state may be null pre-deal); its
  // inputs are gated so a coach only appears on the human's own turn/response, tips on, not paused.
  const [tipsOn, setTipsOn] = useState(() => tipsEnabled());
  const [coachChapter, setCoachChapter] = useState<number | null>(null);
  const [tipsResetToken, setTipsResetToken] = useState(0);
  const coachActor = state ? actorOf(state) : -1;
  const coachIsHumanMoment = state !== null && state.phase !== 'gameOver' && seats[coachActor]?.kind === 'human';
  const coachEnabled = tipsOn && coachIsHumanMoment && handoffSeat === null && !paused;
  const coachObservation = coachEnabled && state ? observe(state, coachActor) : null;
  const coachActions = coachEnabled && state ? legalActions(state, coachActor) : [];
  const { coach, dismiss: dismissCoach } = useCoachMark({
    state,
    observation: coachObservation,
    actions: coachActions,
    enabled: coachEnabled,
    resetToken: tipsResetToken,
  });
  function toggleTips() {
    setTipsOn((on) => {
      const next = !on;
      setTipsEnabled(next); // persist the switch
      return next;
    });
  }
  function resetTipsNow() {
    resetTips();
    setTipsResetToken((token) => token + 1); // reload the hook's in-memory taught set → all teach again
  }

  // Drive bot turns one step at a time; each step updates state and re-runs this. H5: the delay is
  // PACED — the first beat of a bot's turn holds longest, later beats are quicker, trimming toward a
  // floor near the ~3s cap so a long turn never drags. `botBeat` tracks the beat index + elapsed
  // within the current bot's turn and resets whenever control leaves this bot (a human turn, or a
  // different bot); the count advances in the timer callback, so it ticks once per real beat.
  const botBeat = useRef({ actor: -1, beats: 0, elapsed: 0 });
  useEffect(() => {
    if (!state || state.phase === 'gameOver' || handoffSeat !== null || paused) {
      return; // P8: a paused game steps no bot
    }
    // Capture freeze (dev only): while the Playwright pipeline holds a recorded frame, don't
    // step the bot. `import.meta.env.DEV` folds to false in prod, so this guard — and the two
    // like it below — are dead-code-eliminated from the shipped bundle (bundle stays identical).
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return;
    }
    const actor = actorOf(state);
    if (seats[actor]?.kind !== 'bot') {
      botBeat.current.actor = -1; // control is with a human / nobody — the next bot turn starts fresh
      return;
    }
    if (botBeat.current.actor !== actor) {
      botBeat.current = { actor, beats: 0, elapsed: 0 }; // a new bot turn — reset the beat run
    }
    const delay = botBeatDelayMs(botBeat.current.beats, botBeat.current.elapsed);
    const timer = setTimeout(() => {
      botBeat.current.beats += 1;
      botBeat.current.elapsed += delay;
      stepBot();
    }, delay);
    return () => clearTimeout(timer);
  }, [state, handoffSeat, seats, stepBot, paused]);

  // Compute the automatic beats for the human holding the device. Done before the early
  // return so hook order is stable; stashed in refs so the effects (keyed on `state`) read
  // the fresh values and re-run once per applied action — which lets NAHI chains advance.
  let autoDraw = false;
  let autoResolve: AutoResolve | null = null;
  if (state && state.phase !== 'gameOver' && handoffSeat === null) {
    const openActor = actorOf(state);
    if (seats[openActor]?.kind === 'human') {
      const open = legalActions(state, openActor);
      const openObservation = observe(state, openActor);
      if (state.phase === 'awaitingDraw' && open.some((action) => action.type === 'DRAW')) {
        autoDraw = true; // L4: draw is automatic at turn start
      }
      const canAllow = open.some((action) => action.type === 'RESPOND_ALLOW');
      const canNahi = open.some((action) => action.type === 'RESPOND_NAHI_CHALEGA');
      if (canAllow && !canNahi && openObservation.interrupt) {
        // D2: an action landed on me that I cannot counter — no prompt, just allow it.
        autoResolve = { action: { type: 'RESPOND_ALLOW' }, note: `${describeThreat(openObservation.interrupt)} No counter — allowed.` };
      } else {
        const details = paymentDetails(openObservation);
        const emptyPay = details ? zeroPayableResponse(open, details.payable.length) : null;
        if (emptyPay) {
          autoResolve = { action: emptyPay, note: 'Nothing to pay with.' }; // C4
        }
      }
    }
  }
  // K3 (supersedes F2): the turn no longer auto-ends from HERE. The TURN TOKEN in my row owns the
  // end of turn — its ~2.5s draining ring dispatches END_TURN once every play is spent (pausable by a
  // rearrange, tappable to end now), and it also carries the early end and the SAUDA! declare. So
  // there is no "turn over" beat here any more; ending still flows into the discard step (hand > 7).

  const autoDrawRef = useRef(false);
  autoDrawRef.current = autoDraw;
  const autoResolveRef = useRef<AutoResolve | null>(null);
  autoResolveRef.current = autoResolve;

  // L4: auto-draw. Keyed on `state` so it re-checks after every applied action, and reduce
  // rejects a stray second DRAW (wrong phase), so it fires exactly once per awaitingDraw.
  useEffect(() => {
    if (paused) {
      return; // P8: hold auto-draw while the pause sheet is open
    }
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return; // capture freeze (dev only) — see the bot-step effect above
    }
    if (autoDrawRef.current) {
      dispatch({ type: 'DRAW' });
    }
  }, [state, dispatch, paused]);

  // L1: auto-resolve after a beat. Keyed on `state` so a NAHI chain (allow → allow → …)
  // schedules the next beat once the previous one applied.
  useEffect(() => {
    const pending = autoResolveRef.current;
    if (!pending) {
      return;
    }
    if (paused) {
      return; // P8: hold the auto-resolve beat while the pause sheet is open
    }
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return; // capture freeze (dev only) — hold the beat so it can be shot (e.g. C4 zero-pay)
    }
    const timer = setTimeout(() => dispatch(pending.action), BEAT_MS);
    return () => clearTimeout(timer);
  }, [state, dispatch, paused]);

  // F4: flash the human's just-played card on centre stage for a beat, so their play is SEEN the
  // same way a bot's is held (I1). A bot holds its card for the whole ~700ms step; the human is
  // still playing, so theirs clears after a short beat.
  const [humanPlayCardId, setHumanPlayCardId] = useState<string | null>(null);
  useEffect(() => {
    if (!state || handoffSeat !== null) {
      return;
    }
    const turnActor = actorOf(state);
    if (seats[turnActor]?.kind !== 'human') {
      return;
    }
    const played = lastPlayedCard(lastEvents, turnActor);
    if (played === null) {
      return;
    }
    setHumanPlayCardId(played);
    if (import.meta.env.DEV && (globalThis as { __saudaCapturePaused?: boolean }).__saudaCapturePaused) {
      return; // capture freeze (dev only) — hold the play beat so it can be shot
    }
    const timer = setTimeout(() => setHumanPlayCardId(null), HUMAN_PLAY_BEAT_MS);
    return () => clearTimeout(timer);
  }, [lastEvents, state, seats, handoffSeat]);

  if (!state) {
    return null;
  }

  const actor = actorOf(state);
  const view = viewSeat({ revealedSeat, seats });
  const observation = observe(state, view);
  const actorObservation = observe(state, actor); // the acting human's own view
  const isBotTurn = seats[actor]?.kind === 'bot';
  const gameOver = state.phase === 'gameOver';
  const tickerLines = log.slice(-2).map((line) => line.text);
  // Spotlight the acting bot's last card on centre stage so its turn is watchable (I1); on my own
  // turn, the transient human-play beat (above) fills the same slot (F4).
  const botSpotlightCardId = isBotTurn && handoffSeat === null ? lastPlayedCard(lastEvents, actor) : null;
  const spotlightCardId = botSpotlightCardId ?? humanPlayCardId;

  // R2: the spectate stage CAPTION — a short "B2 · <what they did>" beside the acting bot's spotlit
  // card (the hidden-text-bug fix). Only on a bot's turn; targetsMe is set from the live interrupt the
  // bot's play opened against me (origin = the actor, target = my view), so an action aimed at me reads
  // "… → You". stagePlayFromEvents + shortLabel are UI-layer copy (the engine is untouched).
  let spotlightCaption: string | null = null;
  if (botSpotlightCardId !== null) {
    const stagePlay = stagePlayFromEvents(lastEvents, actor);
    if (stagePlay) {
      const targetsMe =
        observation.interrupt !== null &&
        observation.interrupt.origin === actor &&
        observation.interrupt.target === observation.me;
      spotlightCaption = shortLabel(stagePlay.cardId, { ...stagePlay.play, targetsMe });
    }
  }

  // The human actor's legal moves (empty on a bot's turn / at game over). Turn plays feed
  // the board's drag/tap→stage→rail; the RESPOND_* moves each raise their own surface.
  const humanActions = !isBotTurn && !gameOver ? legalActions(state, actor) : [];
  const isResponse = humanActions.some((action) => action.type.startsWith('RESPOND_'));
  const payAction = humanActions.find((action) => action.type === 'RESPOND_PAY');
  const nahiAction = humanActions.find((action) => action.type === 'RESPOND_NAHI_CHALEGA');
  const receiveOptions = humanActions.filter(
    (action): action is Extract<Action, { type: 'RESPOND_PLACE_RECEIVED' }> =>
      action.type === 'RESPOND_PLACE_RECEIVED',
  );
  const receiveHead = receiveOptions[0];
  // G6: a received wildcard awaiting placement (C7) lands ON THE BOARD stage — its legal sets glow,
  // I drag it home (or tap a set). One at a time: the engine offers only the head card's options.
  const receive =
    handoffSeat === null && receiveHead
      ? {
          cardId: receiveHead.cardId,
          bySet: new Map<SetId, Action>(receiveOptions.map((option) => [option.set, option])),
          onPlace: dispatch,
        }
      : null;
  // C4 opens no sheet — the beat auto-submits it. The sheet renders only with real cards.
  const showPaymentSheet = payAction?.type === 'RESPOND_PAY' && autoResolve === null;

  return (
    <div
      className="table"
      style={{ ...shellStyle, top: viewport.offsetTop, height: viewport.height, width: viewport.width, display: 'flex', flexDirection: 'column' }}
    >
      {/* the board fills the whole measured shell (landscape-only, W1). The response overlays below are
          fixed, so they sit outside this flow. */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Board
          observation={observation}
          seats={seats}
          actions={isResponse ? [] : humanActions}
          onAct={dispatch}
          tickerLines={tickerLines}
          spotlightCardId={spotlightCardId}
          spotlightFromOpponent={botSpotlightCardId !== null}
          spotlightCaption={spotlightCaption}
          receive={receive}
          paused={paused}
        />
      </div>

      {/* P8 in-game nav: the top-left home glyph → the pause sheet. Hidden during a hand-off (the
          device is being passed) and at game over (the end panel owns the screen). */}
      {handoffSeat === null && !gameOver && (
        <button aria-label="Pause — game menu" style={homeGlyphStyle} onClick={() => setPaused(true)}>
          ⌂
        </button>
      )}

      {/* the pause sheet + Niyam-over-paused. The Book sits above the sheet (rendered after it). */}
      {paused && !showBook && (
        <PauseSheet
          onResume={() => setPaused(false)}
          onNiyam={() => setShowBook(true)}
          onHome={() => {
            reset();
            if (typeof window !== 'undefined') {
              window.location.hash = '#/';
            }
          }}
          tipsOn={tipsOn}
          onToggleTips={toggleTips}
          onResetTips={resetTipsNow}
        />
      )}
      {paused && showBook && <Book onClose={() => setShowBook(false)} />}

      {/* F6: any game end presents the full-screen end overlay (fixed, so it never grows the page
          the way the old in-flow winner strip did). Board sleeps behind the scrim. */}
      {gameOver && state.winnerIndex !== null && (
        <EndOverlay
          title={seats[state.winnerIndex]?.kind === 'human' ? 'SAUDA!' : `${seatLabel(seats, state.winnerIndex)} wins`}
          sets={completedSets(state, state.winnerIndex).slice(0, 3)}
          onNewGame={reset}
        />
      )}

      {/* L1: a brief non-interactive beat while the game auto-resolves a no-choice window. */}
      {autoResolve && (
        <div style={beatOverlayStyle}>
          <Surface style={beatNoteStyle}>{autoResolve.note}</Surface>
        </div>
      )}


      {/* a standing charge raises the payment sheet over the table (INTERACTION_SPEC §6).
          Private response UI waits until any pass-and-play hand-off is acked (E2). */}
      {handoffSeat === null && showPaymentSheet && payAction?.type === 'RESPOND_PAY' && (
        <PaymentSheet
          observation={actorObservation}
          seats={seats}
          onPay={(cardIds) => dispatch({ type: 'RESPOND_PAY', cardIds })}
        />
      )}

      {/* D1: the NAHI CHALEGA window opens ONLY when I actually hold the counter. With only
          Allow legal there is no choice — the L1 beat above resolves it (D2), no prompt. */}
      {handoffSeat === null && nahiAction?.type === 'RESPOND_NAHI_CHALEGA' && actorObservation.interrupt && (
        <InterruptPrompt
          interrupt={actorObservation.interrupt}
          canNahi
          onNahi={() => dispatch(nahiAction)}
          onAllow={() => dispatch({ type: 'RESPOND_ALLOW' })}
        />
      )}

      {/* C7 (G6): a wildcard reached me as payment — it now lands ON the board stage with its legal
          sets glowing (see the Board `receive` prop), so there is no separate chooser overlay. */}

      {handoffSeat !== null && <HandoffOverlay seat={handoffSeat} onReady={ackHandoff} />}

      {/* W2: the just-in-time coach mark — one at a time, over the player's own game, board still live
          behind it (no scrim, never blocks the move). Hidden while its Book chapter is open. */}
      {coach && coachChapter === null && (
        <CoachMark coach={coach} onDismiss={dismissCoach} onOpenNiyam={(chapter) => setCoachChapter(chapter)} />
      )}
      {/* the Book chapter a coach's Niyam link opened — OVER the game, no route change; closing returns to
          exactly this game state, and the coach reappears (its `active` never cleared by opening a book). */}
      {coachChapter !== null && <Book initialChapter={coachChapter} onClose={() => setCoachChapter(null)} />}
    </div>
  );
}

// P1 + U1: the app shell. Fixed at the top-left of the LAYOUT viewport, then sized in JS to the LIVE
// visualViewport box (top / height / width injected at the call site) — not 100dvh/100vw, which iOS
// Safari reports unreliably and which let the hand cards fall under the URL bar (the iPhone 12 clip).
// Anchored top-left (not inset:0) so the injected height/width actually govern the box. Padded by the
// safe-area insets (in landscape the notch inset sits on the SIDE), and locked down: overscroll-
// behavior none kills pull-to-refresh, touch-action manipulation kills the double-tap zoom, overflow
// hidden means the page can never scroll. The felt fills the measured box edge to edge — no void.
const shellStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
  paddingRight: 'env(safe-area-inset-right, 0px)',
  background: STAGE.felt,
  color: STAGE.textOnFelt,
  overflow: 'hidden',
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
} as const;

// P8: the in-game home glyph — top-left, over the board (LAYERS.nav), clear of the safe-area inset.
const homeGlyphStyle = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 6px)',
  left: 'calc(env(safe-area-inset-left, 0px) + 6px)',
  zIndex: LAYERS.nav,
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: `1.5px solid ${INK.gold}`,
  background: STAGE.scrimSheet,
  color: STAGE.accentGold,
  fontSize: 17,
  lineHeight: '30px',
  textAlign: 'center',
  cursor: 'pointer',
} as const;

const beatOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: LAYERS.surface,
  background: STAGE.scrimDrag,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
} as const;
const beatNoteStyle = {
  background: STAGE.cardCream,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  padding: '10px 18px',
  borderRadius: 999,
  boxShadow: STAGE.glowGold,
  maxWidth: '80vw',
  textAlign: 'center',
} as const;
