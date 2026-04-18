import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  GameConfig,
  GuessEntry,
  generateSecret,
  evaluateGuess,
  aiGuessEasy,
  aiGuessMedium,
  aiGuessHard,
} from '@/game/engine';
import DigitInput from './DigitInput';
import GuessHistory from './GuessHistory';

interface GameBoardProps {
  config: GameConfig;
  onBack: () => void;
}

const TURN_TIME = 30;

const GameBoard: React.FC<GameBoardProps> = ({ config, onBack }) => {
  const { t } = useLanguage();
  const [gameId, setGameId] = useState(0);
  const [secret, setSecret] = useState<number[]>(() =>
    generateSecret(config.codeLength, config.allowDuplicates),
  );
  const [playerSecret, setPlayerSecret] = useState<number[]>([]);
  const [settingSecret, setSettingSecret] = useState(config.botMode === 'active');
  const [playerHistory, setPlayerHistory] = useState<GuessEntry[]>([]);
  const [aiHistory, setAiHistory] = useState<GuessEntry[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<'win' | 'lose' | 'ai-win' | null>(null);
  const [timer, setTimer] = useState(TURN_TIME);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePlayAgain = useCallback(() => {
    setSecret(generateSecret(config.codeLength, config.allowDuplicates));
    setPlayerSecret([]);
    setSettingSecret(config.botMode === 'active');
    setPlayerHistory([]);
    setAiHistory([]);
    setGameOver(false);
    setResult(null);
    setTimer(TURN_TIME);
    setIsPlayerTurn(true);
    setGameId((g) => g + 1);
  }, [config]);

  const triesLeft = config.maxTries !== null ? config.maxTries - playerHistory.length : null;

  // Timer
  useEffect(() => {
    if (gameOver || settingSecret) return;
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (isPlayerTurn) {
            if (config.botMode === 'active') {
              setIsPlayerTurn(false);
            }
          }
          return TURN_TIME;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameOver, isPlayerTurn, config.botMode, settingSecret]);

  // AI turn
  useEffect(() => {
    if (!isPlayerTurn && config.botMode === 'active' && !gameOver) {
      const timeout = setTimeout(() => {
        let aiGuess: number[];
        switch (config.aiDifficulty) {
          case 'easy':
            aiGuess = aiGuessEasy(config.codeLength, config.allowDuplicates);
            break;
          case 'medium':
            aiGuess = aiGuessMedium(config.codeLength, config.allowDuplicates, aiHistory);
            break;
          case 'hard':
            aiGuess = aiGuessHard(config.codeLength, config.allowDuplicates, aiHistory);
            break;
        }
        const feedback = evaluateGuess(aiGuess, playerSecret);
        const newAiHistory = [...aiHistory, { guess: aiGuess, feedback }];
        setAiHistory(newAiHistory);

        if (feedback.matches === config.codeLength) {
          setGameOver(true);
          setResult('ai-win');
        } else {
          setIsPlayerTurn(true);
          setTimer(TURN_TIME);
        }
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [isPlayerTurn, config, gameOver, aiHistory, playerSecret]);

  const handleGuess = useCallback(
    (digits: number[]) => {
      if (gameOver || !isPlayerTurn) return;
      const feedback = evaluateGuess(digits, secret);
      const newHistory = [...playerHistory, { guess: digits, feedback }];
      setPlayerHistory(newHistory);

      if (feedback.matches === config.codeLength) {
        setGameOver(true);
        setResult('win');
      } else if (config.maxTries !== null && newHistory.length >= config.maxTries) {
        setGameOver(true);
        setResult('lose');
      } else if (config.botMode === 'active') {
        setIsPlayerTurn(false);
        setTimer(TURN_TIME);
      }
    },
    [gameOver, isPlayerTurn, secret, playerHistory, config]
  );

  const handleGiveUp = () => {
    setGameOver(true);
    setResult('lose');
  };

  const handleSetSecret = useCallback(
    (digits: number[]) => {
      setPlayerSecret(digits);
      setSettingSecret(false);
      setTimer(TURN_TIME);
    },
    []
  );

  const timerPercent = (timer / TURN_TIME) * 100;
  const timerColor = timer <= 10 ? 'bg-destructive' : timer <= 20 ? 'bg-warning' : 'bg-primary';

  // Secret setting phase for active bot
  if (settingSecret) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-4 pb-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="p-6 rounded-lg bg-card cyber-border scanline">
            <h2 className="font-mono text-xl font-bold text-secondary text-glow-secondary mb-2">
              {t('setYourSecret')}
            </h2>
            <p className="font-mono text-sm text-muted-foreground mb-6">
              {t('setSecretHint')}
            </p>
            <DigitInput
              codeLength={config.codeLength}
              allowDuplicates={config.allowDuplicates}
              onSubmit={handleSetSecret}
              disabled={false}
              submitLabel={t('confirmSecret')}
            />
          </div>
          <button
            onClick={onBack}
            className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
          >
            ← {t('backToMenu')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-4 pb-8">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
        >
          ← {t('backToMenu')}
        </button>
        <div className="font-mono text-xs text-muted-foreground">
          {config.codeLength} {t('digits')} | {t(config.aiDifficulty)}
          {triesLeft !== null && !gameOver && (
            <span className="ms-2 text-warning">| {triesLeft} {t('turnsLeft')}</span>
          )}
        </div>
      </div>

      {/* Timer Bar */}
      <div className="w-full max-w-md mb-6">
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-xs text-muted-foreground">
            {isPlayerTurn ? t('yourTurn') : t('aiTurn')}
          </span>
          <span className={`font-mono text-sm ${timer <= 10 ? 'text-destructive' : 'text-primary'}`}>
            {timer}s
          </span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${timerColor} transition-all duration-1000 ease-linear rounded-full`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="w-full max-w-md mb-6 p-6 rounded-lg bg-card cyber-border text-center scanline">
          <h2
            className={`font-mono text-2xl font-bold mb-1 ${
              result === 'win' ? 'text-primary text-glow-primary' : 'text-destructive'
            }`}
          >
            {result === 'win'
              ? t('youWin')
              : result === 'ai-win'
              ? t('aiWins')
              : t('youLose')}
          </h2>
          <p className="font-mono text-sm text-muted-foreground mb-3">
            🏆 {t('winnerIs')}:{' '}
            <span className={result === 'win' ? 'text-primary text-glow-primary' : 'text-destructive'}>
              {result === 'win' ? t('you') : t('aiPlayer')}
            </span>
          </p>
          <p className="font-mono text-sm text-muted-foreground mb-1">
            {t('secretWas')}:
          </p>
          <div dir="ltr" className="flex gap-2 justify-center mb-4">
            {secret.map((d, i) => (
              <span
                key={i}
                className="w-10 h-10 flex items-center justify-center rounded bg-primary text-primary-foreground font-mono text-lg font-bold"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePlayAgain}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-bold glow-primary hover:opacity-90 transition-all"
            >
              🔁 {t('playAgain')}
            </button>
            <button
              onClick={onBack}
              className="w-full px-4 py-2 rounded-lg bg-muted text-muted-foreground font-mono text-sm hover:text-foreground transition-colors"
            >
              {t('backToMenu')}
            </button>
          </div>
        </div>
      )}

      {/* Player Section */}
      <div className="w-full max-w-md space-y-4">
        {!gameOver && (
          <>
            <DigitInput
              key={gameId}
              codeLength={config.codeLength}
              allowDuplicates={config.allowDuplicates}
              onSubmit={handleGuess}
              disabled={!isPlayerTurn || gameOver}
            />
            <button
              onClick={handleGiveUp}
              className="w-full py-2 rounded-lg bg-destructive/10 text-destructive font-mono text-sm hover:bg-destructive/20 transition-colors cyber-border"
            >
              {t('giveUp')}
            </button>
          </>
        )}

        {/* Player History */}
        <GuessHistory
          history={playerHistory}
          codeLength={config.codeLength}
          secret={secret}
          gameOver={gameOver}
        />

        {/* AI History (Active Bot) */}
        {config.botMode === 'active' && aiHistory.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="font-mono text-xs text-warning uppercase tracking-widest mb-3">
              {t('aiVault')}
            </h3>
            <GuessHistory
              history={aiHistory}
              codeLength={config.codeLength}
              secret={playerSecret}
              gameOver={gameOver}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;
