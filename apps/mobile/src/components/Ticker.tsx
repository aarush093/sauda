/**
 * The event ticker (§8 · A10 L1). A slim two-line narrator under the table band: the two
 * most recent event lines, the newest brightest. It is the ONLY passive event feed on the
 * play screen (the M3 log panel is retired). Every play and every auto-resolve (L1)
 * appends a line, so the player can always read what just happened without a log.
 */
import type { CSSProperties } from 'react';
import { STAGE, FONT } from '../design/tokens';

export function Ticker({ lines }: { lines: string[] }) {
  const recent = lines.slice(-2);
  return (
    <div style={wrapStyle} aria-live="polite">
      {recent.map((line, index) => (
        <div key={index} style={index === recent.length - 1 ? latestLine : olderLine}>
          {line}
        </div>
      ))}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  minHeight: 26,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 1,
  padding: '2px 10px',
  textAlign: 'center',
  overflow: 'hidden',
};
const latestLine: CSSProperties = {
  fontFamily: FONT.serif,
  fontSize: 11,
  color: STAGE.textOnFelt,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const olderLine: CSSProperties = { ...latestLine, fontSize: 10, opacity: 0.5 };
