import { useCallback, useEffect, useRef, useState } from 'react';

interface BottomPanelSpacingOptions {
  active: boolean;
  defaultPanelHeight?: number;
  gap?: number;
}

/**
 * Measures the fixed bottom panel's height so the scrollable history above
 * can reserve matching padding. Intentionally avoids tracking the OS keyboard
 * via visualViewport — that caused layout thrash / flicker when focusing
 * inputs on mobile. Modern browsers already keep focused inputs in view.
 */
export function useBottomPanelSpacing<T extends HTMLElement = HTMLDivElement>({
  active,
  defaultPanelHeight = 240,
  gap = 16,
}: BottomPanelSpacingOptions) {
  const panelRef = useRef<T | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState(defaultPanelHeight);

  const scrollToBottom = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }, []);

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;

    const measure = () => {
      const next = Math.ceil(panel.getBoundingClientRect().height);
      setPanelHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };

    measure();
    const observer = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    observer?.observe(panel);
    window.addEventListener('resize', measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    scrollToBottom();
    const id = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(id);
  }, [active, panelHeight, scrollToBottom]);

  return {
    panelRef,
    scrollAreaRef,
    bottomOffset: 0,
    paddingBottom: active ? panelHeight + gap : gap,
  };
}
