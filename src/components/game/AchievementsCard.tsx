import React, { useState } from 'react';
import { ACHIEVEMENTS, rarityClass, rarityLabel, Achievement, UnlockContext } from '@/game/achievements';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  unlockedAt: Record<string, string>;
  context: UnlockContext | null;
}

const AchievementsCard: React.FC<Props> = ({ unlockedAt, context }) => {
  const [selected, setSelected] = useState<Achievement | null>(null);
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.id in unlockedAt).length;

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
        {ACHIEVEMENTS.map((a) => {
          const ts = unlockedAt[a.id];
          const p = context ? a.progress(context) : { current: 0, target: 1 };
          return (
            <BadgeTile
              key={a.id}
              a={a}
              unlockedAt={ts}
              current={p.current}
              target={p.target}
              onClick={() => setSelected(a)}
            />
          );
        })}
      </div>

      <p className="font-mono text-[10px] text-center text-muted-foreground mt-3 uppercase tracking-widest">
        … more to come
      </p>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="cyber-border bg-card">
          {selected && (
            <AchievementDetails
              a={selected}
              unlockedAt={unlockedAt[selected.id]}
              progress={context ? selected.progress(context) : { current: 0, target: 1 }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BadgeTile: React.FC<{
  a: Achievement;
  unlockedAt?: string;
  current: number;
  target: number;
  onClick: () => void;
}> = ({ a, unlockedAt, current, target, onClick }) => {
  const locked = !unlockedAt;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded-md border-2 bg-muted/30 flex flex-col items-center justify-center p-1 text-center transition-all hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        locked
          ? 'border-muted-foreground/15 text-muted-foreground/50'
          : `${rarityClass[a.rarity]} [box-shadow:0_0_12px_currentColor]`
      }`}
      title={`${a.name} — ${a.description}`}
    >
      <div className={`text-2xl leading-none ${locked ? 'grayscale opacity-60' : ''}`}>
        {locked ? '🔒' : a.icon}
      </div>
      <div className="font-mono text-[8px] uppercase tracking-wider mt-1 leading-tight line-clamp-2">
        {a.name}
      </div>
      <div className="absolute left-1 right-1 bottom-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${locked ? 'bg-muted-foreground/50' : 'bg-current'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
};

const AchievementDetails: React.FC<{
  a: Achievement;
  unlockedAt?: string;
  progress: { current: number; target: number };
}> = ({ a, unlockedAt, progress }) => {
  const locked = !unlockedAt;
  const pct =
    progress.target > 0 ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;
  const tsLabel = unlockedAt
    ? new Date(unlockedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 font-mono">
          <span className={`text-3xl ${locked ? 'grayscale opacity-60' : ''}`}>
            {locked ? '🔒' : a.icon}
          </span>
          <span className={locked ? 'text-muted-foreground' : rarityClass[a.rarity].split(' ')[1]}>
            {a.name}
          </span>
        </DialogTitle>
        <DialogDescription className="font-mono text-xs">{a.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-3 font-mono text-xs">
        <Row label="Rarity">
          <span className={rarityClass[a.rarity].split(' ')[1]}>{rarityLabel[a.rarity]}</span>
        </Row>
        <Row label="Criteria">
          <span className="text-foreground">{a.criteria}</span>
        </Row>
        <Row label="Status">
          {locked ? (
            <span className="text-muted-foreground">Locked</span>
          ) : (
            <span className="text-primary text-glow-primary">Unlocked</span>
          )}
        </Row>
        {tsLabel && (
          <Row label="Unlocked">
            <span className="text-foreground">{tsLabel}</span>
          </Row>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">
              Progress
            </span>
            <span className="text-foreground">
              {Math.min(progress.current, progress.target)} / {progress.target}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden cyber-border">
            <div
              className={`h-full transition-all ${
                locked ? 'bg-secondary' : 'bg-primary glow-primary'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);

export default AchievementsCard;
