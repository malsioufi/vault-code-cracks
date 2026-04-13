export interface GameConfig {
  codeLength: number;
  allowDuplicates: boolean;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  botMode: 'active' | 'passive';
  maxTries: number | null; // null = unlimited
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

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      matches++;
    } else {
      secretCounts.set(secret[i], (secretCounts.get(secret[i]) || 0) + 1);
      guessCounts.set(guess[i], (guessCounts.get(guess[i]) || 0) + 1);
    }
  }

  for (const [digit, count] of guessCounts) {
    if (secretCounts.has(digit)) {
      shifts += Math.min(count, secretCounts.get(digit)!);
    }
  }

  const glitches = guess.length - matches - shifts;
  return { matches, shifts, glitches };
}

export function getDigitStatuses(guess: number[], secret: number[]): ('match' | 'shift' | 'glitch')[] {
  const statuses: ('match' | 'shift' | 'glitch')[] = new Array(guess.length).fill('glitch');
  const secretUsed = new Array(secret.length).fill(false);
  const guessUsed = new Array(guess.length).fill(false);

  // First pass: exact matches
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      statuses[i] = 'match';
      secretUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Second pass: shifts
  for (let i = 0; i < guess.length; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < secret.length; j++) {
      if (secretUsed[j]) continue;
      if (guess[i] === secret[j]) {
        statuses[i] = 'shift';
        secretUsed[j] = true;
        break;
      }
    }
  }

  return statuses;
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
