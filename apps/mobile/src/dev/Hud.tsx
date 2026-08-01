/**
 * The device HUD (PHONE-1, owner phone test 1 Aug). A dev-only readout, gated by the `?hud=1`
 * query param, that answers the questions the owner and future sessions kept having to GUESS on a
 * real phone: what is the live viewport, the DPR, the reduced-motion state, and how tall did each
 * layout zone actually end up? It measures the real thing (the live `[data-zone]` rects and
 * `window.innerHeight`), so it debugs the device instead of the desktop frame.
 *
 * It is a fixed, pointer-events:none overlay pinned top-right, drawn ABOVE everything (it is a
 * debug instrument, not part of the game), and re-measures on every resize — which on a phone
 * includes the URL bar showing/hiding, the exact event that used to scroll the page.
 */
import { useEffect, useState } from 'react';
import { FONT, LAYERS, DEV_HUD } from '../design/tokens';

// True when the URL carries ?hud=1 (and we're in a dev build). Read live so it works on any route.
export function hudEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).has('hud');
}

interface ZoneReading {
  name: string;
  height: number;
}

function measureZones(): ZoneReading[] {
  if (typeof document === 'undefined') {
    return [];
  }
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-zone]'));
  return nodes.map((node) => ({
    name: node.dataset.zone ?? '?',
    height: Math.round(node.getBoundingClientRect().height),
  }));
}

export function Hud() {
  // One reading bundle, refreshed on resize / a short poll (zones settle a frame after layout).
  const [reading, setReading] = useState(() => snapshot());
  useEffect(() => {
    const refresh = () => setReading(snapshot());
    refresh();
    window.addEventListener('resize', refresh);
    // Zones can change without a resize (a turn opens the discard overlay, the stage collapses),
    // so poll gently as well — this is a debug instrument, cost is irrelevant, DEV-only.
    const timer = window.setInterval(refresh, 500);
    return () => {
      window.removeEventListener('resize', refresh);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div style={panel}>
      <div style={{ fontWeight: 700 }}>
        {reading.vw}×{reading.vh} · dpr {reading.dpr}
      </div>
      <div>reduced-motion: {reading.reduced ? 'ON' : 'off'}</div>
      <div>visual vp: {reading.visualVh}px</div>
      {reading.zones.length > 0 && (
        <div style={{ marginTop: 4, opacity: 0.85 }}>
          {reading.zones.map((zone) => (
            <div key={zone.name}>
              {zone.name}: {zone.height}px
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function snapshot() {
  const reduced =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  // window.innerHeight is the LAYOUT viewport; visualViewport.height tracks the URL-bar-adjusted
  // visible height — the gap between them is exactly the dvh problem the shell fixes (P1).
  const visualVh = typeof window !== 'undefined' && window.visualViewport ? Math.round(window.visualViewport.height) : 0;
  return {
    vw: typeof window !== 'undefined' ? window.innerWidth : 0,
    vh: typeof window !== 'undefined' ? window.innerHeight : 0,
    dpr: typeof window !== 'undefined' ? Math.round(window.devicePixelRatio * 100) / 100 : 0,
    reduced,
    visualVh,
    zones: measureZones(),
  };
}

const panel = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
  right: 'calc(env(safe-area-inset-right, 0px) + 4px)',
  zIndex: LAYERS.hud,
  pointerEvents: 'none',
  background: DEV_HUD.panelFill,
  color: DEV_HUD.panelText,
  fontFamily: FONT.mono,
  fontSize: 10,
  lineHeight: 1.35,
  padding: '5px 7px',
  borderRadius: 6,
  border: `1px solid ${DEV_HUD.panelBorder}`,
  textAlign: 'right',
} as const;
