import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDailyConfig,
  utcDateString,
  dailyDateString,
  msUntilNextUtcMidnight,
  msUntilNextDailyMidnight,
  buildShareGrid,
  buildShareText,
  getLocalDailyRecord,
  saveLocalDailyRecord,
  getLocalStreak,
} from '../dailyPuzzle';

// ─── utcDateString ───────────────────────────────────────────────

describe('utcDateString', () => {
  it('formats today as YYYY-MM-DD', () => {
    const d = new Date('2025-03-15T10:30:00Z');
    expect(utcDateString(d)).toBe('2025-03-15');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date('2025-01-05T00:00:00Z');
    expect(utcDateString(d)).toBe('2025-01-05');
  });
});

// ─── msUntilNextUtcMidnight ──────────────────────────────────────

describe('msUntilNextUtcMidnight', () => {
  it('returns correct ms from noon', () => {
    const noon = new Date('2025-06-01T12:00:00Z');
    expect(msUntilNextUtcMidnight(noon)).toBe(12 * 60 * 60 * 1000);
  });

  it('returns ~24h from just past midnight', () => {
    const justAfter = new Date('2025-06-01T00:00:01Z');
    expect(msUntilNextUtcMidnight(justAfter)).toBe(24 * 60 * 60 * 1000 - 1000);
  });
});

// ─── dailyDateString (Europe/Berlin) ─────────────────────────────

describe('dailyDateString (Europe/Berlin)', () => {
  it('returns Berlin calendar date in winter (UTC+1)', () => {
    expect(dailyDateString(new Date('2025-01-15T23:30:00Z'))).toBe('2025-01-16');
  });
  it('returns Berlin calendar date in summer DST (UTC+2)', () => {
    expect(dailyDateString(new Date('2025-07-15T21:30:00Z'))).toBe('2025-07-15');
    expect(dailyDateString(new Date('2025-07-15T22:30:00Z'))).toBe('2025-07-16');
  });
});

describe('msUntilNextDailyMidnight', () => {
  it('counts down to next Berlin midnight (winter)', () => {
    // 22:00 UTC = 23:00 Berlin → 1h
    expect(msUntilNextDailyMidnight(new Date('2025-01-15T22:00:00Z'))).toBe(60 * 60 * 1000);
  });
  it('counts down to next Berlin midnight (summer DST)', () => {
    // 21:00 UTC = 23:00 Berlin → 1h
    expect(msUntilNextDailyMidnight(new Date('2025-07-15T21:00:00Z'))).toBe(60 * 60 * 1000);
  });
});

describe('getDailyConfig', () => {
  it('is deterministic for the same date', () => {
    const d = new Date('2025-04-20T08:00:00Z');
    const a = getDailyConfig(d);
    const b = getDailyConfig(d);
    expect(a).toEqual(b);
  });

  it('returns valid codeLength between 3 and 6', () => {
    const c = getDailyConfig(new Date('2025-01-01T00:00:00Z'));
    expect(c.codeLength).toBeGreaterThanOrEqual(3);
    expect(c.codeLength).toBeLessThanOrEqual(6);
  });

  it('secret length matches codeLength', () => {
    for (let day = 1; day <= 10; day++) {
      const c = getDailyConfig(new Date(`2025-05-${String(day).padStart(2, '0')}T00:00:00Z`));
      expect(c.secret).toHaveLength(c.codeLength);
    }
  });

  it('secret has no duplicates when allowDuplicates is false', () => {
    // Test many dates to find one without duplicates
    for (let day = 1; day <= 30; day++) {
      const c = getDailyConfig(new Date(`2025-06-${String(day).padStart(2, '0')}T00:00:00Z`));
      if (!c.allowDuplicates) {
        expect(new Set(c.secret).size).toBe(c.codeLength);
      }
    }
  });

  it('maxTries is capped at 15', () => {
    for (let day = 1; day <= 30; day++) {
      const c = getDailyConfig(new Date(`2025-07-${String(day).padStart(2, '0')}T00:00:00Z`));
      expect(c.maxTries).toBeLessThanOrEqual(15);
      expect(c.maxTries).toBeGreaterThanOrEqual(5);
    }
  });

  it('different dates produce different configs', () => {
    const a = getDailyConfig(new Date('2025-01-01T00:00:00Z'));
    const b = getDailyConfig(new Date('2025-01-02T00:00:00Z'));
    // At least the date should differ
    expect(a.date).not.toBe(b.date);
  });
});

// ─── Closeness computation (extracted logic) ─────────────────────

describe('closeness computation', () => {
  // Mirror the computeCloseness function from Daily.tsx
  function computeCloseness(
    entries: { feedback: { matches: number; shifts: number } }[],
    didWin: boolean,
    codeLength: number,
  ): number {
    if (entries.length === 0) return 0;
    let bestScore = 0;
    let sumScores = 0;
    for (const h of entries) {
      const score = h.feedback.matches + 0.5 * h.feedback.shifts;
      if (score > bestScore) bestScore = score;
      sumScores += score;
    }
    const bestPct = (bestScore / codeLength) * 100;
    const avgPct = (sumScores / entries.length / codeLength) * 100;
    const pct = Math.round((bestPct + avgPct) / 2);
    return didWin ? 100 : Math.min(99, pct);
  }

  it('returns 100 for a win regardless of guess quality', () => {
    const entries = [
      { feedback: { matches: 0, shifts: 0 } },
      { feedback: { matches: 4, shifts: 0 } },
    ];
    expect(computeCloseness(entries, true, 4)).toBe(100);
  });

  it('caps at 99 for a loss even if best guess was perfect', () => {
    // Scenario: user got 4/4 matches on one guess but somehow lost (edge case)
    const entries = [
      { feedback: { matches: 4, shifts: 0 } },
    ];
    expect(computeCloseness(entries, false, 4)).toBe(99);
  });

  it('returns 0 for empty entries', () => {
    expect(computeCloseness([], false, 4)).toBe(0);
  });

  it('correctly averages best and mean', () => {
    // 4-digit code. Two guesses:
    // Guess 1: 2 matches, 1 shift → score = 2.5 → 62.5%
    // Guess 2: 3 matches, 0 shifts → score = 3.0 → 75%
    // Best = 75%, Avg = (62.5+75)/2 = 68.75%
    // Final = (75 + 68.75) / 2 = 71.875 → 72%
    const entries = [
      { feedback: { matches: 2, shifts: 1 } },
      { feedback: { matches: 3, shifts: 0 } },
    ];
    expect(computeCloseness(entries, false, 4)).toBe(72);
  });

  it('handles all-zero feedback (no matches or shifts)', () => {
    const entries = [
      { feedback: { matches: 0, shifts: 0 } },
      { feedback: { matches: 0, shifts: 0 } },
    ];
    expect(computeCloseness(entries, false, 4)).toBe(0);
  });

  it('shifts contribute half weight', () => {
    // 4-digit, 1 guess: 0 matches, 4 shifts → score = 2 → 50%
    // best = avg = 50%, final = 50%
    const entries = [{ feedback: { matches: 0, shifts: 4 } }];
    expect(computeCloseness(entries, false, 4)).toBe(50);
  });
});

// ─── buildShareGrid ──────────────────────────────────────────────

describe('buildShareGrid', () => {
  it('maps statuses to correct emojis', () => {
    const result = buildShareGrid([
      { matches: 2, shifts: 1, glitches: 1, statuses: ['match', 'shift', 'glitch', 'match'] },
    ]);
    expect(result).toBe('🟢🟡🔴🟢');
  });

  it('joins multiple rows with newlines', () => {
    const result = buildShareGrid([
      { matches: 1, shifts: 0, glitches: 2, statuses: ['match', 'glitch', 'glitch'] },
      { matches: 3, shifts: 0, glitches: 0, statuses: ['match', 'match', 'match'] },
    ]);
    expect(result).toBe('🟢🔴🔴\n🟢🟢🟢');
  });
});

// ─── buildShareText ──────────────────────────────────────────────

describe('buildShareText', () => {
  it('includes date, score, closeness, and grid', () => {
    const text = buildShareText({
      date: '2025-04-20',
      won: true,
      attemptsUsed: 3,
      maxTries: 7,
      codeLength: 4,
      allowDuplicates: false,
      closeness: 100,
      grid: '🟢🟢🟢🟢',
      url: 'https://example.com/daily',
    });
    expect(text).toContain('2025-04-20');
    expect(text).toContain('3/7');
    expect(text).toContain('🎯 100%');
    expect(text).toContain('🟢🟢🟢🟢');
    expect(text).toContain('https://example.com/daily');
  });

  it('shows X for a loss', () => {
    const text = buildShareText({
      date: '2025-04-20',
      won: false,
      attemptsUsed: 7,
      maxTries: 7,
      codeLength: 4,
      allowDuplicates: false,
      closeness: 65,
      grid: '🔴🔴🔴🔴',
      url: 'https://example.com/daily',
    });
    expect(text).toContain('X/7');
    expect(text).toContain('🎯 65%');
  });

  it('includes (dup) when duplicates are allowed', () => {
    const text = buildShareText({
      date: '2025-04-20',
      won: true,
      attemptsUsed: 5,
      maxTries: 9,
      codeLength: 4,
      allowDuplicates: true,
      closeness: 100,
      grid: '🟢🟢🟢🟢',
      url: 'https://example.com/daily',
    });
    expect(text).toContain('(dup)');
  });
});

// ─── Local storage streak ────────────────────────────────────────

describe('local storage daily records', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for no record', () => {
    expect(getLocalDailyRecord('2025-01-01')).toBeNull();
  });

  it('saves and retrieves a record', () => {
    saveLocalDailyRecord({
      date: '2025-01-01',
      won: true,
      attemptsUsed: 3,
      guesses: [[1, 2, 3, 4]],
      closeness: 100,
    });
    const rec = getLocalDailyRecord('2025-01-01');
    expect(rec).not.toBeNull();
    expect(rec!.won).toBe(true);
    expect(rec!.closeness).toBe(100);
  });

  it('tracks streak for consecutive wins', () => {
    saveLocalDailyRecord({ date: '2025-01-01', won: true, attemptsUsed: 3, guesses: [], closeness: 100 });
    saveLocalDailyRecord({ date: '2025-01-02', won: true, attemptsUsed: 4, guesses: [], closeness: 100 });
    saveLocalDailyRecord({ date: '2025-01-03', won: true, attemptsUsed: 2, guesses: [], closeness: 100 });

    // getLocalStreak checks against "today", so we mock date to Jan 3
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-03T12:00:00Z'));
    const streak = getLocalStreak();
    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    expect(streak.played).toBe(3);
    expect(streak.won).toBe(3);
    vi.useRealTimers();
  });

  it('resets streak on a loss', () => {
    saveLocalDailyRecord({ date: '2025-01-01', won: true, attemptsUsed: 3, guesses: [], closeness: 100 });
    saveLocalDailyRecord({ date: '2025-01-02', won: false, attemptsUsed: 7, guesses: [], closeness: 50 });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-02T12:00:00Z'));
    const streak = getLocalStreak();
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(1);
    expect(streak.played).toBe(2);
    expect(streak.won).toBe(1);
    vi.useRealTimers();
  });

  it('does not overwrite existing record for the same date', () => {
    saveLocalDailyRecord({ date: '2025-01-01', won: true, attemptsUsed: 3, guesses: [[1]], closeness: 100 });
    saveLocalDailyRecord({ date: '2025-01-01', won: false, attemptsUsed: 7, guesses: [[2]], closeness: 50 });
    const rec = getLocalDailyRecord('2025-01-01');
    expect(rec!.won).toBe(true); // first record preserved
  });
});
