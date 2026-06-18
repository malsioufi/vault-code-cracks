// Server-side daily puzzle secret generation (mirror of src/game/dailyPuzzle.ts).
// Keep in sync with the client copy.

const DAILY_TZ = 'Asia/Damascus';

function getZonedParts(d: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    day: Number(parts.day),
  };
}

function strHash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyDateString(d: Date = new Date()): string {
  const { y, m, day } = getZonedParts(d, DAILY_TZ);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function triesFor(codeLength: number, allowDuplicates: boolean): number {
  const base: Record<number, number> = { 3: 5, 4: 7, 5: 9, 6: 11 };
  const t = (base[codeLength] ?? 8) + (allowDuplicates ? 2 : 0);
  return Math.min(15, t);
}

export interface DailyConfig {
  date: string;
  codeLength: number;
  allowDuplicates: boolean;
  maxTries: number;
  secret: number[];
}

export function getDailyConfig(date: Date = new Date()): DailyConfig {
  const dateStr = dailyDateString(date);
  const seed = strHash(`vault-breaker-daily::${dateStr}`);
  const rand = mulberry32(seed);

  const lengths = [3, 4, 5, 6];
  const codeLength = lengths[Math.floor(rand() * lengths.length)];
  const allowDuplicates = rand() < 0.5;
  const maxTries = triesFor(codeLength, allowDuplicates);

  let secret: number[];
  if (allowDuplicates) {
    secret = Array.from({ length: codeLength }, () => Math.floor(rand() * 10));
  } else {
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    secret = digits.slice(0, codeLength);
  }

  return { date: dateStr, codeLength, allowDuplicates, maxTries, secret };
}

export function evaluateGuess(guess: number[], secret: number[]) {
  let matches = 0;
  const secretCount: Record<number, number> = {};
  const guessCount: Record<number, number> = {};
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) {
      matches++;
    } else {
      secretCount[secret[i]] = (secretCount[secret[i]] ?? 0) + 1;
      guessCount[guess[i]] = (guessCount[guess[i]] ?? 0) + 1;
    }
  }
  let shifts = 0;
  for (const d in guessCount) {
    shifts += Math.min(guessCount[d], secretCount[d] ?? 0);
  }
  const glitches = guess.length - matches - shifts;
  return { matches, shifts, glitches };
}

export function closenessPercent(matches: number, shifts: number, codeLength: number): number {
  return Math.round(((matches + shifts * 0.5) / codeLength) * 100);
}
