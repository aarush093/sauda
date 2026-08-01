/**
 * The event ticker (§8 · A10 L1). A slim two-line narrator under the table band: the two
 * most recent event lines, the newest brightest. It is the ONLY passive event feed on the
 * play screen (the M3 log panel is retired). Every play and every auto-resolve (L1)
 * appends a line, so the player can always read what just happened without a log.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { STAGE, FONT } from '../design/tokens';
import { MOTION_MS, reduce, useReducedMotion } from '../design/motion';

export function Ticker({ lines }: { lines: string[] }) {
  const recent = lines.slice(-2);
  return (
    <div style={wrapStyle} aria-live="polite">
      {recent.map((line, index) =>
        index === recent.length - 1 ? (
          // K2: the newest line SLIDES up as it arrives (keyed by its text so a new event remounts
          // it and re-plays the slide) — the ticker reads as a continuous feed, not a hard cut.
          <TickerLine key={line} text={line} />
        ) : (
          <div key={`old:${line}`} style={olderLine}>
            {line}
          </div>
        ),
      )}
    </div>
  );
}

function TickerLine({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  const ms = reduce(MOTION_MS.ticker, reduced);
  return (
    <div
      style={{
        ...latestLine,
        transform: entered ? 'translateY(0)' : 'translateY(8px)',
        opacity: entered ? 1 : 0,
        transition: `transform ${ms}ms ease-out, opacity ${ms}ms ease-out`,
      }}
    >
      {text}
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
