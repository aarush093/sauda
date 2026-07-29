/**
 * The centre-stage overlay (v1.2 A1 · STATE_MATRIX B1/B2). The tapped hand card rises
 * here, enlarged and readable, over a light scrim with the table still visible; the
 * action rail sits to its right. Tapping the scrim anywhere off the card or rail cancels
 * (B2) — nothing commits without a rail tap.
 */
import type { Action } from '@sauda/engine';
import { CardFace } from './CardFace';
import { ActionRail } from './ActionRail';
import { railForCard } from '../game/staging';
import { STAGE } from '../design/tokens';

export function StagedCard({
  cardId,
  actions,
  onAct,
  onCancel,
}: {
  cardId: string;
  actions: Action[];
  onAct: (action: Action) => void;
  onCancel: () => void;
}) {
  const verbs = railForCard(actions, cardId);
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        background: STAGE.scrimDrag,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      {/* the card + rail; a tap in here must not fall through to the scrim's cancel */}
      <div onClick={(event) => event.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <CardFace cardId={cardId} size="full" />
        <ActionRail verbs={verbs} onAct={onAct} onCancel={onCancel} />
      </div>
    </div>
  );
}
