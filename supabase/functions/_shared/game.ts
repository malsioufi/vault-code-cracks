// Server-side game logic. Never trust client computations.

export interface Feedback {
  matches: number;
  shifts: number;
  glitches: number;
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

  return { matches, shifts, glitches: guess.length - matches - shifts };
}

export function generateRoomCode(): string {
  // No I, O, 0, 1 to avoid ambiguity
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function validateDigits(
  digits: unknown,
  length: number,
  allowDuplicates: boolean,
): number[] | null {
  if (!Array.isArray(digits) || digits.length !== length) return null;
  const arr: number[] = [];
  for (const d of digits) {
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 9) return null;
    arr.push(d);
  }
  if (!allowDuplicates) {
    if (new Set(arr).size !== arr.length) return null;
  }
  return arr;
}
