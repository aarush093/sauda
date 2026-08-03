/**
 * MY TURN view (LAYOUT v3, FOCUS FOLLOWS TURN — owner landscape directive, 2 Aug). On my own turn the
 * screen shows ONLY my world, large and clear: a far-edge bot rail, then a top row of three columns —
 * my sets (left), the play stage (centre), and my controls (right: bank tray · Munshi · turn token) —
 * with the hand WHEEL spanning the whole bottom, hub at bottom-centre, in the full landscape width the
 * owner asked for. Bot boards do not render here; the rail summarises them and taps open a zoom.
 *
 * This is a pure composer: it renders the engine's Observation in token styles and forwards the drag /
 * tap / turn callbacks the board computed. It decides no rule. The floating drag ghost and every
 * response overlay stay in Board (one place), so this file is only the zone layout.
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { CardId, Observation, SetId } from '@sauda/engine';
import type { MyTurnZones } from '../game/landscapeLayout';
import { LANDSCAPE } from '../game/landscapeLayout';
import { GroupRow, PlayerHeader } from './BoardParts';
import { BankTray } from './BankTray';
import { MunshiChip } from './MunshiChip';
import { TurnToken } from './TurnToken';
import { HandWheel } from './HandWheel';
import { Ticker } from './Ticker';
import { StageSpotlight } from './StageSpotlight';
import { BotTabRail } from './BotTabRail';
import { ScaledCard } from './CardFace';
import { STAGE, FONT, GLOW, LAYERS } from '../design/tokens';

const MY_SET_CARD_PX = 44; // my-sets cascade card width in the left column (tap to expand for full size)
const STAGE_CARD_PX = 108; // the received-card stage size — big and readable, fits the short viewport

// The per-card pointer handlers useHandDrag yields — shared by the rearrange handles and the staged
// received card. Matches the shape BoardParts' GroupRow rearrange prop expects exactly.
type CardHandlers = (cardId: string) => {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
};

export interface MyTurnLayoutProps {
  observation: Observation;
  zones: MyTurnZones;
  // drop-zone glow, all derived from legalActions in Board
  glowSets: Set<SetId>;
  bankGlow: boolean;
  playEligible: boolean;
  hotZoneId: string | null;
  // centre-stage spotlight (my just-played card travels here for a beat, F4)
  spotlightCardId: string | null;
  spotlightFromOpponent: boolean;
  munshiAvailable: boolean;
  tickerLines: string[];
  turnToken: {
    active: boolean;
    playsRemaining: number;
    winLegal: boolean;
    endTurnLegal: boolean;
    rearrangeActive: boolean;
    paused: boolean;
    onEndTurn: () => void;
    onDeclareWin: () => void;
  };
  wheel: {
    cards: CardId[];
    interactiveIds: Set<string>;
    carriedCardId: string | null;
    onTap: (cardId: string) => void;
    onDragStart: (cardId: string, x: number, y: number) => void;
    onDragMove: (x: number, y: number) => void;
    onDragEnd: (x: number, y: number) => void;
    onDragCancel: () => void;
  };
  rearrange?: { handlers: CardHandlers; cardIds: string[]; draggingId: string | null } | undefined;
  // G6: a received wildcard sits on the stage awaiting a set — its own drag handlers + legal sets.
  receiveOnStage?: { cardId: CardId; handlers: CardHandlers; dragging: boolean } | undefined;
  onPlaceReceived?: ((set: SetId) => void) | undefined;
  onExpandMine: () => void;
  onOpenBot: (id: number) => void;
  onOpenBank: () => void; // R3: tap my bank tray → open the bank inspect
}

export function MyTurnLayout(props: MyTurnLayoutProps) {
  const { observation, zones } = props;
  const receiving = props.receiveOnStage != null;

  return (
    <div style={rootStyle}>
      <BotTabRail opponents={observation.opponents} activeId={observation.currentPlayer} width={zones.rail} onOpen={props.onOpenBot} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* TOP ROW — my sets | play stage | my controls */}
        <div data-zone="myTurnTop" style={{ height: zones.topRow, minHeight: 0, display: 'flex', gap: LANDSCAPE.gap, padding: 6 }}>
          {/* LEFT: my sets as real-card cascades (tap a group to expand, as before) */}
          <div data-zone="mySets" style={{ width: zones.leftCol, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
            <PlayerHeader name="You" bankTotal={observation.myBankTotal} handCount={observation.myHand.length} active self />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <GroupRow
                properties={observation.myProperties}
                kiraya={observation.myKiraya}
                width={MY_SET_CARD_PX}
                mine
                dropSets={props.glowSets}
                hotZoneId={props.hotZoneId}
                onExpand={props.onExpandMine}
                onSetPlace={receiving ? props.onPlaceReceived : undefined}
                rearrange={props.rearrange}
              />
            </div>
          </div>

          {/* CENTRE: the play stage — the action drop target + the just-played spotlight */}
          <div data-zone="stage" style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <Ticker lines={props.tickerLines} />
            <div
              data-drop="play"
              style={{
                position: 'relative',
                zIndex: LAYERS.stage,
                flex: 1,
                minHeight: 0,
                margin: '2px 8px 6px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: props.hotZoneId === 'play' ? GLOW.hot : props.playEligible ? GLOW.soft : 'none',
              }}
            >
              {receiving && props.receiveOnStage ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    {...props.receiveOnStage.handlers(props.receiveOnStage.cardId)}
                    {...(import.meta.env.DEV && { 'data-card-id': props.receiveOnStage.cardId })}
                    onContextMenu={(event) => event.preventDefault()}
                    style={{ touchAction: 'none', cursor: 'grab', boxShadow: STAGE.glowGold, borderRadius: 8, opacity: props.receiveOnStage.dragging ? 0.3 : 1 }}
                  >
                    <ScaledCard cardId={props.receiveOnStage.cardId} width={STAGE_CARD_PX} />
                  </div>
                  <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 12, color: STAGE.accentGold }}>
                    Drag it to a glowing set — or tap one
                  </span>
                </div>
              ) : props.playEligible ? (
                <span style={{ fontFamily: FONT.display, fontWeight: 700, color: STAGE.accentGold }}>Play</span>
              ) : null}
            </div>
            <StageSpotlight cardId={receiving ? null : props.spotlightCardId} fromOpponent={props.spotlightFromOpponent} />
          </div>

          {/* RIGHT: my controls — bank tray (drop target), Munshi chip, the turn token */}
          <div data-zone="myControls" style={{ width: zones.rightCol, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, overflow: 'hidden' }}>
            {/* R3: the tray is BOTH the bank drop zone (data-drop, inside) AND tap-to-inspect — a plain
                tap (no drag) opens the bank view; a dragged bankable card still commits via data-drop. */}
            <div onClick={props.onOpenBank} title="Tap to inspect your bank" style={{ cursor: 'pointer' }}>
              <BankTray cards={observation.myBank} total={observation.myBankTotal} eligible={props.bankGlow} hot={props.hotZoneId === 'bank'} />
            </div>
            <MunshiChip available={props.munshiAvailable} />
            <TurnToken
              active={props.turnToken.active}
              playsRemaining={props.turnToken.playsRemaining}
              winLegal={props.turnToken.winLegal}
              endTurnLegal={props.turnToken.endTurnLegal}
              rearrangeActive={props.turnToken.rearrangeActive}
              paused={props.turnToken.paused}
              onEndTurn={props.turnToken.onEndTurn}
              onDeclareWin={props.turnToken.onDeclareWin}
            />
          </div>
        </div>

        {/* BOTTOM: the hand WHEEL, spanning the full content width — hub at bottom-centre. Its own row,
            so the bank tray and turn token (top row) never collide with it at any hand count. */}
        <div data-zone="wheel" style={{ height: zones.wheelBand, minHeight: 0, display: 'flex', alignItems: 'flex-end' }}>
          <HandWheel
            cards={props.wheel.cards}
            interactiveIds={props.wheel.interactiveIds}
            carriedCardId={props.wheel.carriedCardId}
            onTap={props.wheel.onTap}
            onDragStart={props.wheel.onDragStart}
            onDragMove={props.wheel.onDragMove}
            onDragEnd={props.wheel.onDragEnd}
            onDragCancel={props.wheel.onDragCancel}
          />
        </div>
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  minWidth: 0,
};
