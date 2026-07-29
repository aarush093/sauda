/**
 * Read-only view of the table for one player's perspective. It renders an
 * Observation from the engine and shows ONLY numbers the engine computed
 * (bank totals, per-group kiraya). No total is ever recomputed here.
 */
import { SETS, isSetComplete } from '@sauda/engine';
import type { Observation, PropertyGroup, SetId } from '@sauda/engine';
import { cardDescriptor, describeCard } from '../game/labels';
import type { SeatConfig } from '../game/store';
import { CardBack } from './CardBack';

const ALL_SETS = Object.keys(SETS) as SetId[];

// A hidden hand shown as face-down pips: one small card back per card, overlapped so
// even a big hand stays compact. The exact count is printed alongside.
function HandPips({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }} title={`${count} cards in hand`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} style={{ marginLeft: index === 0 ? 0 : -9 }}>
          <CardBack width={18} seal={false} />
        </div>
      ))}
      <span style={{ marginLeft: count > 0 ? 6 : 0, fontSize: 12, opacity: 0.85 }}>hand {count}</span>
    </div>
  );
}

// The face-down draw pile: up to three card backs offset to read as a stack, the top
// one carrying the seal. Purely a pile motif — the exact size is the "Draw: N" label.
function DrawPile({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  const layers = Math.min(count, 3); // 1–3 backs, deepest first
  return (
    <div style={{ position: 'relative', width: 44 + 6, height: Math.round(44 * 1.45) + 6 }}>
      {Array.from({ length: layers }).map((_, index) => {
        const offset = (layers - 1 - index) * 3; // back layers sit down-right
        return (
          <div key={index} style={{ position: 'absolute', top: offset, left: offset }}>
            <CardBack width={44} seal={index === layers - 1} />
          </div>
        );
      })}
    </div>
  );
}

function seatLabel(seats: SeatConfig[], id: number): string {
  const seat = seats[id];
  if (!seat) {
    return `P${id}`;
  }
  return seat.kind === 'bot' ? `P${id} (bot ${seat.difficulty})` : `P${id}`;
}

// One chip per group. A colour can hold more than one set (overflow), so each is
// shown separately. `kiraya` (when given, for my own sets) is the engine's rent.
function SetChips({
  properties,
  kiraya,
}: {
  properties: Record<SetId, PropertyGroup[]>;
  kiraya?: Record<SetId, number[]>;
}) {
  const chips: JSX.Element[] = [];
  for (const set of ALL_SETS) {
    properties[set].forEach((group, index) => {
      if (group.cards.length === 0) {
        return;
      }
      const complete = isSetComplete(group);
      const size = SETS[set].size;
      const buildings = group.buildings.length > 0 ? ` +${group.buildings.length}b` : '';
      const rent = kiraya ? ` · rent ₹${kiraya[set][index] ?? 0}` : '';
      chips.push(
        <span key={`${set}-${index}`} className={`set-chip${complete ? ' complete' : ''}`}>
          {SETS[set].label} {complete ? '✓' : `${group.cards.length}/${size}`}
          {buildings}
          {rent}
        </span>,
      );
    });
  }
  return <div className="sets">{chips.length > 0 ? chips : <em>no sets</em>}</div>;
}

export function Board({
  observation,
  seats,
}: {
  observation: Observation;
  seats: SeatConfig[];
}) {
  return (
    <div className="board">
      <div className="turn-info">
        Turn {observation.turnCount} · current: {seatLabel(seats, observation.currentPlayer)} ·
        phase: {observation.phase} · plays left: {observation.playsRemaining}
      </div>

      <div className="zone">
        <h3>Opponents</h3>
        {observation.opponents.map((opponent) => (
          <div key={opponent.id} className="opponent">
            <span>
              {seatLabel(seats, opponent.id)} · bank ₹{opponent.bankTotal} Cr
            </span>
            <HandPips count={opponent.handCount} />
            <SetChips properties={opponent.properties} />
          </div>
        ))}
      </div>

      <div className="zone center">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DrawPile count={observation.drawPileCount} />
          <span>Draw: {observation.drawPileCount}</span>
        </div>
        <span>Discard: {observation.discardPile.length}</span>
      </div>

      <div className="zone">
        <h3>Your sets</h3>
        <SetChips properties={observation.myProperties} kiraya={observation.myKiraya} />
      </div>

      <div className="zone">
        <h3>Your bank — ₹{observation.myBankTotal} Cr</h3>
        <div className="cards">
          {observation.myBank.map((id) => (
            <span key={id} className="card">
              {describeCard(id)}
            </span>
          ))}
        </div>
      </div>

      <div className="zone">
        <h3>Your hand ({observation.myHand.length})</h3>
        <div className="cards">
          {observation.myHand.map((id) => {
            const descriptor = cardDescriptor(id);
            return (
              <span key={id} className="card">
                {describeCard(id)}
                {descriptor ? ` — ${descriptor}` : ''}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
