import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { GameConfig } from '@/game/engine';
import DailyLeaderboard from '@/components/game/DailyLeaderboard';
import MatrixRain from '@/components/MatrixRain';
import { useAuth } from '@/hooks/useAuth';
import { dailyDateString } from '@/game/dailyPuzzle';
import { ChevronDown, Trophy, BarChart3, LogIn, Globe, Dumbbell, Award } from 'lucide-react';

interface MainMenuProps {
  onStartSolo: (config: GameConfig) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartSolo }) => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
  const { user } = useAuth();

  const [showLeaderboard, setShowLeaderboard] = React.useState(false);

  // Typewriter slogan
  const fullSlogan = 'Crack the Code. Break the Vault.';
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => {
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(fullSlogan.slice(0, i));
      if (i >= fullSlogan.length) clearInterval(id);
    }, 55);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <MatrixRain opacity={0.18} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0, transparent 38px, hsl(155 100% 50% / 0.04) 38px, hsl(155 100% 50% / 0.04) 39px)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, hsl(var(--background) / 0.85) 100%)',
        }}
      />

      <div className="relative z-10 h-full flex flex-col">
        {/* Top utility bar */}
        <header className="w-full px-4 py-2 flex items-center justify-between shrink-0">
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-muted-foreground hover:text-primary font-mono text-xs transition-colors"
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'en' ? 'AR' : 'EN'}
          </button>

          {!user ? (
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-muted-foreground hover:text-primary font-mono text-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t('signIn')}
            </button>
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
              {user.email}
            </span>
          )}
        </header>

        <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-5 pb-2">
          {/* Terminal window chrome */}
          <div className="w-full max-w-sm shrink-0" dir="ltr">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-primary/20">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-primary/80" />
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                vault_breaker.exe
              </span>
            </div>
          </div>

          {/* Hero */}
          <div className="w-full max-w-sm text-center mt-4 mb-4 px-2 shrink-0">
            <h1
              className="font-mono font-extrabold text-primary text-4xl sm:text-5xl leading-[0.95] tracking-tight"
              style={{
                textShadow:
                  '0 0 8px hsl(var(--primary) / 0.9), 0 0 22px hsl(var(--primary) / 0.7), 0 0 48px hsl(var(--primary) / 0.45)',
              }}
            >
              VAULT
              <br />
              BREAKER
            </h1>
            <p
              className="mt-3 font-mono text-[11px] sm:text-sm text-secondary/90 min-h-[1.25rem]"
              dir="ltr"
            >
              <span className="text-muted-foreground">&gt;</span> {typed}
              <span className="inline-block w-2 h-3.5 ml-1 align-middle bg-secondary animate-pulse" />
            </p>
          </div>

          {/* Mode buttons */}
          <div className="w-full max-w-sm space-y-2 shrink-0">
            <NeonButton tone="primary" onClick={() => navigate('/solo')} label={t('startMission')} />
            <NeonButton tone="secondary" onClick={() => navigate('/online')} label={t('onlineMode')} />
            <NeonButton
              tone="warning"
              onClick={() => navigate('/daily')}
              label={`🔐 ${t('dailyPuzzle')}`}
              labelClassName="text-primary"
            />
            <NeonButton
              tone="muted"
              onClick={() => {
                const lengths = [3, 4, 5, 6];
                const len = lengths[Math.floor(Math.random() * lengths.length)];
                const dup = Math.random() < 0.5;
                const tries = Math.min(
                  15,
                  ({ 3: 5, 4: 7, 5: 9, 6: 11 } as Record<number, number>)[len] + (dup ? 2 : 0),
                );
                onStartSolo({
                  codeLength: len,
                  allowDuplicates: dup,
                  aiDifficulty: 'medium',
                  botMode: 'passive',
                  maxTries: tries,
                });
              }}
              label={
                <span className="inline-flex items-center justify-center gap-2">
                  <Dumbbell className="w-4 h-4" />
                  {t('trainingMode')}
                </span>
              }
            />
          </div>


          {/* Secondary controls */}
          <div className="w-full max-w-sm mt-3 flex items-center justify-center gap-2 shrink-0">
            <button
              onClick={() => setShowLeaderboard((s) => !s)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Trophy className="w-3.5 h-3.5" />
              {t('leaderboardToday')}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showLeaderboard ? 'rotate-180' : ''}`}
              />
            </button>
            <button
              onClick={() => navigate('/achievements')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
              aria-label="Achievements"
            >
              <Award className="w-3.5 h-3.5" />
              Badges
            </button>
            <button
              onClick={() => navigate('/stats')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
              aria-label={t('statsMenu')}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {t('statsMenu')}
            </button>
          </div>

          {showLeaderboard && (
            <div className="w-full max-w-md mt-2 max-h-40 overflow-y-auto">
              <DailyLeaderboard
                date={dailyDateString()}
                currentUserId={user?.id ?? null}
                hasFinished={false}
              />
            </div>
          )}

          <p className="mt-3 font-mono text-[10px] text-muted-foreground/60 tracking-[0.3em] shrink-0">
            [ SYSTEM READY ]
          </p>
        </main>
      </div>
    </div>
  );
};

type Tone = 'primary' | 'secondary' | 'warning' | 'muted';

const toneClasses: Record<Tone, { border: string; text: string; glow: string; hoverGlow: string }> = {
  primary: {
    border: 'border-primary/60',
    text: 'text-primary',
    glow: '[box-shadow:0_0_20px_hsl(var(--primary)/0.25),inset_0_0_20px_hsl(var(--primary)/0.08)]',
    hoverGlow:
      'hover:[box-shadow:0_0_28px_hsl(var(--primary)/0.55),inset_0_0_22px_hsl(var(--primary)/0.15)]',
  },
  secondary: {
    border: 'border-secondary/60',
    text: 'text-secondary',
    glow:
      '[box-shadow:0_0_20px_hsl(var(--secondary)/0.25),inset_0_0_20px_hsl(var(--secondary)/0.08)]',
    hoverGlow:
      'hover:[box-shadow:0_0_28px_hsl(var(--secondary)/0.55),inset_0_0_22px_hsl(var(--secondary)/0.15)]',
  },
  warning: {
    border: 'border-warning/60',
    text: 'text-warning',
    glow: '[box-shadow:0_0_20px_hsl(var(--warning)/0.2),inset_0_0_18px_hsl(var(--warning)/0.06)]',
    hoverGlow:
      'hover:[box-shadow:0_0_28px_hsl(var(--warning)/0.5),inset_0_0_22px_hsl(var(--warning)/0.12)]',
  },
  muted: {
    border: 'border-muted-foreground/30',
    text: 'text-muted-foreground',
    glow: '',
    hoverGlow: 'hover:border-muted-foreground/60 hover:text-foreground',
  },
};

const NeonButton: React.FC<{
  tone: Tone;
  onClick: () => void;
  label: React.ReactNode;
  labelClassName?: string;
}> = ({ tone, onClick, label, labelClassName }) => {
  const c = toneClasses[tone];
  return (
    <button
      onClick={onClick}
      className={`w-full py-2.5 rounded-lg border-2 bg-card/40 backdrop-blur-sm font-mono font-bold text-sm tracking-wider uppercase transition-all duration-200 ${c.border} ${c.text} ${c.glow} ${c.hoverGlow}`}
    >
      <span
        className={labelClassName}
        style={{
          textShadow: tone === 'muted' ? undefined : `0 0 10px currentColor`,
        }}
      >
        {label}
      </span>
    </button>
  );
};

export default MainMenu;
