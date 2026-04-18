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
import { toast } from 'sonner';

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
  const { config, todayRecord, stats, loading, isSignedIn, saveResult } = useDailyPuzzle();
  const [history, setHistory] = useState<GuessEntry[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [countdown, setCountdown] = useState(msUntilNextUtcMidnight());

  // Hydrate from existing record (already played today)
  useEffect(() => {
    if (todayRecord) {
      const rebuilt: GuessEntry[] = todayRecord.guesses.map((g) => ({
        guess: g,
        feedback: evaluateGuess(g, config.secret),
      }));
      setHistory(rebuilt);
      setGameOver(true);
      setWon(todayRecord.won);
    }
  }, [todayRecord, config.secret]);

  // Live countdown
  useEffect(() => {
    const id = setInterval(() => setCountdown(msUntilNextUtcMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  const triesLeft = config.maxTries - history.length;

  const handleGuess = (digits: number[]) => {
    if (gameOver) return;
    const feedback = evaluateGuess(digits, config.secret);
    const next = [...history, { guess: digits, feedback }];
    setHistory(next);

    if (feedback.matches === config.codeLength) {
      setGameOver(true);
      setWon(true);
      void saveResult(true, next.map((e) => e.guess));
    } else if (next.length >= config.maxTries) {
      setGameOver(true);
      setWon(false);
      void saveResult(false, next.map((e) => e.guess));
    }
  };

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
      grid,
      url: `${window.location.origin}/daily`,
    });
  }, [gameOver, history, config, won]);

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
    <div className="min-h-screen flex flex-col items-center px-4 py-4 pb-8">
      {/* Language Toggle */}
      <div className="fixed top-4 end-4 z-50">
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="px-3 py-1.5 rounded-md bg-card text-muted-foreground font-mono text-sm cyber-border hover:text-primary transition-colors"
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 mt-2">
        <button
          onClick={() => navigate('/')}
          className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
        >
          ← {t('backToMenu')}
        </button>
        <div className="font-mono text-xs text-muted-foreground">{config.date} UTC</div>
      </div>

      {/* Title */}
      <div className="w-full max-w-md text-center mb-4">
        <h1 className="font-mono text-2xl font-bold text-secondary text-glow-secondary">
          {t('dailyPuzzle')}
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">{t('dailySubtitle')}</p>
      </div>

      {/* Today's config card */}
      <div className="w-full max-w-md mb-4 p-4 rounded-lg bg-card cyber-border scanline">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {t('codeLength')}
            </div>
            <div className="font-mono text-lg text-primary text-glow-primary">{config.codeLength}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {t('allowDuplicates')}
            </div>
            <div className={`font-mono text-lg ${config.allowDuplicates ? 'text-warning' : 'text-muted-foreground'}`}>
              {config.allowDuplicates ? t('on') : t('off')}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {t('maxTries')}
            </div>
            <div className="font-mono text-lg text-primary text-glow-primary">{config.maxTries}</div>
          </div>
        </div>
      </div>

      {/* Streak strip */}
      <div className="w-full max-w-md mb-4 p-3 rounded-lg bg-muted/40 cyber-border">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase">{t('streak')}</div>
            <div className="font-mono text-lg text-primary">{stats.current}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase">{t('bestStreak')}</div>
            <div className="font-mono text-lg text-secondary">{stats.best}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase">{t('played')}</div>
            <div className="font-mono text-lg text-foreground">{stats.played}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase">{t('wins')}</div>
            <div className="font-mono text-lg text-foreground">{stats.won}</div>
          </div>
        </div>
        {!isSignedIn && (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground text-center">
            {t('signInForCloudStreak')}{' '}
            <button onClick={() => navigate('/auth')} className="text-secondary underline">
              {t('signIn')}
            </button>
          </p>
        )}
      </div>

      {!gameOver && triesLeft > 0 && (
        <div className="w-full max-w-md mb-3">
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
      )}

      {gameOver && (
        <div className="w-full max-w-md mb-4 p-5 rounded-lg bg-card cyber-border text-center scanline">
          <h2 className={`font-mono text-xl font-bold mb-2 ${won ? 'text-primary text-glow-primary' : 'text-destructive'}`}>
            {won ? t('youWin') : t('youLose')}
          </h2>
          <p className="font-mono text-xs text-muted-foreground mb-1">{t('secretWas')}:</p>
          <div className="flex gap-1.5 justify-center mb-3">
            {config.secret.map((d, i) => (
              <span
                key={i}
                className="w-9 h-9 flex items-center justify-center rounded bg-primary text-primary-foreground font-mono text-base font-bold"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="font-mono text-xs text-muted-foreground mb-2">
            {t('nextPuzzleIn')}:{' '}
            <span className="text-secondary text-glow-secondary">{formatCountdown(countdown)}</span>
          </div>
          <button
            onClick={handleShare}
            className="w-full mt-2 py-2.5 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm font-bold glow-secondary hover:opacity-90 transition-all"
          >
            📋 {t('shareResult')}
          </button>
        </div>
      )}

      {/* History */}
      <div className="w-full max-w-md">
        <GuessHistory
          history={history}
          codeLength={config.codeLength}
          secret={config.secret}
          gameOver={gameOver}
        />
      </div>
    </div>
  );
};

export default Daily;
