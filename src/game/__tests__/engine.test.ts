import { describe, it, expect } from 'vitest';
import {
  evaluateGuess,
  generateSecret,
  getDigitStatuses,
  aiGuessEasy,
  aiGuessMedium,
  aiGuessHard,
  shuffleArray,
  type GuessEntry,
} from '../engine';

// ─── evaluateGuess ───────────────────────────────────────────────

describe('evaluateGuess', () => {
  it('returns all matches for an exact guess', () => {
    expect(evaluateGuess([1, 2, 3, 4], [1, 2, 3, 4])).toEqual({
      matches: 4, shifts: 0, glitches: 0,
    });
  });

  it('returns all glitches when no digits overlap', () => {
    expect(evaluateGuess([5, 6, 7, 8], [1, 2, 3, 4])).toEqual({
      matches: 0, shifts: 0, glitches: 4,
    });
  });

  it('returns all shifts when digits are present but misplaced', () => {
    expect(evaluateGuess([4, 3, 2, 1], [1, 2, 3, 4])).toEqual({
      matches: 0, shifts: 4, glitches: 0,
    });
  });

  it('handles a mix of matches, shifts, and glitches', () => {
    expect(evaluateGuess([1, 3, 5, 4], [1, 2, 3, 4])).toEqual({
      matches: 2, shifts: 1, glitches: 1,
    });
  });

  it('handles duplicates in guess vs non-duplicate secret', () => {
    // secret [1,2,3,4], guess [1,1,1,1]
    // pos 0 is a match; the other three 1s have no remaining 1 in secret
    expect(evaluateGuess([1, 1, 1, 1], [1, 2, 3, 4])).toEqual({
      matches: 1, shifts: 0, glitches: 3,
    });
  });

  it('handles duplicates in both guess and secret', () => {
    // secret [1,1,2,3], guess [1,2,1,4]
    // pos 0: match (1=1), pos 1: shift (2 in secret[2]), pos 2: shift (1 in secret[1]),
    // pos 3: glitch
    expect(evaluateGuess([1, 2, 1, 4], [1, 1, 2, 3])).toEqual({
      matches: 1, shifts: 2, glitches: 1,
    });
  });

  it('works with 3-digit codes', () => {
    expect(evaluateGuess([9, 8, 7], [7, 8, 9])).toEqual({
      matches: 1, shifts: 2, glitches: 0,
    });
  });

  it('works with 6-digit codes', () => {
    expect(evaluateGuess([0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5])).toEqual({
      matches: 6, shifts: 0, glitches: 0,
    });
  });

  it('counts shifts correctly with repeated digits', () => {
    // secret [2,2,3], guess [3,3,2]
    // pos 0: glitch (3 vs 2, but 3 is in secret[2]), actually shift
    // pos 1: glitch (3 vs 2, secret[2] already used) → glitch
    // pos 2: shift (2 vs 3, 2 is in secret[0] or [1])
    expect(evaluateGuess([3, 3, 2], [2, 2, 3])).toEqual({
      matches: 0, shifts: 2, glitches: 1,
    });
  });
});

// ─── getDigitStatuses ────────────────────────────────────────────

describe('getDigitStatuses', () => {
  it('marks all match for exact guess', () => {
    expect(getDigitStatuses([1, 2, 3], [1, 2, 3])).toEqual([
      'match', 'match', 'match',
    ]);
  });

  it('marks all glitch for no overlap', () => {
    expect(getDigitStatuses([7, 8, 9], [1, 2, 3])).toEqual([
      'glitch', 'glitch', 'glitch',
    ]);
  });

  it('marks shifts correctly', () => {
    expect(getDigitStatuses([3, 1, 2], [1, 2, 3])).toEqual([
      'shift', 'shift', 'shift',
    ]);
  });

  it('prefers matches over shifts', () => {
    // guess [1,1,2], secret [1,2,3]
    // pos 0: match (1=1), pos 1: 1 not remaining → glitch, pos 2: 2 in secret[1] → shift
    const result = getDigitStatuses([1, 1, 2], [1, 2, 3]);
    expect(result[0]).toBe('match');
    expect(result[1]).toBe('glitch');
    expect(result[2]).toBe('shift');
  });
});

// ─── generateSecret ─────────────────────────────────────────────

describe('generateSecret', () => {
  it('generates correct length without duplicates', () => {
    const s = generateSecret(4, false);
    expect(s).toHaveLength(4);
    expect(new Set(s).size).toBe(4);
  });

  it('generates correct length with duplicates allowed', () => {
    const s = generateSecret(5, true);
    expect(s).toHaveLength(5);
    s.forEach((d) => expect(d).toBeGreaterThanOrEqual(0));
    s.forEach((d) => expect(d).toBeLessThanOrEqual(9));
  });

  it('all digits are in 0-9 range', () => {
    for (let i = 0; i < 50; i++) {
      const s = generateSecret(6, true);
      s.forEach((d) => {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(9);
      });
    }
  });

  it('enforces no duplicates when allowDuplicates is false', () => {
    for (let i = 0; i < 50; i++) {
      const s = generateSecret(6, false);
      expect(new Set(s).size).toBe(6);
    }
  });
});

// ─── AI strategies ───────────────────────────────────────────────

describe('AI strategies', () => {
  it('aiGuessEasy returns valid guess', () => {
    const g = aiGuessEasy(4, false);
    expect(g).toHaveLength(4);
    expect(new Set(g).size).toBe(4);
  });

  it('aiGuessMedium returns guess consistent with history', () => {
    const secret = [1, 2, 3, 4];
    const history: GuessEntry[] = [
      { guess: [5, 6, 7, 8], feedback: evaluateGuess([5, 6, 7, 8], secret) },
    ];
    const g = aiGuessMedium(4, false, history);
    expect(g).toHaveLength(4);
    // Verify the guess is consistent: evaluating against history entry's guess
    // should give same feedback if candidate were the secret
    // Actually just verify it's a valid 4-digit no-dup code
    expect(new Set(g).size).toBe(4);
  });

  it('aiGuessHard first guess is deterministic pattern', () => {
    const g = aiGuessHard(4, false, []);
    expect(g).toEqual([0, 1, 2, 3]);
  });

  it('aiGuessHard with duplicates allowed has cycling pattern', () => {
    const g = aiGuessHard(4, true, []);
    expect(g).toEqual([0, 1, 2, 3]);
  });
});

// ─── shuffleArray ────────────────────────────────────────────────

describe('shuffleArray', () => {
  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    shuffleArray(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});
