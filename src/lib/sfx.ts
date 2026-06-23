/**
 * Lightweight sound + haptics helper. Uses WebAudio to synthesize short tones
 * so we don't ship any audio asset files. Honors per-user toggles stored in
 * localStorage. Safe to call from anywhere — no-ops on the server.
 */

const SOUND_KEY = 'vb_sound_enabled';
const HAPTIC_KEY = 'vb_haptics_enabled';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOUND_KEY) !== '0';
}

export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(HAPTIC_KEY) !== '0';
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  window.dispatchEvent(new Event('vb-sfx-settings'));
}

export function setHapticsEnabled(on: boolean) {
  localStorage.setItem(HAPTIC_KEY, on ? '1' : '0');
  window.dispatchEvent(new Event('vb-sfx-settings'));
}

interface ToneOpts {
  freq: number;
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  delay?: number;
}

function tone({ freq, duration, type = 'square', gain = 0.08, attack = 0.005, release = 0.05, delay = 0 }: ToneOpts) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + attack);
  g.gain.linearRampToValueAtTime(0, now + duration + release);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + duration + release + 0.02);
}

export function vibrate(pattern: number | number[]) {
  if (!isHapticsEnabled()) return;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

/* ---------- High-level event helpers ---------- */

export const sfx = {
  tap() {
    if (isSoundEnabled()) tone({ freq: 660, duration: 0.03, type: 'square', gain: 0.05 });
    vibrate(8);
  },
  type() {
    if (isSoundEnabled()) tone({ freq: 880, duration: 0.025, type: 'triangle', gain: 0.04 });
    vibrate(5);
  },
  error() {
    if (isSoundEnabled()) {
      tone({ freq: 200, duration: 0.08, type: 'sawtooth', gain: 0.07 });
      tone({ freq: 160, duration: 0.1, type: 'sawtooth', gain: 0.06, delay: 0.06 });
    }
    vibrate([30, 40, 30]);
  },
  submit() {
    if (isSoundEnabled()) {
      tone({ freq: 520, duration: 0.05, type: 'square', gain: 0.06 });
      tone({ freq: 780, duration: 0.06, type: 'square', gain: 0.06, delay: 0.05 });
    }
    vibrate(12);
  },
  win() {
    if (isSoundEnabled()) {
      tone({ freq: 523, duration: 0.1, type: 'triangle', gain: 0.08, delay: 0 });
      tone({ freq: 659, duration: 0.1, type: 'triangle', gain: 0.08, delay: 0.1 });
      tone({ freq: 784, duration: 0.12, type: 'triangle', gain: 0.08, delay: 0.2 });
      tone({ freq: 1046, duration: 0.22, type: 'triangle', gain: 0.09, delay: 0.32 });
    }
    vibrate([40, 50, 40, 50, 120]);
  },
  lose() {
    if (isSoundEnabled()) {
      tone({ freq: 330, duration: 0.15, type: 'sawtooth', gain: 0.08 });
      tone({ freq: 220, duration: 0.2, type: 'sawtooth', gain: 0.08, delay: 0.15 });
      tone({ freq: 140, duration: 0.3, type: 'sawtooth', gain: 0.08, delay: 0.32 });
    }
    vibrate([80, 60, 160]);
  },
  tick() {
    if (isSoundEnabled()) tone({ freq: 1200, duration: 0.04, type: 'square', gain: 0.05 });
  },
  warn() {
    if (isSoundEnabled()) tone({ freq: 1500, duration: 0.08, type: 'square', gain: 0.07 });
    vibrate(20);
  },
};
