import type { Box, Paint } from '../model/shapes';
import type { ColorFormat } from '../store/useStore';

// Kotlin Float literal: 12 -> "12f", 12.5 -> "12.5f"
export function f(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return `${r}f`;
}

function normHex(hex: string): string {
  let h = hex.replace('#', '').toUpperCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6) h = 'FF' + h;
  return h; // AARRGGBB
}

export function colorLiteral(hex: string, fmt: ColorFormat): string {
  const h = normHex(hex);
  if (fmt === 'rgb') {
    const r = parseInt(h.slice(2, 4), 16);
    const g = parseInt(h.slice(4, 6), 16);
    const b = parseInt(h.slice(6, 8), 16);
    return `Color(red = ${r}, green = ${g}, blue = ${b})`;
  }
  return `Color(0x${h})`;
}

export interface Ctx {
  relative: boolean;
  width: number;
  height: number;
  fmt: ColorFormat;
  imports: Set<string>;
}

export const ax = (v: number, c: Ctx) => (c.relative ? `size.width * ${f(v / c.width)}` : f(v));
export const ay = (v: number, c: Ctx) => (c.relative ? `size.height * ${f(v / c.height)}` : f(v));
export const amin = (v: number, c: Ctx) =>
  c.relative ? `size.minDimension * ${f(v / Math.min(c.width, c.height))}` : f(v);

function stopsList(p: Paint, c: Ctx): string {
  return p.stops
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${f(s.pos)} to ${colorLiteral(s.color, c.fmt)}`)
    .join(', ');
}

// A Brush.* expression for a gradient paint (caller guarantees it's a gradient).
export function gradientBrush(p: Paint, box: Box, c: Ctx): string {
  c.imports.add('import androidx.compose.ui.graphics.Brush');
  c.imports.add('import androidx.compose.ui.graphics.Color');
  c.imports.add('import androidx.compose.ui.geometry.Offset');
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  if (p.type === 'linear') {
    const rad = (p.angle * Math.PI) / 180;
    const len = Math.abs(box.w * Math.cos(rad)) + Math.abs(box.h * Math.sin(rad));
    const sx = cx - (Math.cos(rad) * len) / 2;
    const sy = cy - (Math.sin(rad) * len) / 2;
    const exx = cx + (Math.cos(rad) * len) / 2;
    const eyy = cy + (Math.sin(rad) * len) / 2;
    return `Brush.linearGradient(${stopsList(p, c)}, start = Offset(${ax(sx, c)}, ${ay(sy, c)}), end = Offset(${ax(exx, c)}, ${ay(eyy, c)}))`;
  }
  if (p.type === 'radial') {
    const r = Math.max(box.w, box.h) / 2;
    return `Brush.radialGradient(${stopsList(p, c)}, center = Offset(${ax(cx, c)}, ${ay(cy, c)}), radius = ${amin(r, c)})`;
  }
  return `Brush.sweepGradient(${stopsList(p, c)}, center = Offset(${ax(cx, c)}, ${ay(cy, c)}))`;
}

// Draw-call argument for a paint: "color = Color(..)" or "brush = Brush...".
// Returns null for `none`.
export function paintArg(p: Paint, box: Box, c: Ctx): string | null {
  if (p.type === 'none') return null;
  c.imports.add('import androidx.compose.ui.graphics.Color');
  if (p.type === 'solid') return `color = ${colorLiteral(p.color, c.fmt)}`;
  return `brush = ${gradientBrush(p, box, c)}`;
}
