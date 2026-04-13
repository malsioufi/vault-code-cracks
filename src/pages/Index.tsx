import React, { useState } from 'react';
import { GameConfig } from '@/game/engine';
import MainMenu from '@/components/game/MainMenu';
import GameBoard from '@/components/game/GameBoard';

const Index: React.FC = () => {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  if (gameConfig) {
    return <GameBoard config={gameConfig} onBack={() => setGameConfig(null)} />;
  }

  return <MainMenu onStartSolo={setGameConfig} />;
};

export default Index;
