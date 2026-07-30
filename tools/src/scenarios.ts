/**
 * DETERMINISTIC SCENARIO HARNESS (dev-only, never shipped in the app bundle).
 *
 * The engine is seeded (mulberry32), so a game is a pure function of its seed. This harness
 * searches seeds by simulating whole games with the existing bots and finds the first seed +
 * turn that reaches each target play-state we want to see in the UI (D1 counter, a payment
 * sheet, discard mode, a wild LAGAAN, a declarable win, …).
 *
 * WHY it records the full action log, not just seed+turn: the capture route (dev frame) has
 * to *land the real UI exactly on that state*. Re-simulating to "turn N" is ambiguous (a turn
 * is many steps); the action log is the precise, replayable bridge — dispatch it into the
 * store and the surface renders. reduce is deterministic for a fixed seed, so the same log
 * always reproduces the same state, in any future session.
 *
 * It NEVER hand-crafts engine state: every state is reached by real, legal play. Seat 0 is
 * "the human"; for states a strong bot would never wander into (hoarding 11 cards) seat 0
 * uses a documented alternative *legal* policy (hoard = draw + end, never play) — still real
 * play a human could choose, never a faked state.
 */
import { buildDeck, createGame, legalActions, observe, reduce, mulberry32 } from '@sauda/engine';
import type { Action, Card, GameEvent, GameState, Observation, Rng } from '@sauda/engine';
import { HeuristicBot } from '@sauda/bots';

const HUMAN = 0; // the seat we treat as the human when we search + capture
const SEAT_COUNT = 4; // 1 human + 3 bots, matching the dev autostart frame
const MAX_TURNS = 400;
const MAX_STEPS = 40_000;

// The deck is immutable, so a static lookup of each card's kind/colours/value is enough —
// we never need live state to know "is this the wild LAGAAN" or "what is this money worth".
const CARD: Map<string, Card> = new Map(buildDeck().map((card) => [card.id, card]));

// One found state: the seed, the turn it appears on, and the exact log to replay to it.
export interface ScenarioHit {
  seed: number;
  turn: number;
  actions: Action[];
  note: string;
}
export type ScenarioOutcome = (ScenarioHit & { found: true }) | { found: false; searched: number };

// A seeker policy drives SEAT 0 during the search. Seats 1–3 always use the real bot.
type SeekerPolicy = 'bot' | 'hoard';

interface ScenarioDef {
  id: string; // stable key, tagged with its S-number
  policy: SeekerPolicy;
  detect: (probe: Probe) => boolean;
  note: string;
}

// Everything a predicate may inspect at one state snapshot: the raw state, seat 0's current
// legal moves + view (non-empty only when it is seat 0's decision), and the events that just
// fired (for transient things like a NAHI chain).
interface Probe {
  state: GameState;
  legal0: Action[];
  view0: Observation;
  events: GameEvent[];
}

// Whose move is it: the interrupt responder if a window is open, else the turn player.
function actorOf(state: GameState): number {
  if (state.pendingInterrupts.length > 0) {
    return state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder;
  }
  return state.currentPlayerIndex;
}

function playsAction(legal: Action[], name: string): boolean {
  return legal.some((a) => a.type === 'PLAY_ACTION' && a.params.action === name);
}

// Value a seat could pay from its BANK alone (money + banked actions) — paying from the bank
// never breaks a property set, which is exactly the C1/C3 "pay without breaking a set" case.
function bankValue(state: GameState, seat: number): number {
  let total = 0;
  for (const id of state.players[seat]!.bank) {
    total += CARD.get(id)?.value ?? 0;
  }
  return total;
}

function propertyCardCount(state: GameState, seat: number): number {
  let count = 0;
  for (const groups of Object.values(state.players[seat]!.properties)) {
    for (const group of groups) {
      count += group.cards.length;
    }
  }
  return count;
}

// A legal PLAY_KIRAYA whose card is the wild (ANY) LAGAAN — the colour-choice + target case.
function playsWildKiraya(legal: Action[]): boolean {
  return legal.some((a) => {
    if (a.type !== 'PLAY_KIRAYA') return false;
    const card = CARD.get(a.cardId);
    return card !== undefined && card.kind === 'kiraya' && card.colors === 'ANY';
  });
}

// A legal PLAY_KIRAYA carrying at least `n` attached DUGNA cards (x2 at n=1, x4 at n=2).
function playsKirayaWithDugna(legal: Action[], n: number): boolean {
  return legal.some((a) => a.type === 'PLAY_KIRAYA' && a.dugnaCardIds.length >= n);
}

// The 11 target states (a few split into sub-captures where the spec names two moves).
const SCENARIOS: ScenarioDef[] = [
  { id: 'S1_nahi_hold', policy: 'bot', note: 'D1: a bot attacks me and I hold NAHI CHALEGA',
    detect: ({ legal0 }) => legal0.some((a) => a.type === 'RESPOND_NAHI_CHALEGA') },
  { id: 'S2_nahi_chain', policy: 'bot', note: 'D3: a NAHI chain — attack, counter, counter',
    detect: ({ events }) => events.some((e) => e.type === 'NahiChalegaPlayed' && e.chainLength >= 2) },
  { id: 'S3_pay_from_bank', policy: 'bot', note: 'C1/C3: charged, and my bank covers it without breaking a set',
    detect: ({ state, legal0, view0 }) =>
      legal0.some((a) => a.type === 'RESPOND_PAY') &&
      view0.interrupt?.effect.kind === 'charge' &&
      view0.interrupt.effect.amount > 0 &&
      bankValue(state, HUMAN) >= view0.interrupt.effect.amount },
  { id: 'S4_zero_payable', policy: 'bot', note: 'C4: charged with an empty table — zero payable',
    detect: ({ state, legal0 }) =>
      legal0.some((a) => a.type === 'RESPOND_PAY') &&
      bankValue(state, HUMAN) === 0 &&
      propertyCardCount(state, HUMAN) === 0 },
  { id: 'S5_discard_mode', policy: 'hoard', note: 'A8/A9: I end a turn over 7 cards — discard mode',
    detect: ({ state }) => state.phase === 'awaitingDiscard' && state.currentPlayerIndex === HUMAN },
  { id: 'S6_makaan', policy: 'bot', note: 'B19: I can legally play MAKAAN on my complete set',
    detect: ({ legal0 }) => playsAction(legal0, 'makaan') },
  { id: 'S6_haveli', policy: 'bot', note: 'B19: I can legally play HAVELI on a set that has a MAKAAN',
    detect: ({ legal0 }) => playsAction(legal0, 'haveli') },
  { id: 'S7_wild_lagaan', policy: 'bot', note: 'B14: I can play a wild LAGAAN (colour + target)',
    detect: ({ legal0 }) => playsWildKiraya(legal0) },
  { id: 'S8_dugna_x2', policy: 'bot', note: 'B15: I can attach one DUGNA to a LAGAAN (x2)',
    detect: ({ legal0 }) => playsKirayaWithDugna(legal0, 1) },
  { id: 'S8_dugna_x4', policy: 'bot', note: 'B15: I can attach two DUGNA to a LAGAAN (x4)',
    detect: ({ legal0 }) => playsKirayaWithDugna(legal0, 2) },
  { id: 'S9_adla_badli', policy: 'bot', note: 'ADLA-BADLI is legal (two-dimension pick)',
    detect: ({ legal0 }) => playsAction(legal0, 'adlaBadli') },
  { id: 'S9_kabza', policy: 'bot', note: 'KABZA is legal against a complete opponent set',
    detect: ({ legal0 }) => playsAction(legal0, 'kabza') },
  { id: 'S10_eleven_cards', policy: 'hoard', note: 'Hand-fan stress: I hold 11 cards at once',
    detect: ({ state }) => state.players[HUMAN]!.hand.length >= 11 },
  { id: 'S11_declare_win', policy: 'bot', note: 'A11: I reach a declarable SAUDA win',
    detect: ({ legal0 }) => legal0.some((a) => a.type === 'DECLARE_WIN') },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);

// Seat 0's move under a seeker policy. `hoard` accumulates cards (draw, then end the turn,
// never play) so we can reach the >7-card / 11-card states a strong bot never would; it still
// responds and discards legally (it just never spends a play). Everything else is the bot.
function seat0Move(policy: SeekerPolicy, view: Observation, legal: Action[], rng: Rng, bot: HeuristicBot): Action {
  if (policy === 'hoard') {
    // AAGE BADHO draws two more with no downside to a hoarder, so the hand can pass the
    // 7-limit+2-draw ceiling of 9 and reach 11 (the hand-fan overflow stress, S10).
    const aageBadho = legal.find((a) => a.type === 'PLAY_ACTION' && a.params.action === 'aageBadho');
    if (aageBadho) return aageBadho;
    const draw = legal.find((a) => a.type === 'DRAW');
    if (draw) return draw;
    const endTurn = legal.find((a) => a.type === 'END_TURN');
    if (endTurn && view.phase === 'playing') return endTurn; // otherwise hold the hand, spend no play
  }
  return bot.chooseAction(view, legal, rng);
}

// Simulate one seeded game with the given seat-0 policy, calling `visit` at every state
// snapshot with the growing action log. Stops early when `visit` returns true (all wanted
// states seen). Returns nothing — hits are collected by the caller through the closure.
function simulateGame(seed: number, policy: SeekerPolicy, visit: (probe: Probe, log: Action[]) => boolean): void {
  const created = createGame({ players: SEAT_COUNT, seed });
  let state = created.state;
  const rng = mulberry32(seed);
  const bot = new HeuristicBot('medium');
  const log: Action[] = [];

  const probeAt = (events: GameEvent[]): boolean => {
    const legal0 = legalActions(state, HUMAN);
    // observe is only needed for the payment-debt predicate; compute it once per snapshot.
    const view0 = observe(state, HUMAN);
    return visit({ state, legal0, view0, events }, log);
  };

  if (probeAt(created.events)) return;

  let steps = 0;
  while (state.phase !== 'gameOver' && state.turnCount <= MAX_TURNS && steps < MAX_STEPS) {
    const actor = actorOf(state);
    const legal = legalActions(state, actor);
    if (legal.length === 0) break;
    const view = observe(state, actor);
    const action = actor === HUMAN ? seat0Move(policy, view, legal, rng, bot) : bot.chooseAction(view, legal, rng);
    const result = reduce(state, action);
    if (!result.ok) break;
    state = result.value.state;
    log.push(action);
    if (probeAt(result.value.events)) return;
    steps += 1;
  }
}

// Search seeds 1..maxSeed for every target state, returning the first seed+turn (and the log)
// that reaches each. States are grouped by seeker policy so each policy scans once per seed.
export function searchScenarios(maxSeed: number): Record<string, ScenarioOutcome> {
  const results: Record<string, ScenarioOutcome> = {};
  for (const policy of ['bot', 'hoard'] as SeekerPolicy[]) {
    const wanted = SCENARIOS.filter((s) => s.policy === policy);
    const remaining = new Map(wanted.map((s) => [s.id, s] as const));

    for (let seed = 1; seed <= maxSeed && remaining.size > 0; seed++) {
      simulateGame(seed, policy, (probe, log) => {
        for (const [id, def] of remaining) {
          if (def.detect(probe)) {
            results[id] = { found: true, seed, turn: probe.state.turnCount, actions: [...log], note: def.note };
            remaining.delete(id);
          }
        }
        return remaining.size === 0;
      });
    }
    for (const [id, def] of remaining) {
      results[id] = { found: false, searched: maxSeed };
      void def;
    }
  }
  return results;
}

// Replay a recorded action log from a fresh seeded game (the same thing the capture route
// does through the store) and report the final decision snapshot — used to prove a fixture
// entry still lands on its state.
function replay(seed: number, actions: Action[]): { ok: boolean; probe: Probe } {
  const created = createGame({ players: SEAT_COUNT, seed });
  let state = created.state;
  let events = created.events;
  let ok = true;
  for (const action of actions) {
    const result = reduce(state, action);
    if (!result.ok) {
      ok = false;
      break;
    }
    state = result.value.state;
    events = result.value.events;
  }
  return { ok, probe: { state, legal0: legalActions(state, HUMAN), view0: observe(state, HUMAN), events } };
}

// Does this fixture entry still reach its state? `replayed` = every logged action was legal;
// `matches` = the state's own predicate holds at the end. The scenarios test asserts both.
export function verifyScenario(id: string, seed: number, actions: Action[]): { replayed: boolean; matches: boolean } {
  const def = SCENARIOS.find((s) => s.id === id);
  if (!def) {
    return { replayed: false, matches: false };
  }
  const { ok, probe } = replay(seed, actions);
  return { replayed: ok, matches: ok && def.detect(probe) };
}
