/**
 * The focus-follows-turn transition (R1 — owner landscape directive, 2 Aug). When control crosses
 * between MY TURN and SPECTATE the whole focus swaps, so the swap must read as one motion, not a hard
 * cut. This wraps the active layout and plays a single ~250ms slide + fade-in whenever the focus key
 * changes (a `key` on the wrapper remounts it, so the enter plays from its initial offset). The new
 * layout dissolves in over the SAME felt the old one sat on, so there is never a dead frame.
 *
 * Transform + opacity only (GPU-composited, no layout). Under prefers-reduced-motion it is instant —
 * the swap is comprehension, not decoration, so the layout is simply present with no slide.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useReducedMotion } from '../design/motion';

const ENTER_MS = 250; // the owner's single-motion window for the focus swap
const SLIDE_PX = 14; // a small lateral slide — my turn enters from my side, spectate from the other

export function FocusTransition({ direction, children }: { direction: 'mine' | 'spectate'; children: ReactNode }) {
  const reduced = useReducedMotion();
  // Start un-entered (offset + transparent) unless reduced motion, then settle on the next frame — the
  // same reveal pattern the stage spotlight and ticker use, so the enter eases in rather than snapping.
  const [entered, setEntered] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setEntered(true);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const offset = direction === 'mine' ? -SLIDE_PX : SLIDE_PX;
  return (
    <div
      style={{
        ...fillStyle,
        transform: entered ? 'translateX(0)' : `translateX(${offset}px)`,
        opacity: entered ? 1 : 0,
        transition: reduced ? undefined : `transform ${ENTER_MS}ms ease-out, opacity ${ENTER_MS}ms ease-out`,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
}

const fillStyle: CSSProperties = { width: '100%', height: '100%' };
