import { useCallback, useEffect, useRef, useState } from 'react';

interface BottomPanelSpacingOptions {
  active: boolean;
  defaultPanelHeight?: number;
  gap?: number;
}

export function useBottomPanelSpacing<T extends HTMLElement = HTMLDivElement>({
  active,
  defaultPanelHeight = 240,
  gap = 16,
}: BottomPanelSpacingOptions) {
  const panelRef = useRef<T | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const shouldLiftPanelRef = useRef(false);
  const [panelHeight, setPanelHeight] = useState(defaultPanelHeight);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [bottomOffset, setBottomOffset] = useState(0);

  const scrollToBottom = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }, []);

  const measure = useCallback(() => {
    if (!active) {
      setKeyboardInset(0);
      return;
    }

    const nextPanelHeight = panelRef.current
      ? Math.ceil(panelRef.current.getBoundingClientRect().height)
      : defaultPanelHeight;

    const viewport = window.visualViewport;
    const nextKeyboardInset = viewport
      ? Math.max(0, Math.ceil(window.innerHeight - viewport.height - viewport.offsetTop))
      : 0;

    if (nextKeyboardInset === 0) {
      shouldLiftPanelRef.current = false;
      setBottomOffset(0);
    } else if (viewport && panelRef.current) {
      const visualBottom = viewport.height + viewport.offsetTop;
      const panelBottom = panelRef.current.getBoundingClientRect().bottom;
      if (!shouldLiftPanelRef.current) {
        shouldLiftPanelRef.current = panelBottom > visualBottom + 4;
      }
      setBottomOffset(shouldLiftPanelRef.current ? nextKeyboardInset : 0);
    }

    setPanelHeight(nextPanelHeight);
    setKeyboardInset(nextKeyboardInset);
  }, [active, defaultPanelHeight]);

  useEffect(() => {
    measure();
    if (!active) return;

    const panel = panelRef.current;
    const observer = panel && 'ResizeObserver' in window
      ? new ResizeObserver(measure)
      : null;

    observer?.observe(panel);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);

    const timer = window.setTimeout(measure, 60);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
      window.clearTimeout(timer);
    };
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [active, panelHeight, keyboardInset, scrollToBottom]);

  return {
    panelRef,
    scrollAreaRef,
    bottomOffset: active ? bottomOffset : 0,
    paddingBottom: active ? panelHeight + keyboardInset + gap : gap,
  };
}