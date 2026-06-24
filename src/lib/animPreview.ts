import type { Anim } from '../model/shapes';

export interface AnimXform { rot: number; scale: number; dy: number; alpha: number | null; }
const IDENTITY: AnimXform = { rot: 0, scale: 1, dy: 0, alpha: null };

function ease(kind: Anim['easing'], t: number): number {
  switch (kind) {
    case 'linear': return t;
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    default: return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOut
  }
}

function phase(a: Anim, clock: number): number {
  const d = Math.max(1, a.duration);
  let x = (clock - a.delay) / d;
  if (x < 0) x = 0;
  let t: number;
  if (a.repeat === 'once') t = Math.min(1, x);
  else if (a.repeat === 'reverse') { const u = x % 2; t = u <= 1 ? u : 2 - u; }
  else t = x % 1;
  return ease(a.easing, t);
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Live editor preview transform for the transform/opacity presets.
// dash + trace are export-only (return identity here).
export function animXform(a: Anim | undefined, clock: number): AnimXform {
  if (!a || a.preset === 'none') return IDENTITY;
  const t = phase(a, clock);
  switch (a.preset) {
    case 'spin': return { ...IDENTITY, rot: 360 * t };
    case 'wiggle': return { ...IDENTITY, rot: lerp(-a.amount * 12, a.amount * 12, t) };
    case 'pulse': return { ...IDENTITY, scale: lerp(1, 1 + a.amount * 0.2, t) };
    case 'float': return { ...IDENTITY, dy: lerp(0, -a.amount * 12, t) };
    case 'fade': return { ...IDENTITY, alpha: lerp(0.2, 1, t) };
    default: return IDENTITY; // dash / trace
  }
}
