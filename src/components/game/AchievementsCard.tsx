import React, { useState } from 'react';
import { ACHIEVEMENTS, rarityClass, rarityLabel, Achievement, UnlockContext } from '@/game/achievements';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Share2, Copy, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { generateBadgeImage, shareBadgeText } from '@/lib/shareBadge';

interface Props {
  unlockedAt: Record<string, string>;
  context: UnlockContext | null;
  /** Called when the user taps an eligible-but-locked badge to claim it.
   *  Returns the list of achievement ids newly granted by this call. */
  onClaim?: () => Promise<string[]>;
  /** When true, hides claim actions — used for viewing someone else's profile. */
  readOnly?: boolean;
}

const AchievementsCard: React.FC<Props> = ({ unlockedAt, context, onClaim, readOnly }) => {
  const [selected, setSelected] = useState<Achievement | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<Achievement | null>(null);
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.id in unlockedAt).length;

  const handleTileClick = async (a: Achievement) => {
    const isUnlocked = a.id in unlockedAt;
    const p = context ? a.progress(context) : { current: 0, target: 1 };
    const eligible = !isUnlocked && p.target > 0 && p.current >= p.target;

    if (eligible && !readOnly && onClaim) {
      setClaiming(a.id);
      const granted = await onClaim();
      setClaiming(null);
      if (granted.includes(a.id)) {
        setCelebrating(a);
        window.setTimeout(() => {
          setCelebrating(null);
          setSelected(a);
        }, 1400);
        return;
      }
    }
    setSelected(a);
  };

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
          const eligible = !ts && p.target > 0 && p.current >= p.target;
          return (
            <BadgeTile
              key={a.id}
              a={a}
              unlockedAt={ts}
              current={p.current}
              target={p.target}
              eligible={eligible && !readOnly && !!onClaim}
              loading={claiming === a.id}
              onClick={() => handleTileClick(a)}
            />
          );
        })}
      </div>

      {/* Unlock celebration overlay */}
      {celebrating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in pointer-events-none">
          <div className="relative animate-scale-in">
            <div
              className={`w-44 h-44 rounded-2xl border-4 bg-card flex flex-col items-center justify-center gap-2 ${rarityClass[celebrating.rarity]} [box-shadow:0_0_60px_currentColor]`}
            >
              <div className="text-6xl animate-[scale-in_0.4s_ease-out]">{celebrating.icon}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Unlocked
              </div>
              <div className={`font-mono text-sm font-bold ${rarityClass[celebrating.rarity].split(' ')[1]}`}>
                {celebrating.name}
              </div>
            </div>
            <Sparkles className="absolute -top-3 -right-3 w-8 h-8 text-primary animate-[scale-in_0.3s_ease-out] text-glow-primary" />
            <Sparkles className="absolute -bottom-3 -left-3 w-8 h-8 text-secondary animate-[scale-in_0.5s_ease-out] text-glow-secondary" />
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="cyber-border bg-card">
          {selected && (
            <AchievementDetails
              a={selected}
              unlockedAt={unlockedAt[selected.id]}
              progress={context ? selected.progress(context) : { current: 0, target: 1 }}
              readOnly={readOnly}
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
  eligible: boolean;
  loading: boolean;
  onClick: () => void;
}> = ({ a, unlockedAt, current, target, eligible, loading, onClick }) => {
  const locked = !unlockedAt;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`relative aspect-square rounded-md border-2 bg-muted/30 flex flex-col items-center justify-center p-1 text-center transition-all hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        locked
          ? eligible
            ? `${rarityClass[a.rarity]} animate-pulse [box-shadow:0_0_18px_currentColor] cursor-pointer`
            : 'border-muted-foreground/15 text-muted-foreground/50'
          : `${rarityClass[a.rarity]} [box-shadow:0_0_12px_currentColor]`
      }`}
      title={
        locked && eligible
          ? `${a.name} — tap to unlock!`
          : `${a.name} — ${a.description}`
      }
    >
      <div className={`text-2xl leading-none ${locked && !eligible ? 'grayscale opacity-60' : ''}`}>
        {locked ? (eligible ? '✨' : '🔒') : a.icon}
      </div>
      <div className="font-mono text-[8px] uppercase tracking-wider mt-1 leading-tight line-clamp-2">
        {a.name}
      </div>
      {locked && eligible && (
        <div className="absolute -top-1 -right-1 px-1 py-0.5 rounded bg-primary text-primary-foreground font-mono text-[7px] font-bold uppercase tracking-wider glow-primary">
          Claim
        </div>
      )}
      <div className="absolute left-1 right-1 bottom-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${locked ? (eligible ? 'bg-current' : 'bg-muted-foreground/50') : 'bg-current'}`}
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
  readOnly?: boolean;
}> = ({ a, unlockedAt, progress, readOnly }) => {
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

        {!locked && !readOnly && <ShareActions a={a} unlockedAt={unlockedAt!} />}
      </div>
    </>
  );
};

const ShareActions: React.FC<{ a: Achievement; unlockedAt: string }> = ({ a, unlockedAt }) => {
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await generateBadgeImage(a, unlockedAt);
      const file = new File([blob], `${a.id}-badge.png`, { type: 'image/png' });
      const text = shareBadgeText(a, unlockedAt);
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${a.name} — Vault Breaker`,
          text,
        });
      } else if (navigator.share) {
        await navigator.share({ title: `${a.name} — Vault Breaker`, text });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${a.id}-badge.png`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Badge image downloaded');
      }
    } catch (err) {
      const name = (err as Error)?.name;
      if (name !== 'AbortError') toast.error('Could not share badge');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareBadgeText(a, unlockedAt));
      toast.success('Badge text copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await generateBadgeImage(a, unlockedAt);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${a.id}-badge.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not generate image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-2 border-t border-border">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
        Share badge
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleShare}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-primary text-primary-foreground font-mono text-[11px] font-bold glow-primary hover:opacity-90 transition disabled:opacity-50"
        >
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-muted text-foreground font-mono text-[11px] hover:bg-muted/70 transition disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> Image
        </button>
        <button
          onClick={handleCopyText}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-muted text-foreground font-mono text-[11px] hover:bg-muted/70 transition"
        >
          <Copy className="w-3.5 h-3.5" /> Text
        </button>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);

export default AchievementsCard;
