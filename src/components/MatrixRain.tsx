import React, { useEffect, useRef } from 'react';

/**
 * Lightweight matrix-style digit rain rendered onto a fixed full-screen canvas.
 * Sits behind page content; respects prefers-reduced-motion.
 */
const MatrixRain: React.FC<{ opacity?: number }> = ({ opacity = 0.18 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fontSize = 14;
    let columns = 0;
    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(window.innerWidth / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * -50);
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = '0123456789';
    let raf = 0;
    let last = 0;
    const interval = reduced ? 0 : 55; // ms between frames

    const draw = (now: number) => {
      if (reduced) return; // static; only painted once below
      if (now - last >= interval) {
        last = now;
        // fade trail
        ctx.fillStyle = 'rgba(8, 12, 22, 0.08)';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        ctx.font = `${fontSize}px JetBrains Mono, monospace`;
        for (let i = 0; i < columns; i++) {
          const ch = chars[(Math.random() * chars.length) | 0];
          const x = i * fontSize;
          const y = drops[i] * fontSize;
          // bright leading char
          ctx.fillStyle = 'hsla(155, 100%, 70%, 0.9)';
          ctx.fillText(ch, x, y);
          // trail color
          ctx.fillStyle = 'hsla(155, 100%, 45%, 0.5)';
          ctx.fillText(ch, x, y - fontSize);

          if (y > window.innerHeight && Math.random() > 0.975) drops[i] = 0;
          drops[i] += 1;
        }
      }
      raf = requestAnimationFrame(draw);
    };

    if (reduced) {
      ctx.fillStyle = 'rgba(8, 12, 22, 1)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity }}
    />
  );
};

export default MatrixRain;
