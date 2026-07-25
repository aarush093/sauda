/**
 * Read-only view of the table for one player's perspective. It renders an
 * Observation from the engine and shows ONLY numbers the engine computed
 * (bank totals, per-group kiraya). No total is ever recomputed here.
 */
import { SETS, isSetComplete } from '@sauda/engine';
import type { Observation, PropertyGroup, SetId } from '@sauda/engine';
import { cardDescriptor, describeCard } from '../game/labels';
import type { SeatConfig } from '../game/store';

const ALL_SETS = Object.keys(SETS) as SetId[];

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
              {seatLabel(seats, opponent.id)} · hand {opponent.handCount} · bank ₹
              {opponent.bankTotal}
            </span>
            <SetChips properties={opponent.properties} />
          </div>
        ))}
      </div>

      <div className="zone center">
        <span>Draw: {observation.drawPileCount}</span>
        <span>Discard: {observation.discardPile.length}</span>
      </div>

      <div className="zone">
        <h3>Your sets</h3>
        <SetChips properties={observation.myProperties} kiraya={observation.myKiraya} />
      </div>

      <div className="zone">
        <h3>Your bank — ₹{observation.myBankTotal}</h3>
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
