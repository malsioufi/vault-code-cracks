import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { GameConfig } from '@/game/engine';
import DailyLeaderboard from '@/components/game/DailyLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { dailyDateString } from '@/game/dailyPuzzle';
import { ChevronDown, Trophy, BarChart3, LogIn, Globe, Dumbbell } from 'lucide-react';

interface MainMenuProps {
  onStartSolo: (config: GameConfig) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartSolo }) => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
  const { user } = useAuth();

  const [showLeaderboard, setShowLeaderboard] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="w-full px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-primary font-mono text-xs transition-colors"
          aria-label="Toggle language"
        >
          <Globe className="w-3.5 h-3.5" />
          {lang === 'en' ? 'AR' : 'EN'}
        </button>

        {!user ? (
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-muted-foreground hover:text-primary font-mono text-xs transition-colors"
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

      {/* Hero + Actions */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-6">
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-mono font-bold text-primary text-glow-primary animate-flicker mb-2 tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground font-mono text-xs md:text-sm">
            {t('subtitle')}
          </p>
        </div>

        {/* Primary CTA */}
        <div className="w-full max-w-xs space-y-2.5">
          <button
            onClick={() => navigate('/solo')}
            className="w-full py-4 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-base glow-primary hover:opacity-90 transition-all inline-flex items-center justify-center gap-2"
          >
            ▶ {t('startMission')}
          </button>

          <button
            onClick={() => navigate('/online')}
            className="w-full py-3 rounded-lg bg-card cyber-border font-mono text-sm text-secondary hover:glow-secondary transition-all"
          >
            {t('onlineMode')}
          </button>

          <button
            onClick={() => {
              const lengths = [3, 4, 5, 6];
              const len = lengths[Math.floor(Math.random() * lengths.length)];
              const dup = Math.random() < 0.5;
              const tries = Math.min(15, ({ 3: 5, 4: 7, 5: 9, 6: 11 } as Record<number, number>)[len] + (dup ? 2 : 0));
              onStartSolo({
                codeLength: len,
                allowDuplicates: dup,
                aiDifficulty: 'medium',
                botMode: 'passive',
                maxTries: tries,
              });
            }}
            className="w-full py-3 rounded-lg bg-card cyber-border font-mono text-sm text-secondary hover:glow-secondary transition-all inline-flex items-center justify-center gap-2"
          >
            <Dumbbell className="w-4 h-4" />
            {t('trainingMode')}
          </button>

          <button
            onClick={() => navigate('/daily')}
            className="w-full py-3 rounded-lg bg-card cyber-border font-mono text-sm text-warning hover:shadow-[0_0_20px_hsl(var(--warning)/0.5)] transition-all"
          >
            🗓️ {t('dailyPuzzle')}
          </button>
        </div>

        {/* Secondary controls */}
        <div className="w-full max-w-xs mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setShowLeaderboard((s) => !s)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" />
            {t('leaderboardToday')}
            <ChevronDown className={`w-3 h-3 transition-transform ${showLeaderboard ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/stats')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
            aria-label={t('statsMenu')}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {t('statsMenu')}
          </button>
        </div>

        {/* Collapsible Leaderboard */}
        {showLeaderboard && (
          <div className="w-full max-w-md mt-4">
            <DailyLeaderboard
              date={dailyDateString()}
              currentUserId={user?.id ?? null}
              hasFinished={false}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default MainMenu;
