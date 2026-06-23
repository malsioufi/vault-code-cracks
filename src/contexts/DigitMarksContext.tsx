import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Mark = 'neutral' | 'present' | 'confirmed' | 'ruled-out';

export const MARK_ORDER: Mark[] = ['neutral', 'present', 'confirmed', 'ruled-out'];

export const markStyles: Record<Mark, string> = {
  neutral: 'bg-card text-muted-foreground border-border',
  present: 'bg-warning/20 text-warning border-warning/60',
  confirmed: 'bg-primary/20 text-primary border-primary/60',
  'ruled-out': 'bg-destructive/15 text-destructive border-destructive/50 line-through opacity-70',
};

/** Text/border-only variants for use inside the digit input boxes. */
export const markInputStyles: Record<Mark, string> = {
  neutral: '',
  present: 'text-warning border-warning [box-shadow:0_0_10px_hsl(var(--warning)/0.6)]',
  confirmed: 'text-primary border-primary [box-shadow:0_0_10px_hsl(var(--primary)/0.7)]',
  'ruled-out': 'text-destructive border-destructive line-through opacity-80',
};

export const markSymbol: Record<Mark, string> = {
  neutral: '',
  present: '?',
  confirmed: '✓',
  'ruled-out': '✕',
};

interface Ctx {
  marks: Record<number, Mark>;
  setMark: (d: number, m: Mark) => void;
  cycle: (d: number) => void;
  reset: () => void;
  getMark: (d: number) => Mark;
}

const DigitMarksContext = createContext<Ctx | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  resetKey?: string | number;
}

export const DigitMarksProvider: React.FC<ProviderProps> = ({ children, resetKey }) => {
  const [marks, setMarks] = useState<Record<number, Mark>>({});

  useEffect(() => {
    setMarks({});
  }, [resetKey]);

  const setMark = useCallback((d: number, m: Mark) => {
    setMarks((prev) => {
      const copy = { ...prev };
      if (m === 'neutral') delete copy[d];
      else copy[d] = m;
      return copy;
    });
  }, []);

  const cycle = useCallback((d: number) => {
    setMarks((prev) => {
      const current = prev[d] ?? 'neutral';
      const next = MARK_ORDER[(MARK_ORDER.indexOf(current) + 1) % MARK_ORDER.length];
      const copy = { ...prev };
      if (next === 'neutral') delete copy[d];
      else copy[d] = next;
      return copy;
    });
  }, []);

  const reset = useCallback(() => setMarks({}), []);
  const getMark = useCallback((d: number): Mark => marks[d] ?? 'neutral', [marks]);

  return (
    <DigitMarksContext.Provider value={{ marks, setMark, cycle, reset, getMark }}>
      {children}
    </DigitMarksContext.Provider>
  );
};

/** Returns context value, or null if the consumer is rendered outside a provider. */
export function useDigitMarks(): Ctx | null {
  return useContext(DigitMarksContext);
}
