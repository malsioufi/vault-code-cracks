import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { GameConfig } from '@/game/engine';

interface MainMenuProps {
  onStartSolo: (config: GameConfig) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartSolo }) => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Language Toggle */}
      <div className="fixed top-4 end-4 z-50">
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="px-3 py-1.5 rounded-md bg-card text-muted-foreground font-mono text-sm cyber-border hover:text-primary transition-colors"
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-mono font-bold text-primary text-glow-primary animate-flicker mb-3">
          {t('title')}
        </h1>
        <p className="text-muted-foreground font-mono text-sm md:text-base">
          {t('subtitle')}
        </p>
      </div>

      {/* Main Actions */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => document.getElementById('settings-panel')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full py-4 rounded-lg bg-card cyber-border font-mono text-lg text-primary hover:glow-primary transition-all duration-300"
        >
          {t('soloMode')}
        </button>
        <button
          onClick={() => navigate('/online')}
          className="w-full py-4 rounded-lg bg-card cyber-border font-mono text-lg text-secondary hover:glow-secondary transition-all duration-300"
        >
          {t('onlineMode')}
        </button>
      </div>

      {/* Settings Panel */}
      <div id="settings-panel" className="w-full max-w-sm mt-6 p-5 rounded-lg bg-card cyber-border scanline space-y-5">
        <h2 className="font-mono text-secondary text-glow-secondary text-sm uppercase tracking-widest">
          {t('settings')}
        </h2>

        {/* Code Length */}
        <div>
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            {t('codeLength')}
          </label>
          <div className="flex gap-2 mt-2">
            {[3, 4, 5, 6].map((len) => (
              <button
                key={len}
                onClick={() => setCodeLength(len)}
                className={`flex-1 py-2 rounded font-mono text-sm transition-all ${
                  codeLength === len
                    ? 'bg-primary text-primary-foreground glow-primary'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {len}
              </button>
            ))}
          </div>
        </div>

        {/* Allow Duplicates */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            {t('allowDuplicates')}
          </label>
          <button
            onClick={() => setAllowDuplicates(!allowDuplicates)}
            className={`px-4 py-1.5 rounded font-mono text-xs transition-all ${
              allowDuplicates
                ? 'bg-primary text-primary-foreground glow-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {allowDuplicates ? t('on') : t('off')}
          </button>
        </div>

        {/* AI Difficulty */}
        <div>
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            {t('aiDifficulty')}
          </label>
          <div className="flex gap-2 mt-2">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-2 rounded font-mono text-xs transition-all ${
                  difficulty === d
                    ? 'bg-secondary text-secondary-foreground glow-secondary'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(d)}
              </button>
            ))}
          </div>
        </div>

        {/* Bot Mode */}
        <div>
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            {t('botMode')}
          </label>
          <div className="flex gap-2 mt-2">
            {(['passive', 'active'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setBotMode(m)}
                className={`flex-1 py-2 rounded font-mono text-xs transition-all ${
                  botMode === m
                    ? 'bg-secondary text-secondary-foreground glow-secondary'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'active' ? t('activeBot') : t('passiveBot')}
              </button>
            ))}
          </div>
        </div>

        {/* Max Tries (Passive Bot only) */}
        {botMode === 'passive' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {t('maxTries')}
            </label>
            <div className="flex gap-2 mt-2">
              {[6, 8, 10, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxTries(n)}
                  className={`flex-1 py-2 rounded font-mono text-xs transition-all ${
                    maxTries === n
                      ? 'bg-secondary text-secondary-foreground glow-secondary'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setMaxTries(null)}
                className={`flex-1 py-2 rounded font-mono text-xs transition-all ${
                  maxTries === null
                    ? 'bg-secondary text-secondary-foreground glow-secondary'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                ∞
              </button>
            </div>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-base glow-primary hover:opacity-90 transition-all animate-pulse-glow"
        >
          {t('startMission')}
        </button>
      </div>
    </div>
  );
};

export default MainMenu;
