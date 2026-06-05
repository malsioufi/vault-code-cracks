import React from 'react';
import { ACHIEVEMENTS, rarityClass, Achievement } from '@/game/achievements';

interface Props {
  unlocked: Set<string>;
}

const AchievementsCard: React.FC<Props> = ({ unlocked }) => {
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;
  return (
    <div className="w-full p-4 rounded-lg bg-card cyber-border scanline">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-primary text-glow-primary">
          Achievements
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {unlockedCount}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ACHIEVEMENTS.map((a) => (
          <Badge key={a.id} a={a} locked={!unlocked.has(a.id)} />
        ))}
      </div>
    </div>
  );
};

const Badge: React.FC<{ a: Achievement; locked: boolean }> = ({ a, locked }) => {
  return (
    <div
      className={`relative aspect-square rounded-md border-2 bg-muted/30 flex flex-col items-center justify-center p-1 text-center transition-all ${
        locked
          ? 'border-muted-foreground/15 text-muted-foreground/40 grayscale opacity-50'
          : `${rarityClass[a.rarity]} [box-shadow:0_0_12px_currentColor]`
      }`}
      title={`${a.name} — ${a.description}`}
    >
      <div className="text-2xl leading-none">{locked ? '🔒' : a.icon}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider mt-1 leading-tight line-clamp-2">
        {a.name}
      </div>
    </div>
  );
};

export default AchievementsCard;
