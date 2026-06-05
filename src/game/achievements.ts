// Hacking/vault-breaking themed achievements

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_breach',
    name: 'First Breach',
    description: 'Crack your first vault online.',
    icon: '🔓',
    rarity: 'common',
  },
  {
    id: 'cipher_initiate',
    name: 'Cipher Initiate',
    description: 'Solve your first Daily Puzzle.',
    icon: '🗝️',
    rarity: 'common',
  },
  {
    id: 'silent_intrusion',
    name: 'Silent Intrusion',
    description: 'Win an online match in 5 guesses or fewer.',
    icon: '🥷',
    rarity: 'rare',
  },
  {
    id: 'safecracker',
    name: 'Safecracker',
    description: 'Win 10 online matches.',
    icon: '💼',
    rarity: 'rare',
  },
  {
    id: 'vault_master',
    name: 'Vault Master',
    description: 'Win 25 online matches.',
    icon: '🏦',
    rarity: 'epic',
  },
  {
    id: 'ghost_protocol',
    name: 'Ghost Protocol',
    description: 'Win 5 online matches in a row.',
    icon: '👻',
    rarity: 'epic',
  },
  {
    id: 'zero_day',
    name: 'Zero Day',
    description: 'Solve a Daily Puzzle in 3 tries or fewer.',
    icon: '⚡',
    rarity: 'rare',
  },
  {
    id: 'streak_hacker',
    name: 'Streak Hacker',
    description: 'Reach a 7-day Daily Puzzle streak.',
    icon: '🔥',
    rarity: 'epic',
  },
  {
    id: 'black_hat',
    name: 'Black Hat',
    description: 'Reach a 30-day Daily Puzzle streak.',
    icon: '🎩',
    rarity: 'legendary',
  },
  {
    id: 'mainframe_breaker',
    name: 'Mainframe Breaker',
    description: 'Crack a 6-digit vault.',
    icon: '🖥️',
    rarity: 'rare',
  },
  {
    id: 'kernel_panic',
    name: 'Kernel Panic',
    description: 'Win an online match against an opponent with duplicate digits.',
    icon: '💥',
    rarity: 'rare',
  },
  {
    id: 'ice_breaker',
    name: 'ICE Breaker',
    description: 'Win 50 online matches.',
    icon: '🧊',
    rarity: 'legendary',
  },
];

export interface UnlockContext {
  onlineWins: number;
  onlineMatches: Array<{
    won: boolean;
    guessCount?: number;
    codeLength: number;
    allowDuplicates?: boolean;
    finishedAt: string | null;
  }>;
  currentWinStreak: number;
  dailyWins: number;
  dailyBestGuessCount: number; // lowest attempts to win any daily
  dailyCurrentStreak: number;
  dailyBestStreak: number;
}

/** Returns ids of achievements that should be unlocked based on ctx. */
export function evaluate(ctx: UnlockContext): string[] {
  const out: string[] = [];
  if (ctx.onlineWins >= 1) out.push('first_breach');
  if (ctx.dailyWins >= 1) out.push('cipher_initiate');
  if (ctx.onlineMatches.some((m) => m.won && (m.guessCount ?? 99) <= 5)) out.push('silent_intrusion');
  if (ctx.onlineWins >= 10) out.push('safecracker');
  if (ctx.onlineWins >= 25) out.push('vault_master');
  if (ctx.onlineWins >= 50) out.push('ice_breaker');
  if (ctx.currentWinStreak >= 5) out.push('ghost_protocol');
  if (ctx.dailyBestGuessCount > 0 && ctx.dailyBestGuessCount <= 3) out.push('zero_day');
  if (ctx.dailyBestStreak >= 7 || ctx.dailyCurrentStreak >= 7) out.push('streak_hacker');
  if (ctx.dailyBestStreak >= 30 || ctx.dailyCurrentStreak >= 30) out.push('black_hat');
  if (ctx.onlineMatches.some((m) => m.won && m.codeLength >= 6)) out.push('mainframe_breaker');
  if (ctx.onlineMatches.some((m) => m.won && m.allowDuplicates)) out.push('kernel_panic');
  return out;
}

export const rarityClass: Record<Achievement['rarity'], string> = {
  common: 'border-muted-foreground/40 text-muted-foreground',
  rare: 'border-secondary/60 text-secondary',
  epic: 'border-warning/60 text-warning',
  legendary: 'border-primary/70 text-primary',
};
