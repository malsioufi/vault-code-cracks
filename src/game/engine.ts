export interface GameConfig {
  codeLength: number;
  allowDuplicates: boolean;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  botMode: 'active' | 'passive';
}

export interface Feedback {
  matches: number;   // green - right digit right spot
  shifts: number;    // yellow - right digit wrong spot
  glitches: number;  // red - digit not present
}

export interface GuessEntry {
  guess: number[];
  feedback: Feedback;
}

export function generateSecret(length: number, allowDuplicates: boolean): number[] {
  if (allowDuplicates) {
    return Array.from({ length }, () => Math.floor(Math.random() * 10));
  }
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, length);
}

export function evaluateGuess(guess: number[], secret: number[]): Feedback {
  let matches = 0;
  let shifts = 0;
  const secretCounts = new Map<number, number>();
  const guessCounts = new Map<number, number>();

  // First pass: find exact matches
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      matches++;
    } else {
      secretCounts.set(secret[i], (secretCounts.get(secret[i]) || 0) + 1);
      guessCounts.set(guess[i], (guessCounts.get(guess[i]) || 0) + 1);
    }
  }

  // Second pass: find shifts
  for (const [digit, count] of guessCounts) {
    if (secretCounts.has(digit)) {
      shifts += Math.min(count, secretCounts.get(digit)!);
    }
  }

  const glitches = guess.length - matches - shifts;
  return { matches, shifts, glitches };
}

// AI strategies
export function aiGuessEasy(length: number, allowDuplicates: boolean): number[] {
  return generateSecret(length, allowDuplicates);
}

export function aiGuessMedium(
  length: number,
  allowDuplicates: boolean,
  history: GuessEntry[]
): number[] {
  // Try random guesses, filtering out ones that contradict history
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = generateSecret(length, allowDuplicates);
    if (isConsistentWithHistory(candidate, history)) {
      return candidate;
    }
  }
  return generateSecret(length, allowDuplicates);
}

export function aiGuessHard(
  length: number,
  allowDuplicates: boolean,
  history: GuessEntry[]
): number[] {
  if (history.length === 0) {
    // Start with a strategic first guess
    if (allowDuplicates) {
      return Array.from({ length }, (_, i) => i % 10);
    }
    return Array.from({ length }, (_, i) => i);
  }
  return aiGuessMedium(length, allowDuplicates, history);
}

function isConsistentWithHistory(candidate: number[], history: GuessEntry[]): boolean {
  for (const entry of history) {
    const feedback = evaluateGuess(entry.guess, candidate);
    if (
      feedback.matches !== entry.feedback.matches ||
      feedback.shifts !== entry.feedback.shifts
    ) {
      return false;
    }
  }
  return true;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
