/**
 * Read-only view of the table for one player's perspective. It renders an
 * Observation (from the engine) — it never reads or mutates raw GameState.
 */
import { SETS } from '@sauda/engine';
import type { Observation, PropertyGroup, SetId } from '@sauda/engine';
import { bankTotal, describeCard } from '../game/labels';
import type { SeatConfig } from '../game/store';

const ALL_SETS = Object.keys(SETS) as SetId[];

function seatLabel(seats: SeatConfig[], id: number): string {
  const seat = seats[id];
  if (!seat) {
    return `P${id}`;
  }
  return seat.kind === 'bot' ? `P${id} (bot ${seat.difficulty})` : `P${id}`;
}

function SetChips({ properties }: { properties: Record<SetId, PropertyGroup[]> }) {
  const chips: JSX.Element[] = [];
  for (const set of ALL_SETS) {
    const groups = properties[set];
    const size = SETS[set].size;
    // A colour can hold more than one set (overflow), so render a chip per group.
    groups.forEach((group, index) => {
      if (group.cards.length === 0) {
        return;
      }
      const complete = group.cards.length >= size;
      const buildings = group.buildings.length > 0 ? ` +${group.buildings.length}b` : '';
      chips.push(
        <span key={`${set}-${index}`} className={`set-chip${complete ? ' complete' : ''}`}>
          {SETS[set].label} {complete ? '✓' : `${group.cards.length}/${size}`}
          {buildings}
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
              {bankTotal(opponent.bank)}
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
        <SetChips properties={observation.myProperties} />
      </div>

      <div className="zone">
        <h3>Your bank — ₹{bankTotal(observation.myBank)}</h3>
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
          {observation.myHand.map((id) => (
            <span key={id} className="card">
              {describeCard(id)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
