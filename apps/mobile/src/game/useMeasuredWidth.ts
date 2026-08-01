/**
 * Measure an element's content width with a ResizeObserver. Used where a layout must adapt to the
 * real pixel width of its slot — the hand fan (F1) and the opponent group strip (F5). Under jsdom
 * (no layout engine) the width stays 0 and callers fall back to a sensible default.
 */
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (typeof ResizeObserver === 'undefined') {
      setWidth(element.clientWidth); // jsdom: no layout engine — stays 0, caller uses its fallback
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

// Measure an element's content HEIGHT (P1). The board measures its own real box so the zone-layout
// law (zoneLayout.ts) distributes the true available height — dvh and safe-area padding already
// applied — instead of a percentage of the wrong (desktop) viewport. `fallback` is used on the
// first paint and under jsdom, where there is no layout engine to measure.
export function useMeasuredHeight<T extends HTMLElement>(fallback: number): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const read = () => {
      const measured = element.clientHeight;
      if (measured > 0) {
        setHeight(measured); // ignore a transient 0 (keeps the fallback) so the layout never collapses
      }
    };
    if (typeof ResizeObserver === 'undefined') {
      read();
      return;
    }
    const observer = new ResizeObserver(read);
    observer.observe(element);
    read();
    return () => observer.disconnect();
  }, []);
  return [ref, height];
}

// Measure both dimensions — the centre-stage spotlight (K2) sizes its card to the stage HEIGHT so a
// tall card can never overflow the band and collide with the ticker (the owner-screenshotted bug).
export function useMeasuredSize<T extends HTMLElement>(): [RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const read = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    if (typeof ResizeObserver === 'undefined') {
      read(); // jsdom: no layout engine — stays 0, caller uses its fallback
      return;
    }
    const observer = new ResizeObserver(read);
    observer.observe(element);
    read();
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}
