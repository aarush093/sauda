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
