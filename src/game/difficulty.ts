// Compute a difficulty tier from puzzle parameters.
// Used by Daily Puzzle and Training to display a clear difficulty badge.

export type DifficultyTier = 'easy' | 'normal' | 'hard' | 'legendary';

export function getDifficultyTier(
  codeLength: number,
  allowDuplicates: boolean,
  maxTries: number | null,
): DifficultyTier {
  // Base score from code length (3..6) and duplicates.
  let s = Math.max(0, (codeLength - 3) * 2) + (allowDuplicates ? 2 : 0);

  // Adjust by tries-to-length ratio (tight = harder, generous = easier).
  if (maxTries !== null) {
    const ratio = maxTries / codeLength;
    if (ratio < 1.5) s += 2;
    else if (ratio > 2.8) s -= 1;
  }

  if (s <= 2) return 'easy';
  if (s <= 5) return 'normal';
  if (s <= 7) return 'hard';
  return 'legendary';
}

export const TIER_COLOR: Record<DifficultyTier, string> = {
  easy: 'text-primary',
  normal: 'text-secondary',
  hard: 'text-warning',
  legendary: 'text-destructive',
};
