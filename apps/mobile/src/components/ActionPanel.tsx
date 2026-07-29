/**
 * Renders the legal moves for the human whose turn (or response) it is. Every
 * button comes straight from the engine's legalActions — the panel decides
 * nothing about the rules, it only groups the offered actions for readability.
 */
import type { Action, Observation } from '@sauda/engine';
import { actionCardId, describeAction, describeCard, describeThreat } from '../game/labels';

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
