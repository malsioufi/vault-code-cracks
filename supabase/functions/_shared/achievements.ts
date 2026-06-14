// Hacking/vault-breaking themed achievements

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** Human-readable criteria explanation */
  criteria: string;
  /** Compute progress toward unlock */
  progress: (ctx: UnlockContext) => { current: number; target: number };
}

export interface UnlockContext {
  onlineWins: number;
  onlineMatches: Array<{
    won: boolean;
    guessCount?: number;
    codeLength: number;
    allowDuplicates?: boolean;
    finishedAt: string | null;
    mode?: 'turn_based' | 'simultaneous' | 'battle_royale';
    playerCount?: number;
  }>;
  currentWinStreak: number;
  dailyWins: number;
  dailyBestGuessCount: number; // lowest attempts to win any daily
  dailyCurrentStreak: number;
  dailyBestStreak: number;
  battleRoyalePlays: number;
  battleRoyaleWins: number;
  battleRoyaleBiggestWin: number;
}

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

const minWinGuesses = (ctx: UnlockContext) =>
  ctx.onlineMatches
    .filter((m) => m.won && typeof m.guessCount === 'number')
    .reduce((acc, m) => Math.min(acc, m.guessCount as number), Infinity);

const maxWonCodeLen = (ctx: UnlockContext) =>
  ctx.onlineMatches.filter((m) => m.won).reduce((acc, m) => Math.max(acc, m.codeLength), 0);

const wonWithDuplicates = (ctx: UnlockContext) =>
  ctx.onlineMatches.some((m) => m.won && m.allowDuplicates);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_breach',
    name: 'First Breach',
    description: 'Crack your first vault online.',
    criteria: 'Win 1 online match.',
    icon: '🔓',
    rarity: 'common',
    progress: (c) => ({ current: clamp(c.onlineWins, 1), target: 1 }),
  },
  {
    id: 'cipher_initiate',
    name: 'Cipher Initiate',
    description: 'Solve your first Daily Puzzle.',
    criteria: 'Win 1 Daily Puzzle.',
    icon: '🗝️',
    rarity: 'common',
    progress: (c) => ({ current: clamp(c.dailyWins, 1), target: 1 }),
  },
  {
    id: 'script_kiddie',
    name: 'Script Kiddie',
    description: 'Take your first steps into the network.',
    criteria: 'Win 3 online matches.',
    icon: '🐣',
    rarity: 'common',
    progress: (c) => ({ current: clamp(c.onlineWins, 3), target: 3 }),
  },
  {
    id: 'silent_intrusion',
    name: 'Silent Intrusion',
    description: 'Slip past defenses unnoticed.',
    criteria: 'Win an online match in 5 guesses or fewer.',
    icon: '🥷',
    rarity: 'rare',
    progress: (c) => {
      const m = minWinGuesses(c);
      const has = m <= 5 ? 1 : 0;
      return { current: has, target: 1 };
    },
  },
  {
    id: 'safecracker',
    name: 'Safecracker',
    description: 'Veteran of countless break-ins.',
    criteria: 'Win 10 online matches.',
    icon: '💼',
    rarity: 'rare',
    progress: (c) => ({ current: clamp(c.onlineWins, 10), target: 10 }),
  },
  {
    id: 'vault_master',
    name: 'Vault Master',
    description: 'Few vaults can resist you now.',
    criteria: 'Win 25 online matches.',
    icon: '🏦',
    rarity: 'epic',
    progress: (c) => ({ current: clamp(c.onlineWins, 25), target: 25 }),
  },
  {
    id: 'ice_breaker',
    name: 'ICE Breaker',
    description: 'Shatter the toughest counter-intrusions.',
    criteria: 'Win 50 online matches.',
    icon: '🧊',
    rarity: 'legendary',
    progress: (c) => ({ current: clamp(c.onlineWins, 50), target: 50 }),
  },
  {
    id: 'cyber_legend',
    name: 'Cyber Legend',
    description: 'Your handle echoes through the net.',
    criteria: 'Win 100 online matches.',
    icon: '🏆',
    rarity: 'legendary',
    progress: (c) => ({ current: clamp(c.onlineWins, 100), target: 100 }),
  },
  {
    id: 'ghost_protocol',
    name: 'Ghost Protocol',
    description: 'Vanish into the data stream.',
    criteria: 'Win 5 online matches in a row.',
    icon: '👻',
    rarity: 'epic',
    progress: (c) => ({ current: clamp(c.currentWinStreak, 5), target: 5 }),
  },
  {
    id: 'untraceable',
    name: 'Untraceable',
    description: 'No log can catch you.',
    criteria: 'Win 10 online matches in a row.',
    icon: '🛡️',
    rarity: 'legendary',
    progress: (c) => ({ current: clamp(c.currentWinStreak, 10), target: 10 }),
  },
  {
    id: 'zero_day',
    name: 'Zero Day',
    description: 'Drop an unstoppable exploit.',
    criteria: 'Solve a Daily Puzzle in 3 tries or fewer.',
    icon: '⚡',
    rarity: 'rare',
    progress: (c) => {
      const has = c.dailyBestGuessCount > 0 && c.dailyBestGuessCount <= 3 ? 1 : 0;
      return { current: has, target: 1 };
    },
  },
  {
    id: 'one_shot',
    name: 'One Shot',
    description: 'A single keystroke, total ownage.',
    criteria: 'Solve a Daily Puzzle in 1 try.',
    icon: '🎯',
    rarity: 'legendary',
    progress: (c) => {
      const has = c.dailyBestGuessCount === 1 ? 1 : 0;
      return { current: has, target: 1 };
    },
  },
  {
    id: 'streak_hacker',
    name: 'Streak Hacker',
    description: 'Daily discipline pays off.',
    criteria: 'Reach a 7-day Daily Puzzle streak.',
    icon: '🔥',
    rarity: 'epic',
    progress: (c) => ({
      current: clamp(Math.max(c.dailyBestStreak, c.dailyCurrentStreak), 7),
      target: 7,
    }),
  },
  {
    id: 'black_hat',
    name: 'Black Hat',
    description: 'Notorious in the underground.',
    criteria: 'Reach a 30-day Daily Puzzle streak.',
    icon: '🎩',
    rarity: 'legendary',
    progress: (c) => ({
      current: clamp(Math.max(c.dailyBestStreak, c.dailyCurrentStreak), 30),
      target: 30,
    }),
  },
  {
    id: 'daily_grinder',
    name: 'Daily Grinder',
    description: 'Show up. Decode. Repeat.',
    criteria: 'Win 10 Daily Puzzles.',
    icon: '📅',
    rarity: 'rare',
    progress: (c) => ({ current: clamp(c.dailyWins, 10), target: 10 }),
  },
  {
    id: 'patch_hunter',
    name: 'Patch Hunter',
    description: 'Patience over panic.',
    criteria: 'Win 25 Daily Puzzles.',
    icon: '🩹',
    rarity: 'epic',
    progress: (c) => ({ current: clamp(c.dailyWins, 25), target: 25 }),
  },
  {
    id: 'mainframe_breaker',
    name: 'Mainframe Breaker',
    description: 'Bigger codes don\'t scare you.',
    criteria: 'Crack a 6-digit vault online.',
    icon: '🖥️',
    rarity: 'rare',
    progress: (c) => {
      const has = maxWonCodeLen(c) >= 6 ? 1 : 0;
      return { current: has, target: 1 };
    },
  },
  {
    id: 'quantum_cracker',
    name: 'Quantum Cracker',
    description: 'Crack codes most can\'t even read.',
    criteria: 'Crack a 7-digit vault online.',
    icon: '⚛️',
    rarity: 'epic',
    progress: (c) => {
      const has = maxWonCodeLen(c) >= 7 ? 1 : 0;
      return { current: has, target: 1 };
    },
  },
  {
    id: 'kernel_panic',
    name: 'Kernel Panic',
    description: 'Beat duplicate-digit chaos.',
    criteria: 'Win an online match with duplicate digits allowed.',
    icon: '💥',
    rarity: 'rare',
    progress: (c) => ({ current: wonWithDuplicates(c) ? 1 : 0, target: 1 }),
  },
  {
    id: 'brute_force',
    name: 'Brute Force',
    description: 'Endurance over elegance.',
    criteria: 'Play 25 online matches.',
    icon: '🔨',
    rarity: 'common',
    progress: (c) => ({ current: clamp(c.onlineMatches.length, 25), target: 25 }),
  },
  {
    id: 'firewall_burner',
    name: 'Firewall Burner',
    description: 'Heat up the wire.',
    criteria: 'Win 3 online matches in a row.',
    icon: '🧨',
    rarity: 'rare',
    progress: (c) => ({ current: clamp(c.currentWinStreak, 3), target: 3 }),
  },
  {
    id: 'root_access',
    name: 'Root Access',
    description: 'The system is yours.',
    criteria: 'Win an online match in 3 guesses or fewer.',
    icon: '🪤',
    rarity: 'epic',
    progress: (c) => {
      const m = minWinGuesses(c);
      const has = m <= 3 ? 1 : 0;
      return { current: has, target: 1 };
    },
  },
  {
    id: 'social_engineer',
    name: 'Social Engineer',
    description: 'Comeback artist.',
    criteria: 'Win an online match after losing one.',
    icon: '🎭',
    rarity: 'common',
    progress: (c) => {
      // Matches are ordered desc by finishedAt; a "comeback" exists if any (won) is immediately followed (later in array) by a (lost) one
      let has = 0;
      for (let i = 0; i < c.onlineMatches.length - 1; i++) {
        const newer = c.onlineMatches[i];
        const older = c.onlineMatches[i + 1];
        if (newer.won && older.finishedAt && !older.won) { has = 1; break; }
      }
      return { current: has, target: 1 };
    },
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Hack while the world sleeps.',
    criteria: 'Win an online match between 00:00 and 05:00 (local).',
    icon: '🦉',
    rarity: 'rare',
    progress: (c) => {
      const has = c.onlineMatches.some((m) => {
        if (!m.won || !m.finishedAt) return false;
        const h = new Date(m.finishedAt).getHours();
        return h >= 0 && h < 5;
      }) ? 1 : 0;
      return { current: has, target: 1 };
    },
  },
  {
    id: 'phreaker',
    name: 'Phreaker',
    description: 'Old-school respect.',
    criteria: 'Play 5 online matches.',
    icon: '☎️',
    rarity: 'common',
    progress: (c) => ({ current: clamp(c.onlineMatches.length, 5), target: 5 }),
  },
  {
    id: 'pattern_seeker',
    name: 'Pattern Seeker',
    description: 'Persistence pays.',
    criteria: 'Play 10 Daily Puzzles.',
    icon: '🔍',
    rarity: 'common',
    progress: (c) => ({ current: clamp(c.dailyWins, 10), target: 10 }),
  },
  {
    id: 'overclocked',
    name: 'Overclocked',
    description: 'Speed and accuracy.',
    criteria: 'Win an online match in 4 guesses or fewer.',
    icon: '⚙️',
    rarity: 'rare',
    progress: (c) => {
      const m = minWinGuesses(c);
      return { current: m <= 4 ? 1 : 0, target: 1 };
    },
  },
  {
    id: 'rootkit',
    name: 'Rootkit',
    description: 'Embed yourself in the system.',
    criteria: 'Win 75 online matches.',
    icon: '🪲',
    rarity: 'legendary',
    progress: (c) => ({ current: clamp(c.onlineWins, 75), target: 75 }),
  },
  {
    id: 'daily_devotee',
    name: 'Daily Devotee',
    description: 'A true believer in the grind.',
    criteria: 'Win 50 Daily Puzzles.',
    icon: '🗓️',
    rarity: 'legendary',
    progress: (c) => ({ current: clamp(c.dailyWins, 50), target: 50 }),
  },
  {
    id: 'crypto_savant',
    name: 'Crypto Savant',
    description: 'Mind like a cipher.',
    criteria: 'Reach a 14-day Daily Puzzle streak.',
    icon: '🧠',
    rarity: 'epic',
    progress: (c) => ({
      current: clamp(Math.max(c.dailyBestStreak, c.dailyCurrentStreak), 14),
      target: 14,
    }),
  },
  {
    id: 'phantom_breach',
    name: 'Phantom Breach',
    description: 'No trail, no warning.',
    criteria: 'Win an online match in 2 guesses or fewer.',
    icon: '🫥',
    rarity: 'legendary',
    progress: (c) => {
      const m = minWinGuesses(c);
      return { current: m <= 2 ? 1 : 0, target: 1 };
    },
  },
];

/** Returns ids of achievements that should be unlocked based on ctx. */
export function evaluate(ctx: UnlockContext): string[] {
  return ACHIEVEMENTS.filter((a) => {
    const p = a.progress(ctx);
    return p.target > 0 && p.current >= p.target;
  }).map((a) => a.id);
}

export const rarityClass: Record<Achievement['rarity'], string> = {
  common: 'border-muted-foreground/40 text-muted-foreground',
  rare: 'border-secondary/60 text-secondary',
  epic: 'border-warning/60 text-warning',
  legendary: 'border-primary/70 text-primary',
};

export const rarityLabel: Record<Achievement['rarity'], string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};
