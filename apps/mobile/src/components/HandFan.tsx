/**
 * My hand as a wide overlapping arc of real CardFace cards (A10 · §4). It measures its own
 * slot and fits up to ELEVEN cards WITHOUT overflowing (the frame is the limit, never a
 * scroll): the cards stay ~72 px until the frame is too narrow, and the exposed step shrinks
 * so `spread ≤ available`. Each interactive card carries the drag/tap handlers and
 * touch-action:none so a browser gesture never eats a drag; the card being dragged fades
 * here because it is shown in the floating preview.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DOMAttributes, RefObject } from 'react';
import { CardFace } from './CardFace';
import { STAGE, CARD } from '../design/tokens';

const REST_CARD_WIDTH = 72; // A10: ~72 px hand cards at rest
const FAN_FALLBACK_WIDTH = 240; // before the slot is measured (and under jsdom, no layout)

function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (typeof ResizeObserver === 'undefined') {
      setWidth(element.clientWidth); // jsdom: no layout engine — stays 0, fan uses the fallback
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function HandFan({
  cards,
  interactiveIds,
  draggingId,
  handlersFor,
}: {
  cards: string[];
  interactiveIds: Set<string>;
  draggingId: string | null;
  handlersFor: (cardId: string) => DOMAttributes<HTMLDivElement> | undefined;
}) {
  const [containerRef, measured] = useMeasuredWidth<HTMLDivElement>();
  const available = measured || FAN_FALLBACK_WIDTH;
  const count = cards.length;

  const cardWidth = Math.min(REST_CARD_WIDTH, Math.floor(available * 0.5));
  const scale = cardWidth / CARD.fullWidth;
  const cardHeight = Math.round(cardWidth * CARD.ratio);
  // Exposure per card: a comfortable ~60% overlap, but no more than fits the frame.
  const advance = count > 1 ? Math.min(Math.round(cardWidth * 0.6), Math.floor((available - cardWidth) / (count - 1))) : 0;
  const spread = cardWidth + advance * Math.max(count - 1, 0);
  const mid = (count - 1) / 2;

  return (
    <div ref={containerRef} style={containerStyle(cardHeight)}>
      {count === 0 ? (
        <span style={{ color: STAGE.textOnFelt, opacity: 0.6 }}>—</span>
      ) : (
        <div style={{ position: 'relative', width: spread, height: cardHeight }}>
          {cards.map((id, index) => {
            const interactive = interactiveIds.has(id);
            const handlers = interactive ? handlersFor(id) : undefined;
            return (
              <div
                key={id}
                {...handlers}
                // Dev-only DOM marker so the Playwright capture pipeline can grab a specific hand
                // card for a real mid-drag gesture. `import.meta.env.DEV` is false in prod, so the
                // spread collapses to nothing and the attribute never reaches the shipped bundle.
                {...(import.meta.env.DEV && { 'data-card-id': id })}
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  position: 'absolute',
                  left: index * advance,
                  bottom: Math.abs(index - mid) * -1.5, // shallow arc — the ends dip slightly
                  transform: `rotate(${(index - mid) * 2}deg)`,
                  transformOrigin: 'bottom center',
                  width: cardWidth,
                  height: cardHeight,
                  touchAction: 'none',
                  userSelect: 'none',
                  cursor: interactive ? 'grab' : 'default',
                  opacity: id === draggingId ? 0.3 : 1,
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                  <CardFace cardId={id} size="full" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const containerStyle = (cardHeight: number): CSSProperties => ({
  height: cardHeight + 10,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  overflow: 'hidden',
});
