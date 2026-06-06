import { Achievement, rarityLabel } from '@/game/achievements';

const RARITY_COLOR: Record<Achievement['rarity'], string> = {
  common: '#9ca3af',
  rare: '#22d3ee',
  epic: '#f59e0b',
  legendary: '#22ff88',
};

export function formatBadgeTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shareBadgeText(a: Achievement, unlockedAt: string): string {
  return [
    `🏆 ${a.name} — ${rarityLabel[a.rarity]}`,
    a.description,
    `Unlocked: ${formatBadgeTimestamp(unlockedAt)}`,
    `#VaultBreaker #CrackTheCode`,
  ].join('\n');
}

/** Render a 1080x1080 PNG card with the badge, rarity and unlock time. */
export async function generateBadgeImage(a: Achievement, unlockedAt: string): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(1, '#0b1220');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle grid
  ctx.strokeStyle = 'rgba(34, 255, 136, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 48) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const accent = RARITY_COLOR[a.rarity];

  // Outer frame
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 40;
  roundRect(ctx, 60, 60, size - 120, size - 120, 36);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Header
  ctx.fillStyle = '#22ff88';
  ctx.font = 'bold 38px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('VAULT_BREAKER.exe', 110, 150);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '26px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('> ACHIEVEMENT UNLOCKED', 110, 190);

  // Icon (emoji)
  ctx.textAlign = 'center';
  ctx.font = '260px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.fillText(a.icon, size / 2, 510);

  // Name
  ctx.fillStyle = accent;
  ctx.font = 'bold 72px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 30;
  ctx.fillText(a.name.toUpperCase(), size / 2, 620);
  ctx.shadowBlur = 0;

  // Rarity pill
  const rarity = rarityLabel[a.rarity].toUpperCase();
  ctx.font = 'bold 28px ui-monospace, SFMono-Regular, Menlo, monospace';
  const pillW = ctx.measureText(rarity).width + 60;
  const pillX = (size - pillW) / 2;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  roundRect(ctx, pillX, 660, pillW, 54, 27);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillText(rarity, size / 2, 697);

  // Description (wrapped)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '30px ui-monospace, SFMono-Regular, Menlo, monospace';
  wrapText(ctx, a.description, size / 2, 780, size - 240, 40);

  // Criteria
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '24px ui-monospace, SFMono-Regular, Menlo, monospace';
  wrapText(ctx, a.criteria, size / 2, 870, size - 260, 32);

  // Unlocked timestamp
  ctx.fillStyle = '#22ff88';
  ctx.font = 'bold 26px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`UNLOCKED · ${formatBadgeTimestamp(unlockedAt)}`, size / 2, size - 100);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob-failed'))), 'image/png');
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}
