import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useDailyPuzzle } from '@/hooks/useDailyPuzzle';
import {
  buildShareGrid,
  buildShareText,
  msUntilNextUtcMidnight,
} from '@/game/dailyPuzzle';
import { evaluateGuess, getDigitStatuses, type GuessEntry } from '@/game/engine';
import DigitInput from '@/components/game/DigitInput';
import GuessHistory from '@/components/game/GuessHistory';
import DailyLeaderboard from '@/components/game/DailyLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import LanguageToggle from '@/components/LanguageToggle';

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const Daily: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
  const { user } = useAuth();
  const { config, todayRecord, stats, loading, isSignedIn, saveResult } = useDailyPuzzle();
  const [history, setHistory] = useState<GuessEntry[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [countdown, setCountdown] = useState(msUntilNextUtcMidnight());

  // Hydrate from existing record (already played today).
  // Only hydrate ONCE, after the data hook finishes loading and BEFORE the
  // user has submitted any guess locally. After that, we never overwrite
  // local history — otherwise an effect re-run could replace freshly-submitted
  // feedback with a recomputed snapshot, which historically showed up as the
  // result table looking "shifted by one row".
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    if (loading) return;
    if (history.length > 0) return;
    if (todayRecord) {
      const rebuilt: GuessEntry[] = todayRecord.guesses.map((g) => ({
        guess: g,
        feedback: evaluateGuess(g, config.secret),
      }));
      setHistory(rebuilt);
      setGameOver(true);
      setWon(todayRecord.won);
    }
    setHydrated(true);
  }, [loading, todayRecord, config.secret, hydrated, history.length]);

  // Live countdown
  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilNextUtcMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  const triesLeft = config.maxTries - history.length;

  // Closeness across an arbitrary list of guesses, given a known win flag.
  // Per-guess score = (matches + 0.5 * shifts) / codeLength.
  // Final closeness = average of (best score, mean score across all guesses).
  // 100% only on wins; otherwise capped at 99%.
  const computeCloseness = (
    entries: GuessEntry[],
    didWin: boolean,
    codeLength: number,
  ): number => {
    if (entries.length === 0) return 0;
    let bestScore = 0;
    let sumScores = 0;
    for (const h of entries) {
      const score = h.feedback.matches + 0.5 * h.feedback.shifts;
      if (score > bestScore) bestScore = score;
      sumScores += score;
    }
    const bestPct = (bestScore / codeLength) * 100;
    const avgPct = (sumScores / entries.length / codeLength) * 100;
    const pct = Math.round((bestPct + avgPct) / 2);
    return didWin ? 100 : Math.min(99, pct);
  };

  const handleGuess = (digits: number[]) => {
    if (gameOver) return;
    const feedback = evaluateGuess(digits, config.secret);
    const next = [...history, { guess: digits, feedback }];
    setHistory(next);

    if (feedback.matches === config.codeLength) {
      setGameOver(true);
      setWon(true);
      const c = computeCloseness(next, true, config.codeLength);
      void saveResult(true, next.map((e) => e.guess), c);
    } else if (next.length >= config.maxTries) {
      setGameOver(true);
      setWon(false);
      const c = computeCloseness(next, false, config.codeLength);
      void saveResult(false, next.map((e) => e.guess), c);
    }
  };

  // Live closeness for the UI (mirrors the same formula).
  const closeness = useMemo(
    () => computeCloseness(history, won, config.codeLength),
    [history, config.codeLength, won],
  );

  const shareText = useMemo(() => {
    if (!gameOver) return '';
    const grid = buildShareGrid(
      history.map((h) => ({
        matches: h.feedback.matches,
        shifts: h.feedback.shifts,
        glitches: h.feedback.glitches,
        statuses: getDigitStatuses(h.guess, config.secret),
      })),
    );
    return buildShareText({
      date: config.date,
      won,
      attemptsUsed: history.length,
      maxTries: config.maxTries,
      codeLength: config.codeLength,
      allowDuplicates: config.allowDuplicates,
      closeness,
      grid,
      url: `${window.location.origin}/daily`,
    });
  }, [gameOver, history, config, won, closeness]);

  const handleShare = async () => {
    if (!shareText) return;
    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success(t('shareCopied'));
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success(t('shareCopied'));
      } catch {
        toast.error(t('shareFailed'));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-muted-foreground">…</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center px-4 pt-4 pb-2 overflow-hidden">
      {/* Language Toggle */}
      <div className="fixed top-4 end-4 z-50">
        <LanguageToggle />
      </div>

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-2 mt-1 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
        >
          ← {t('backToMenu')}
        </button>
        <div className="font-mono text-xs text-muted-foreground">{config.date} UTC</div>
      </div>

      {/* Title */}
      <div className="w-full max-w-md text-center mb-2 shrink-0">
        <h1 className="font-mono text-xl font-bold text-secondary text-glow-secondary">
          {t('dailyPuzzle')}
        </h1>
      </div>

      {/* Compact info strip: settings + streak collapsed into one row */}
      <div className="w-full max-w-md mb-2 p-2 rounded-lg bg-card cyber-border shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground">
            {t('codeLength')}: <span className="text-primary font-bold">{config.codeLength}</span>
          </span>
          <span className="text-muted-foreground">
            {t('allowDuplicates')}:{' '}
            <span className={config.allowDuplicates ? 'text-warning font-bold' : 'text-muted-foreground'}>
              {config.allowDuplicates ? t('on') : t('off')}
            </span>
          </span>
          <span className="text-muted-foreground">
            {t('maxTries')}: <span className="text-primary font-bold">{config.maxTries}</span>
          </span>
          <span className="text-muted-foreground">
            🔥 <span className="text-primary font-bold">{stats.current}</span>
            <span className="opacity-60"> / {stats.best}</span>
          </span>
        </div>
        {!isSignedIn && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground text-center">
            {t('signInForCloudStreak')}{' '}
            <button onClick={() => navigate('/auth')} className="text-secondary underline">
              {t('signIn')}
            </button>
          </p>
        )}
      </div>

      {/* History — scrollable, takes remaining space, always visible above input.
          Reserves bottom space (~190px) so the fixed input never covers the latest row. */}
      <div
        className="w-full max-w-md flex-1 min-h-0 overflow-y-auto mb-2"
        style={{ paddingBottom: !gameOver && triesLeft > 0 ? '190px' : undefined }}
      >
        {history.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground text-center py-6">
            {t('attempt')} 1/{config.maxTries}
          </p>
        ) : (
          <GuessHistory
            history={history}
            codeLength={config.codeLength}
            secret={config.secret}
            gameOver={gameOver}
          />
        )}
      </div>

      {/* Game over panel */}
      {gameOver && (
        <div className="w-full max-w-md mb-2 p-4 rounded-lg bg-card cyber-border text-center scanline shrink-0">
          <h2 className={`font-mono text-lg font-bold mb-2 ${won ? 'text-primary text-glow-primary' : 'text-destructive'}`}>
            {won ? t('youWin') : t('youLose')}
          </h2>
          <div className="mb-3">
            <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground mb-1">
              <span>{t('closeness')}</span>
              <span className={`font-bold ${won ? 'text-primary' : 'text-warning'}`}>{closeness}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden cyber-border">
              <div
                className={`h-full transition-all ${won ? 'bg-primary' : 'bg-warning'}`}
                style={{ width: `${closeness}%` }}
              />
            </div>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground mb-1">{t('secretWas')}:</p>
          <div className="flex gap-1.5 justify-center mb-2">
            {config.secret.map((d, i) => (
              <span
                key={i}
                className="w-8 h-8 flex items-center justify-center rounded bg-primary text-primary-foreground font-mono text-sm font-bold"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mb-2">
            {t('nextPuzzleIn')}:{' '}
            <span className="text-secondary text-glow-secondary">{formatCountdown(countdown)}</span>
          </div>
          <button
            onClick={handleShare}
            className="w-full py-2 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm font-bold glow-secondary hover:opacity-90 transition-all"
          >
            📋 {t('shareResult')}
          </button>
        </div>
      )}

      {/* Input pinned to bottom so history above always stays visible */}
      {/* Input fixed to viewport bottom so it stays above the OS keyboard
          and doesn't push the history out of view when focused. */}
      {!gameOver && triesLeft > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-2 pb-3">
          <div className="w-full max-w-md mx-auto">
            <div className="flex justify-between font-mono text-xs text-muted-foreground mb-2">
              <span>{t('attempt')} {history.length + 1}/{config.maxTries}</span>
              <span className="text-warning">{triesLeft} {t('turnsLeft')}</span>
            </div>
            <DigitInput
              codeLength={config.codeLength}
              allowDuplicates={config.allowDuplicates}
              onSubmit={handleGuess}
              disabled={gameOver}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Daily;
