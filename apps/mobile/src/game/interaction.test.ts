/**
 * Unit tests for the interaction reducer (v1.2 A10 · G1 owner playtest 2). Pure logic over
 * synthetic Action lists — no DOM, no engine state. The load-bearing test is COMPLETENESS: for
 * every card category, every engine play the card offers is reachable by SOME drag intent, and an
 * illegal drop produces nothing. Drag is the only commit path from hand now (tap = inspect), so the
 * guarantee that matters is "no legal play is unreachable, and no illegal one is invented" (law L5).
 */
import { describe, it, expect } from 'vitest';
import { SETS } from '@sauda/engine';
import type { Action, CardId, SetId } from '@sauda/engine';
import { actionCardId, cardVerbHint } from './labels';
import {
  assistHintAction,
  autoDrawAction,
  BOT_PACING,
  botBeatDelayMs,
  dropZonesForCard,
  kirayaPlan,
  reachableActionsForCard,
  rearrangeDestinations,
  shouldAutoEndTurn,
  zeroPayableResponse,
} from './interaction';

const ALL_SETS = Object.keys(SETS) as SetId[];

// Stable serialisation so action SETS can be compared regardless of order.
const keyOf = (action: Action): string => JSON.stringify(action);
const sortedKeys = (actions: Action[]): string[] => actions.map(keyOf).sort();

// The engine plays a hand card offers (what both input paths must exactly cover).
const handPlaysFor = (actions: Action[], cardId: CardId): Action[] =>
  actions.filter(
    (action) =>
      actionCardId(action) === cardId &&
      (action.type === 'BANK_CARD' ||
        action.type === 'PLACE_PROPERTY' ||
        action.type === 'PLAY_ACTION' ||
        action.type === 'PLAY_KIRAYA'),
  );

describe('interaction reducer — drop zones', () => {
  it('dual-drop: the same action card yields BANK on the bank zone and PLAY on centre', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: 'act_1', params: { action: 'shagun' } },
      { type: 'BANK_CARD', cardId: 'act_1' },
    ];
    const zones = dropZonesForCard(actions, 'act_1');
    const bank = zones.find((zone) => zone.kind === 'bank');
    const play = zones.find((zone) => zone.kind === 'play');
    expect(bank?.action?.type).toBe('BANK_CARD');
    expect(play?.action?.type).toBe('PLAY_ACTION'); // single candidate → fires on drop
  });

  it('an ANY wildcard yields only set zones — never a bank (or payment) zone', () => {
    const actions: Action[] = ALL_SETS.map((set) => ({ type: 'PLACE_PROPERTY', cardId: 'wild_any', set }));
    const zones = dropZonesForCard(actions, 'wild_any');
    expect(zones.every((zone) => zone.kind === 'set')).toBe(true);
    expect(zones.some((zone) => zone.kind === 'bank')).toBe(false);
    // and nothing reachable is a bank or a payment
    const reachable = reachableActionsForCard(actions, 'wild_any', 0);
    expect(reachable.every((action) => action.type === 'PLACE_PROPERTY')).toBe(true);
  });

  it('a targeted action drops to centre with no concrete action (opens targeting)', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 1 } },
      { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 2 } },
    ];
    const play = dropZonesForCard(actions, 'act_v').find((zone) => zone.kind === 'play');
    expect(play).toBeDefined();
    expect(play?.action).toBeNull(); // two targets → TARGETING, not an immediate commit
  });
});

describe('interaction reducer — DUGNA attaches, never stands alone (L6, B15)', () => {
  it('a DUGNA card in hand has no drop zone of its own', () => {
    // The engine enumerates no play for a lone DUGNA, so no move targets it.
    const actions: Action[] = [{ type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: [] }];
    expect(dropZonesForCard(actions, 'dug_1')).toEqual([]);
  });

  it('the LAGAAN plan exposes ×1/×2/×4 attach chips, capped at two DUGNA', () => {
    const actions: Action[] = [
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: [] },
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: ['dug_1'] },
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'mumbai', target: null, dugnaCardIds: ['dug_1', 'dug_2'] },
    ];
    const plan = kirayaPlan(actions, 'kir_1');
    expect(plan?.dugna.map((option) => option.count)).toEqual([0, 1, 2]);
    expect(plan?.dugna.map((option) => option.label)).toEqual(['×1', '×2', '×4']);
    expect(Math.max(...(plan?.dugna.map((option) => option.count) ?? []))).toBeLessThanOrEqual(2);
  });
});

describe('interaction reducer — rearrange, auto-draw, zero-payable', () => {
  it('rearrange maps a placed wildcard to REARRANGE_WILDCARD (free, no play)', () => {
    const actions: Action[] = [
      { type: 'REARRANGE_WILDCARD', cardId: 'wild_1', toSet: 'mumbai' },
      { type: 'REARRANGE_WILDCARD', cardId: 'wild_1', toSet: 'jaipur' },
    ];
    const destinations = rearrangeDestinations(actions, 'wild_1');
    expect(destinations.map((destination) => destination.set)).toEqual(['mumbai', 'jaipur']);
    expect(destinations.every((destination) => destination.action.type === 'REARRANGE_WILDCARD')).toBe(true);
  });

  it('auto-draw returns DRAW only when it is offered (turn start), never mid-turn', () => {
    expect(autoDrawAction([{ type: 'DRAW' }, { type: 'DECLARE_WIN' }])?.type).toBe('DRAW');
    expect(autoDrawAction([{ type: 'END_TURN' }, { type: 'BANK_CARD', cardId: 'x' }])).toBeNull();
  });

  it('C4: a zero-payable charge auto-submits the empty RESPOND_PAY (no sheet)', () => {
    expect(zeroPayableResponse([{ type: 'RESPOND_PAY', cardIds: [] }], 0)?.type).toBe('RESPOND_PAY');
    // C3 (table can pay something) is NOT auto-resolved — the sheet opens.
    expect(zeroPayableResponse([{ type: 'RESPOND_PAY', cardIds: ['money_1'] }], 1)).toBeNull();
  });
});

describe('interaction reducer — drag completeness (every hand action is drag-reachable, every card category)', () => {
  const scenarios: { name: string; card: CardId; actions: Action[] }[] = [
    { name: 'money', card: 'money_1', actions: [{ type: 'BANK_CARD', cardId: 'money_1' }] },
    { name: 'property', card: 'prop_1', actions: [{ type: 'PLACE_PROPERTY', cardId: 'prop_1', set: 'mumbai' }] },
    {
      name: 'dual wildcard',
      card: 'wild_1',
      actions: [
        { type: 'PLACE_PROPERTY', cardId: 'wild_1', set: 'mumbai' },
        { type: 'PLACE_PROPERTY', cardId: 'wild_1', set: 'jaipur' },
      ],
    },
    { name: 'ANY wildcard', card: 'wild_any', actions: ALL_SETS.map((set) => ({ type: 'PLACE_PROPERTY', cardId: 'wild_any', set })) },
    {
      name: 'untargeted action (SHAGUN) + bank',
      card: 'act_s',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_s', params: { action: 'shagun' } },
        { type: 'BANK_CARD', cardId: 'act_s' },
      ],
    },
    {
      name: 'targeted action (VASOOLI) + bank',
      card: 'act_v',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 1 } },
        { type: 'PLAY_ACTION', cardId: 'act_v', params: { action: 'vasooli', target: 2 } },
        { type: 'BANK_CARD', cardId: 'act_v' },
      ],
    },
    {
      name: 'KABZA (target + set)',
      card: 'act_k',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_k', params: { action: 'kabza', target: 1, set: 'mumbai' } },
        { type: 'PLAY_ACTION', cardId: 'act_k', params: { action: 'kabza', target: 2, set: 'jaipur' } },
        { type: 'BANK_CARD', cardId: 'act_k' },
      ],
    },
    {
      name: 'HAATH KI SAFAI (target + property)',
      card: 'act_h',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_h', params: { action: 'haathKiSafai', target: 1, cardId: 'prop_a' } },
        { type: 'PLAY_ACTION', cardId: 'act_h', params: { action: 'haathKiSafai', target: 1, cardId: 'prop_b' } },
        { type: 'BANK_CARD', cardId: 'act_h' },
      ],
    },
    {
      name: 'ADLA-BADLI (mine × theirs)',
      card: 'act_a',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_a', params: { action: 'adlaBadli', myCardId: 'mine_1', target: 1, theirCardId: 'their_1' } },
        { type: 'PLAY_ACTION', cardId: 'act_a', params: { action: 'adlaBadli', myCardId: 'mine_1', target: 1, theirCardId: 'their_2' } },
        { type: 'PLAY_ACTION', cardId: 'act_a', params: { action: 'adlaBadli', myCardId: 'mine_2', target: 1, theirCardId: 'their_1' } },
      ],
    },
    {
      name: 'MAKAAN build + bank',
      card: 'act_m',
      actions: [
        { type: 'PLAY_ACTION', cardId: 'act_m', params: { action: 'makaan', set: 'mumbai' } },
        { type: 'BANK_CARD', cardId: 'act_m' },
      ],
    },
    {
      name: 'wild LAGAAN (colour × target × dugna) + bank',
      card: 'kir_w',
      actions: [
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'mumbai', target: 1, dugnaCardIds: [] },
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'mumbai', target: 2, dugnaCardIds: [] },
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'mumbai', target: 1, dugnaCardIds: ['dug_1'] },
        { type: 'PLAY_KIRAYA', cardId: 'kir_w', color: 'jaipur', target: 1, dugnaCardIds: [] },
        { type: 'BANK_CARD', cardId: 'kir_w' },
      ],
    },
  ];

  for (const { name, card, actions } of scenarios) {
    it(`${name}: every enumerated hand play is reachable by a drag intent`, () => {
      const legal = sortedKeys(handPlaysFor(actions, card));
      // Drag is the only commit path from hand (G1). Completeness: the set of engine actions the
      // drag layer can reach for this card equals exactly the card's legal plays — nothing missing,
      // nothing invented.
      expect(sortedKeys(reachableActionsForCard(actions, card, 0))).toEqual(legal);
    });
  }

  it('illegal drops produce no engine action (a card the engine offers nothing for)', () => {
    const actions: Action[] = [{ type: 'PLACE_PROPERTY', cardId: 'someone_else', set: 'mumbai' }, { type: 'END_TURN' }];
    expect(dropZonesForCard(actions, 'not_playable')).toEqual([]);
    expect(reachableActionsForCard(actions, 'not_playable', 0)).toEqual([]);
  });
});

// F2 (owner playtest 30 Jul): the turn auto-ends ONLY on the exact [END_TURN] singleton.
describe('shouldAutoEndTurn — auto-end only when nothing else is legal (F2)', () => {
  it('auto-fires when END_TURN is the sole legal move', () => {
    expect(shouldAutoEndTurn([{ type: 'END_TURN' }])).toBe(true);
  });

  it('NEVER fires when a declarable win is also legal', () => {
    expect(shouldAutoEndTurn([{ type: 'DECLARE_WIN' }, { type: 'END_TURN' }])).toBe(false);
  });

  it('NEVER fires when a free wildcard rearrange is also legal', () => {
    const actions: Action[] = [
      { type: 'REARRANGE_WILDCARD', cardId: 'wild_jaipur_kolkata_0', toSet: 'kolkata' },
      { type: 'END_TURN' },
    ];
    expect(shouldAutoEndTurn(actions)).toBe(false);
  });

  it('NEVER fires when a play (e.g. Bank) is still legal', () => {
    const actions: Action[] = [{ type: 'BANK_CARD', cardId: 'money_2_0' }, { type: 'END_TURN' }];
    expect(shouldAutoEndTurn(actions)).toBe(false);
  });

  it('does not fire on an empty or non-END_TURN list', () => {
    expect(shouldAutoEndTurn([])).toBe(false);
    expect(shouldAutoEndTurn([{ type: 'DRAW' }])).toBe(false);
  });
});

// H5 (excellence pass): bot pacing as ONE constant table — first beat longest, later beats quicker,
// trimming toward the floor near the ~3s cap, never below the floor (a card is always seen).
describe('botBeatDelayMs — the bot-turn pacing table (H5)', () => {
  it('the FIRST beat of a bot turn holds longest (P4 raised: 900ms)', () => {
    expect(botBeatDelayMs(0, 0)).toBe(BOT_PACING.firstBeatMs);
    expect(BOT_PACING.firstBeatMs).toBe(900);
  });

  it('subsequent beats run at the quicker beat rate while there is budget (P4: 600ms)', () => {
    expect(botBeatDelayMs(1, 900)).toBe(BOT_PACING.beatMs); // 600
    expect(botBeatDelayMs(2, 1500)).toBe(BOT_PACING.beatMs);
    expect(botBeatDelayMs(3, 2100)).toBe(BOT_PACING.beatMs);
  });

  it('trims evenly toward the floor as the ~4s cap approaches', () => {
    expect(botBeatDelayMs(6, 3500)).toBe(500); // min(600, 4000-3500)
    expect(botBeatDelayMs(7, 3700)).toBe(BOT_PACING.floorMs); // max(400, 4000-3700=300) = 400
  });

  it('never drops below the floor once past the cap — a beat is always long enough to be seen', () => {
    expect(botBeatDelayMs(9, 4000)).toBe(BOT_PACING.floorMs);
    expect(botBeatDelayMs(20, 9000)).toBe(BOT_PACING.floorMs);
    expect(BOT_PACING.floorMs).toBe(400);
  });

  it('is monotonically non-increasing after the first beat, and every beat is watchable', () => {
    let previous = botBeatDelayMs(1, BOT_PACING.firstBeatMs);
    let elapsed = BOT_PACING.firstBeatMs + previous;
    for (let beat = 2; beat < 12; beat++) {
      const delay = botBeatDelayMs(beat, elapsed);
      expect(delay).toBeLessThanOrEqual(previous);
      expect(delay).toBeGreaterThanOrEqual(BOT_PACING.floorMs);
      previous = delay;
      elapsed += delay;
    }
  });

  it('meets the P4 comprehension floors (bots "tooo fast" fix)', () => {
    // These are the owner-tunable floors raised in P4; lock them so a future edit can't quietly
    // speed the bots back up below what reads on a real phone.
    expect(BOT_PACING.firstBeatMs).toBeGreaterThanOrEqual(900);
    expect(BOT_PACING.beatMs).toBeGreaterThanOrEqual(600);
    expect(BOT_PACING.floorMs).toBeGreaterThanOrEqual(400);
    expect(BOT_PACING.turnCapMs).toBeGreaterThanOrEqual(4000);
  });

  it('a typical 5-beat bot turn presents in well under the 4s cap', () => {
    let elapsed = 0;
    for (let beat = 0; beat < 5; beat++) {
      elapsed += botBeatDelayMs(beat, elapsed);
    }
    expect(elapsed).toBe(900 + 600 * 4); // 3300ms — no trim needed
    expect(elapsed).toBeLessThan(BOT_PACING.turnCapMs);
  });
});

// F7 (owner playtest 30 Jul): the rail teaches WHY a card's verb is absent, and the two
// cross-kind drops the owner tried produce no engine action.
describe('cardVerbHint — the six teachable why-lines (F7)', () => {
  const hintFor = (id: string) => cardVerbHint(id)?.reason ?? null;

  it('maps each build/play/charge card to its reason', () => {
    expect(cardVerbHint('action_makaan_0')).toEqual({ verbKey: 'build', reason: 'needs a complete set' });
    expect(cardVerbHint('action_haveli_0')).toEqual({ verbKey: 'build', reason: 'needs a MAKAAN first' });
    expect(hintFor('action_kabza_0')).toBe('no full set to seize');
    expect(hintFor('action_haathKiSafai_0')).toBe('nothing stealable');
    expect(hintFor('action_adlaBadli_0')).toBe('needs one of yours + one of theirs');
    expect(cardVerbHint('kiraya_jaipur_kolkata_0')).toEqual({ verbKey: 'charge', reason: 'no matching property' });
  });

  it('has no hint for always-playable actions, money, or property', () => {
    expect(cardVerbHint('action_vasooli_0')).toBeNull();
    expect(cardVerbHint('action_shagun_0')).toBeNull();
    expect(cardVerbHint('action_aageBadho_0')).toBeNull();
    expect(cardVerbHint('money_2_0')).toBeNull();
    expect(cardVerbHint('prop_mumbai_0')).toBeNull();
  });
});

describe('cross-kind drops produce no engine action (F7 verify)', () => {
  it('a money card offers only the bank zone — never a property group', () => {
    const money = 'money_2_0';
    const actions: Action[] = [{ type: 'BANK_CARD', cardId: money }, { type: 'END_TURN' }];
    const zones = dropZonesForCard(actions, money);
    expect(zones.map((zone) => zone.kind)).toEqual(['bank']); // dropping it on a set group matches nothing
  });

  it('a property offers only its set zone — never the bank', () => {
    const prop = 'prop_mumbai_0';
    const actions: Action[] = [{ type: 'PLACE_PROPERTY', cardId: prop, set: 'mumbai' }, { type: 'END_TURN' }];
    const zones = dropZonesForCard(actions, prop);
    expect(zones.some((zone) => zone.kind === 'bank')).toBe(false); // dropping it on the bank matches nothing
    expect(zones.some((zone) => zone.kind === 'set')).toBe(true);
  });
});

describe('assistHintAction — the difficulty-gated best-target ACTION (S3, per-step T3)', () => {
  const kabza = 'action_kabza_0';
  // Two legal KABZA targets; a stub recommend picks the SECOND (the mumbai action).
  const kabzaActions: Action[] = [
    { type: 'PLAY_ACTION', cardId: kabza, params: { action: 'kabza', target: 1, set: 'jaipur' } },
    { type: 'PLAY_ACTION', cardId: kabza, params: { action: 'kabza', target: 2, set: 'mumbai' } },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obs = {} as any;
  const pickSecond = ((_o: unknown, subset: Action[]) => ({ action: subset[1]!, reason: 'deniesSet' })) as never;

  it('hard shows NO hint; easy and medium return recommend()’s action', () => {
    expect(assistHintAction(obs, kabzaActions, kabza, 'hard', pickSecond)).toBeNull();
    expect(assistHintAction(obs, kabzaActions, kabza, 'easy', pickSecond)).toBe(kabzaActions[1]); // same object
    expect(assistHintAction(obs, kabzaActions, kabza, 'medium', pickSecond)).toBe(kabzaActions[1]);
  });

  it('the hint IS exactly the action recommend() picked', () => {
    const pickFirst = ((_o: unknown, subset: Action[]) => ({ action: subset[0]!, reason: 'deniesSet' })) as never;
    expect(assistHintAction(obs, kabzaActions, kabza, 'easy', pickFirst)).toBe(kabzaActions[0]);
    expect(assistHintAction(obs, kabzaActions, kabza, 'easy', pickSecond)).toBe(kabzaActions[1]);
  });

  it('never alters what is targetable — it only READS actions, and returns null when nothing to pick', () => {
    const before = JSON.parse(JSON.stringify(kabzaActions));
    assistHintAction(obs, kabzaActions, kabza, 'easy', pickSecond);
    expect(kabzaActions).toEqual(before); // the actions list is untouched (read-only)
    // one target fires on drop (no overlay) → no hint
    const single: Action[] = [{ type: 'PLAY_ACTION', cardId: kabza, params: { action: 'kabza', target: 1, set: 'jaipur' } }];
    expect(assistHintAction(obs, single, kabza, 'easy', pickSecond)).toBeNull();
  });

  it('with the REAL recommend, KABZA hints the highest-value set (bestKabza) on easy, nothing on hard', () => {
    // recommendTurn → bestKabza ranks by SETS[set].value only, so a bare observation suffices here.
    const richer = SETS.jaipur.value >= SETS.mumbai.value ? kabzaActions[0] : kabzaActions[1];
    expect(assistHintAction(obs, kabzaActions, kabza, 'easy')).toBe(richer);
    expect(assistHintAction(obs, kabzaActions, kabza, 'hard')).toBeNull();
  });

  it('LAGAAN returns the charge recommend() picks (the overlay hints its colour then opponent)', () => {
    const lagaan = 'kiraya_0';
    const kirayaActions: Action[] = [
      { type: 'PLAY_KIRAYA', cardId: lagaan, color: 'jaipur', dugnaCardIds: [], target: 1 },
      { type: 'PLAY_KIRAYA', cardId: lagaan, color: 'mumbai', dugnaCardIds: [], target: 1 },
    ];
    const pickMumbai = ((_o: unknown, subset: Action[]) => ({ action: subset[1]!, reason: 'bestValue' })) as never;
    expect(assistHintAction(obs, kirayaActions, lagaan, 'easy', pickMumbai)).toBe(kirayaActions[1]);
    expect(assistHintAction(obs, kirayaActions, lagaan, 'hard', pickMumbai)).toBeNull();
  });
});
