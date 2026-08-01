/**
 * A surface that EASES IN instead of popping (K2 motion continuity). Any overlay panel — inspect,
 * TableView, payment, the interrupt prompt, a beat note — wraps its content in a Surface so it
 * fades + scales up from its origin (~180ms ease-out) rather than snapping into existence. It is
 * transform/opacity only (compositor-cheap, keeps the H4 budget) and collapses to instant under
 * `prefers-reduced-motion`, so the reduced path shows the same panel with no motion.
 *
 * Enter-only by design: React unmounts the panel the moment its gate goes false, and an accurate
 * reverse-out would mean threading a two-phase close through every call site. The enter ease is the
 * felt win (nothing pops); the exit staying instant is a deliberate, documented scope line (K2).
 */
import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { MOTION_MS, reduce, useReducedMotion } from '../design/motion';

export function Surface({
  children,
  origin = 'center',
  durationMs = MOTION_MS.surface,
  style,
  onClick,
}: {
  children: ReactNode;
  origin?: string; // transform-origin — where the panel scales up FROM (e.g. 'bottom center')
  durationMs?: number;
  style?: CSSProperties;
  onClick?: (event: ReactMouseEvent) => void; // e.g. stopPropagation so a panel tap isn't a backdrop tap
}) {
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(false);

  // Flip to the settled state on the next paint, so the browser has a "from" frame to ease out of.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const ms = reduce(durationMs, reduced);
  return (
    <div
      onClick={onClick}
      style={{
        ...style,
        transformOrigin: origin,
        transform: entered ? 'scale(1)' : 'scale(0.96)',
        opacity: entered ? 1 : 0,
        transition: `transform ${ms}ms ease-out, opacity ${ms}ms ease-out`,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
}
