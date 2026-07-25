/**
 * Renders the legal moves for the human whose turn (or response) it is. Every
 * button comes straight from the engine's legalActions — the panel decides
 * nothing about the rules, it only groups the offered actions for readability.
 */
import { SETS } from '@sauda/engine';
import type { Action, Observation } from '@sauda/engine';
import { actionCardId, describeAction, describeCard } from '../game/labels';

function describeThreat(interrupt: NonNullable<Observation['interrupt']>): string {
  const effect = interrupt.effect;
  switch (effect.kind) {
    case 'charge':
      return `Player ${interrupt.origin} charges you ₹${effect.amount} Cr.`;
    case 'stealSet':
      return `Player ${interrupt.origin} is grabbing your ${SETS[effect.set].label} set (KABZA).`;
    case 'stealProperty':
      return `Player ${interrupt.origin} is taking your ${describeCard(effect.cardId)}.`;
    case 'swap':
      return `Player ${interrupt.origin} wants to swap ${describeCard(effect.theirCardId)} for your ${describeCard(effect.myCardId)}.`;
    default:
      return `Player ${interrupt.origin} played something against you.`;
  }
}

export function ActionPanel({
  actions,
  observation,
  onAct,
}: {
  actions: Action[];
  observation: Observation;
  onAct: (action: Action) => void;
}) {
  const responses = actions.filter((a) => a.type.startsWith('RESPOND_'));
  if (responses.length > 0) {
    return (
      <div className="actions">
        <div className="group respond">
          <h4>{observation.interrupt ? describeThreat(observation.interrupt) : 'Respond'}</h4>
          <div className="buttons">
            {responses.map((action, index) => (
              <button key={index} onClick={() => onAct(action)}>
                {describeAction(action)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Group the remaining actions by the hand card they operate on.
  const general: Action[] = [];
  const byCard = new Map<string, Action[]>();
  for (const action of actions) {
    const cardId = actionCardId(action);
    if (cardId === null) {
      general.push(action);
    } else {
      const list = byCard.get(cardId) ?? [];
      list.push(action);
      byCard.set(cardId, list);
    }
  }

  return (
    <div className="actions">
      {general.length > 0 && (
        <div className="group">
          <h4>Turn</h4>
          <div className="buttons">
            {general.map((action, index) => (
              <button key={index} onClick={() => onAct(action)}>
                {describeAction(action)}
              </button>
            ))}
          </div>
        </div>
      )}

      {[...byCard.entries()].map(([cardId, cardActions]) => (
        <div key={cardId} className="group">
          <h4>{describeCard(cardId)}</h4>
          <div className="buttons">
            {cardActions.map((action, index) => (
              <button key={index} onClick={() => onAct(action)}>
                {describeAction(action)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
