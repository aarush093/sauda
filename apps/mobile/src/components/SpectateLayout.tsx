/**
 * SPECTATE view (LAYOUT v3, FOCUS FOLLOWS TURN — owner landscape directive, 2 Aug). On any bot's turn
 * the screen splits so I always see what is being done TO me: the acting bot's panel (the larger
 * share) carries their name, their board, and the stage where each card they play is held LARGE; my
 * panel (the smaller share) keeps a real read-only view of my own sets, bank total and hand (as card
 * backs — I cannot act off-turn except through the full interrupt overlays, which Board raises above
 * this). Non-acting bots stay as chips on the far-edge rail.
 *
 * Pure composer: it renders the Observation the board already has and decides no rule.
 */
import type { CSSProperties } from 'react';
import type { Observation } from '@sauda/engine';
import type { SeatConfig } from '../game/store';
import type { SpectateZones } from '../game/landscapeLayout';
import { LANDSCAPE } from '../game/landscapeLayout';
import { GroupRow, PlayerHeader, seatName } from './BoardParts';
import { CardBack } from './CardBack';
import { Ticker } from './Ticker';
import { StageSpotlight } from './StageSpotlight';
import { BotTabRail } from './BotTabRail';
import { StageCaption } from './StageCaption';
import { STAGE, FONT } from '../design/tokens';

const ACTING_SET_CARD_PX = 54; // the acting bot's board cascades — large enough to read across the room
const MY_SET_CARD_PX = 40; // my read-only sets in the smaller panel

export interface SpectateLayoutProps {
  observation: Observation;
  seats: SeatConfig[];
  zones: SpectateZones;
  actingId: number; // the bot whose turn it is — fills the main panel
  spotlightCardId: string | null; // their just-played card, held on their stage
  caption: string | null; // R2: the short caption beside that card ("B2 · Chennai Central")
  tickerLines: string[];
  onExpandMine: () => void;
  onExpandActing: () => void;
  onOpenBot: (id: number) => void;
}

export function SpectateLayout(props: SpectateLayoutProps) {
  const { observation, seats, zones, actingId } = props;
  const acting = observation.opponents.find((opponent) => opponent.id === actingId);
  const railBots = observation.opponents.filter((opponent) => opponent.id !== actingId);

  return (
    <div style={rootStyle}>
      <BotTabRail opponents={railBots} activeId={actingId} width={zones.rail} onOpen={props.onOpenBot} />

      {/* ACTING BOT panel — the larger share; their card is spotlit here with its caption */}
      <div data-zone="acting" style={{ width: zones.acting, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 6, gap: 4, cursor: 'pointer' }} onClick={props.onExpandActing}>
        {acting ? (
          <>
            <PlayerHeader name={seatName(seats, acting.id)} bankTotal={acting.bankTotal} handCount={acting.handCount} active expandable />
            {/* their board — read-only real cascades */}
            <div style={{ flexShrink: 0, maxHeight: '46%', overflow: 'hidden' }}>
              <GroupRow properties={acting.properties} width={ACTING_SET_CARD_PX} />
            </div>
            {/* their stage — the just-played card, held LARGE, with the caption beside it (R2) */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(event) => event.stopPropagation()}>
              <StageSpotlight cardId={props.spotlightCardId} fromOpponent />
              <StageCaption text={props.caption} />
            </div>
          </>
        ) : (
          <div style={emptyStyle}>Waiting…</div>
        )}
      </div>

      {/* MY panel — a real read-only view of my own board; the wheel collapses to card backs off-turn */}
      <div data-zone="myPanel" style={{ width: zones.mine, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 6, gap: 4, borderLeft: `1px solid ${STAGE.scrimSheet}`, filter: STAGE.dimSleep }}>
        <div onClick={props.onExpandMine} style={{ cursor: 'pointer' }}>
          <PlayerHeader name="You" bankTotal={observation.myBankTotal} handCount={observation.myHand.length} active={false} self />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <GroupRow properties={observation.myProperties} kiraya={observation.myKiraya} width={MY_SET_CARD_PX} mine onExpand={props.onExpandMine} />
        </div>
        {/* my hand as card backs — I hold these; I just can't play them until my turn comes round */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={handLabelStyle}>Hand</span>
          <span style={{ display: 'flex' }}>
            {observation.myHand.slice(0, 8).map((cardId, index) => (
              <span key={cardId} style={{ marginLeft: index === 0 ? 0 : -10 }}>
                <CardBack width={20} seal={false} />
              </span>
            ))}
          </span>
          <span style={handCountStyle}>{observation.myHand.length}</span>
        </div>
      </div>

      {/* the running history stays available but unobtrusive, pinned low over the split (R2 keeps the
          2-line ticker as the log; the LARGE caption above is the primary "what just happened"). */}
      <div style={tickerCornerStyle}>
        <Ticker lines={props.tickerLines} />
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  display: 'flex',
  minWidth: 0,
};
const emptyStyle: CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.serif, fontStyle: 'italic', color: STAGE.textOnFelt, opacity: 0.7 };
const handLabelStyle: CSSProperties = { fontFamily: FONT.serif, fontSize: 11, color: STAGE.textOnFelt, opacity: 0.8 };
const handCountStyle: CSSProperties = { fontFamily: FONT.mono, fontWeight: 700, fontSize: 12, color: STAGE.cardCream };
// The ticker sits quietly in the bottom-left corner over the split — the running log, not the focus.
const tickerCornerStyle: CSSProperties = {
  position: 'absolute',
  left: LANDSCAPE.railWidth + 6,
  bottom: 2,
  maxWidth: '52%',
  pointerEvents: 'none',
  opacity: 0.9,
};
