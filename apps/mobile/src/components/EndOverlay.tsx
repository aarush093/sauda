/**
 * The game-end overlay (F6, owner playtest 30 Jul). Any end — the human declaring SAUDA! or a
 * bot winning — presents ONE full-screen overlay: a dimmed scrim over the sleeping board and a
 * centred vintage panel (tokens only) with the title, the winner's three completed-set banners,
 * and a tokens-styled New game control. It is `position: fixed`, so unlike the old in-flow winner
 * strip it never grows the page past one screen (that strip was the end-state scroll bug).
 *
 * This is the clean placeholder; the real victory spectacle (stamp-slam) is M4c.
 */
import type { CSSProperties } from 'react';
import { SETS } from '@sauda/engine';
import type { SetId } from '@sauda/engine';
import { STAGE, INK, FONT } from '../design/tokens';

export function EndOverlay({
  title,
  setColors,
  onNewGame,
}: {
  title: string; // "SAUDA!" on a human win, otherwise "<name> wins"
  setColors: SetId[]; // the winner's completed set colours (the three that won it)
  onNewGame: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <div style={titleStyle}>{title}</div>
        <div style={bannersRowStyle}>
          {setColors.map((set) => (
            <div key={set} style={bannerStyle}>
              <div style={{ height: 22, background: SETS[set].hex, borderRadius: 3 }} />
              <div style={bannerLabelStyle}>{SETS[set].label}</div>
            </div>
          ))}
        </div>
        <button type="button" style={newGameButtonStyle} onClick={onNewGame}>
          New game
        </button>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 20, // above every play surface — the game is over
  background: STAGE.scrimSheet,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};
const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: 300,
  background: STAGE.cardCream,
  color: INK.deepInk,
  borderRadius: 16,
  border: `1.5px solid ${INK.gold}`,
  boxShadow: STAGE.glowGold,
  padding: '22px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
};
const titleStyle: CSSProperties = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 26,
  color: INK.deepInk,
  textAlign: 'center',
};
const bannersRowStyle: CSSProperties = { display: 'flex', gap: 8, justifyContent: 'center' };
const bannerStyle: CSSProperties = {
  width: 64,
  borderRadius: 4,
  overflow: 'hidden',
  border: `1px solid ${INK.agedLine}`,
  background: STAGE.cardCream,
};
const bannerLabelStyle: CSSProperties = {
  padding: '3px 2px',
  fontFamily: FONT.serif,
  fontSize: 10,
  fontWeight: 700,
  textAlign: 'center',
  color: INK.deepInk,
};
const newGameButtonStyle: CSSProperties = {
  padding: '12px 24px',
  borderRadius: 999,
  border: 'none',
  background: STAGE.accentGold,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};
