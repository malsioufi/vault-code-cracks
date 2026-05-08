// Deterministic daily puzzle generator. Same settings + same secret for all users
// worldwide on the same Europe/Berlin date. Reset at midnight Berlin time
// (handles DST automatically via Intl).

const DAILY_TZ = 'Europe/Berlin';

function getZonedParts(d: Date, timeZone: string): { y: number; m: number; day: number; h: number; min: number; s: number } {
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
    // '24' can occur for midnight in some ICU versions — normalize to 0
    h: Number(parts.hour) % 24,
    min: Number(parts.minute),
    s: Number(parts.second),
  };
}

export interface DailyConfig {
  date: string;          // YYYY-MM-DD (UTC)
  codeLength: number;    // 3..6
  allowDuplicates: boolean;
  maxTries: number;      // capped at 15, scaled to difficulty
  secret: number[];
}

// Stable string hash → 32-bit unsigned int (xmur3-like)
function strHash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // extra mixing
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

// Mulberry32 deterministic PRNG seeded by uint32
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

export function utcDateString(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Daily puzzle date = current calendar date in Europe/Berlin.
export function dailyDateString(d: Date = new Date()): string {
  const { y, m, day } = getZonedParts(d, DAILY_TZ);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function msUntilNextUtcMidnight(now: Date = new Date()): number {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return next.getTime() - now.getTime();
}

// Milliseconds until the next midnight in Europe/Berlin (DST-aware).
export function msUntilNextDailyMidnight(now: Date = new Date()): number {
  const { h, min, s } = getZonedParts(now, DAILY_TZ);
  const elapsedMs = ((h * 3600) + (min * 60) + s) * 1000 + (now.getTime() % 1000);
  const dayMs = 24 * 60 * 60 * 1000;
  return dayMs - elapsedMs;
}

// Difficulty score → reasonable max tries. Cap at 15.
function triesFor(codeLength: number, allowDuplicates: boolean): number {
  // Base on code length; add a couple if duplicates are allowed (harder).
  const base: Record<number, number> = { 3: 5, 4: 7, 5: 9, 6: 11 };
  const t = (base[codeLength] ?? 8) + (allowDuplicates ? 2 : 0);
  return Math.min(15, t);
}

export function getDailyConfig(date: Date = new Date()): DailyConfig {
  const dateStr = dailyDateString(date);
  const seed = strHash(`vault-breaker-daily::${dateStr}`);
  const rand = mulberry32(seed);

  // Pick codeLength from 3..6
  const lengths = [3, 4, 5, 6];
  const codeLength = lengths[Math.floor(rand() * lengths.length)];

  // 50/50 duplicates
  const allowDuplicates = rand() < 0.5;

  const maxTries = triesFor(codeLength, allowDuplicates);

  // Generate the deterministic secret
  let secret: number[];
  if (allowDuplicates) {
    secret = Array.from({ length: codeLength }, () => Math.floor(rand() * 10));
  } else {
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    // Fisher–Yates with seeded rand
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    secret = digits.slice(0, codeLength);
  }

  return { date: dateStr, codeLength, allowDuplicates, maxTries, secret };
}

// Build the share grid (Wordle-style emoji rows) for a finished daily puzzle.
// 🟢 match, 🟡 shift, 🔴 glitch
export function buildShareGrid(
  guesses: { matches: number; shifts: number; glitches: number; statuses: ('match' | 'shift' | 'glitch')[] }[],
): string {
  return guesses
    .map((g) =>
      g.statuses
        .map((s) => (s === 'match' ? '🟢' : s === 'shift' ? '🟡' : '🔴'))
        .join(''),
    )
    .join('\n');
}

export function buildShareText(opts: {
  date: string;
  won: boolean;
  attemptsUsed: number;
  maxTries: number;
  codeLength: number;
  allowDuplicates: boolean;
  closeness: number;
  grid: string;
  url: string;
}): string {
  const score = opts.won ? `${opts.attemptsUsed}/${opts.maxTries}` : `X/${opts.maxTries}`;
  const dup = opts.allowDuplicates ? ' (dup)' : '';
  const close = `🎯 ${opts.closeness}%`;
  return `Vault Breaker — ${opts.date}\n${opts.codeLength}-digit${dup} • ${score} • ${close}\n\n${opts.grid}\n\n${opts.url}`;
}

// ---- Local-only streak storage (for guests / not signed in) ----
const LS_KEY = 'vb.daily.local';

interface LocalRecord {
  date: string;
  won: boolean;
  attemptsUsed: number;
  guesses: number[][];
  closeness?: number;
}
interface LocalState {
  current: number;
  best: number;
  played: number;
  won: number;
  lastDate: string | null;
  records: Record<string, LocalRecord>;
}

function readLocal(): LocalState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as LocalState;
  } catch { /* noop */ }
  return { current: 0, best: 0, played: 0, won: 0, lastDate: null, records: {} };
}

function writeLocal(s: LocalState): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function getLocalDailyRecord(date: string): LocalRecord | null {
  return readLocal().records[date] ?? null;
}

export function saveLocalDailyRecord(rec: LocalRecord): LocalState {
  const s = readLocal();
  if (s.records[rec.date]) return s; // already saved
  s.records[rec.date] = rec;
  s.played += 1;
  if (rec.won) s.won += 1;

  // Streak update
  if (rec.won) {
    const prev = s.lastDate;
    if (prev) {
      const prevDate = new Date(prev + 'T00:00:00Z');
      const curDate = new Date(rec.date + 'T00:00:00Z');
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / 86400000);
      s.current = diffDays === 1 ? s.current + 1 : 1;
    } else {
      s.current = 1;
    }
    if (s.current > s.best) s.best = s.current;
  } else {
    s.current = 0;
  }
  s.lastDate = rec.date;
  writeLocal(s);
  return s;
}

export function getLocalStreak(): { current: number; best: number; played: number; won: number } {
  const s = readLocal();
  // If last play was older than yesterday and not won today, reset current
  const today = utcDateString();
  const yest = utcDateString(new Date(Date.now() - 86400000));
  if (s.lastDate && s.lastDate !== today && s.lastDate !== yest) {
    return { current: 0, best: s.best, played: s.played, won: s.won };
  }
  return { current: s.current, best: s.best, played: s.played, won: s.won };
}
