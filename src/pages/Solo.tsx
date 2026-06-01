import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { GameConfig } from '@/game/engine';
import GameBoard from '@/components/game/GameBoard';

const Solo: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  const [codeLength, setCodeLength] = useState(4);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [botMode, setBotMode] = useState<'active' | 'passive'>('passive');
  const [maxTries, setMaxTries] = useState<number | null>(10);

  if (gameConfig) {
    return <GameBoard config={gameConfig} onBack={() => setGameConfig(null)} />;
  }

  const handleStart = () => {
    setGameConfig({
      codeLength,
      allowDuplicates,
      aiDifficulty: difficulty,
      botMode,
      maxTries: botMode === 'passive' ? maxTries : null,
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
        >
          ← {t('backToMenu')}
        </button>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-3xl font-mono font-bold text-primary text-glow-primary mb-2">
          {t('soloMode')}
        </h1>
      </div>

      <div className="w-full max-w-md p-5 rounded-lg bg-card cyber-border space-y-5">
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
                    ? 'bg-primary text-primary-foreground glow-primary'
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
    </div>
  );
};

export default Solo;
