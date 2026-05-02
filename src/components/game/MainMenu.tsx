import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { GameConfig } from '@/game/engine';
import DailyLeaderboard from '@/components/game/DailyLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Trophy, BarChart3, LogIn } from 'lucide-react';

interface MainMenuProps {
  onStartSolo: (config: GameConfig) => void;
}

const getUtcDateString = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
};

const MainMenu: React.FC<MainMenuProps> = ({ onStartSolo }) => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
  const { user } = useAuth();

  const [showSettings, setShowSettings] = React.useState(false);
  const [showLeaderboard, setShowLeaderboard] = React.useState(false);

  const [codeLength, setCodeLength] = React.useState(4);
  const [allowDuplicates, setAllowDuplicates] = React.useState(false);
  const [difficulty, setDifficulty] = React.useState<'easy' | 'medium' | 'hard'>('medium');
  const [botMode, setBotMode] = React.useState<'active' | 'passive'>('passive');
  const [maxTries, setMaxTries] = React.useState<number | null>(10);

  const handleStart = () => {
    onStartSolo({
      codeLength,
      allowDuplicates,
      aiDifficulty: difficulty,
      botMode,
      maxTries: botMode === 'passive' ? maxTries : null,
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="w-full px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="px-3 py-1.5 rounded-md bg-card text-muted-foreground font-mono text-sm cyber-border hover:text-primary transition-colors"
        >
          {lang === 'en' ? 'العربية' : 'English'}
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
            onClick={() => setShowSettings(true)}
            className="w-full py-4 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-base glow-primary hover:opacity-90 transition-all"
          >
            ▶ {t('soloPlayer')}
          </button>

          <button
            onClick={() => navigate('/online')}
            className="w-full py-3 rounded-lg bg-card cyber-border font-mono text-sm text-secondary hover:glow-secondary transition-all"
          >
            {t('onlineMode')}
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
              date={getUtcDateString()}
              currentUserId={user?.id ?? null}
              hasFinished={false}
            />
          </div>
        )}

        {/* Collapsible Settings */}
        {showSettings && (
          <div className="w-full max-w-sm mt-4 p-5 rounded-lg bg-card cyber-border space-y-5">
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {t('codeLength')}
              </label>
              <div className="flex gap-2 mt-2">
                {[3, 4, 5, 6].map((len) => (
                  <button
                    key={len}
                    onClick={() => setCodeLength(len)}
                    className={`flex-1 py-2 rounded font-mono text-sm transition-all ${
                      codeLength === len
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {t('allowDuplicates')}
              </label>
              <button
                onClick={() => setAllowDuplicates(!allowDuplicates)}
                className={`px-4 py-1.5 rounded font-mono text-[10px] transition-all ${
                  allowDuplicates ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {allowDuplicates ? t('on') : t('off')}
              </button>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {t('aiDifficulty')}
              </label>
              <div className="flex gap-2 mt-2">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded font-mono text-[11px] transition-all ${
                      difficulty === d
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(d)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {t('botMode')}
              </label>
              <div className="flex gap-2 mt-2">
                {(['passive', 'active'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setBotMode(m)}
                    className={`flex-1 py-2 rounded font-mono text-[11px] transition-all ${
                      botMode === m
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m === 'active' ? t('activeBot') : t('passiveBot')}
                  </button>
                ))}
              </div>
            </div>

            {botMode === 'passive' && (
              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  {t('maxTries')}
                </label>
                <div className="flex gap-2 mt-2">
                  {[6, 8, 10, 12].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxTries(n)}
                      className={`flex-1 py-2 rounded font-mono text-[11px] transition-all ${
                        maxTries === n
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setMaxTries(null)}
                    className={`flex-1 py-2 rounded font-mono text-[11px] transition-all ${
                      maxTries === null
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ∞
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleStart}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm glow-primary hover:opacity-90 transition-all"
            >
              ▶ {t('startMission')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MainMenu;
