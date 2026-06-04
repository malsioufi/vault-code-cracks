// Compute a difficulty tier from puzzle parameters.
// Used by Daily Puzzle and Training to display a clear difficulty badge.

export type DifficultyTier = 'easy' | 'normal' | 'hard' | 'legendary';

export function getDifficultyTier(
  codeLength: number,
  allowDuplicates: boolean,
  maxTries: number | null,
): DifficultyTier {
  const score = getDifficultyScore(codeLength, allowDuplicates, maxTries);
  if (score <= 3) return 'easy';
  if (score <= 5) return 'normal';
  if (score <= 7) return 'hard';
  return 'legendary';
}

// Returns a difficulty score from 1 (easy) to 10 (legendary).
export function getDifficultyScore(
  codeLength: number,
  allowDuplicates: boolean,
  maxTries: number | null,
): number {
  // Base score from length: 3 -> 1, 4 -> 3, 5 -> 5, 6 -> 7
  let s = Math.max(0, (codeLength - 3) * 2) + 1;
  if (allowDuplicates) s += 2;
  if (maxTries !== null) {
    const ratio = maxTries / codeLength;
    if (ratio < 1.5) s += 1;
    else if (ratio > 2.8) s -= 1;
  }
  return Math.max(1, Math.min(10, s));
}

export function getDifficultyScoreColor(score: number): string {
  if (score <= 3) return 'text-primary';
  if (score <= 5) return 'text-secondary';
  if (score <= 7) return 'text-warning';
  return 'text-destructive';
}

export const TIER_COLOR: Record<DifficultyTier, string> = {
  easy: 'text-primary',
  normal: 'text-secondary',
  hard: 'text-warning',
  legendary: 'text-destructive',
};
