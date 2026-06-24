// Non-Compose export targets, all driven from shapeToD().
import type { Paint, Shape } from '../model/shapes';
import { bbox } from '../model/shapes';
import type { Artboard, CodeOptions } from '../store/useStore';
import { shapeToD, rotationTransform } from './svgPath';

const hex6 = (c: string) => { let h = c.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return '#' + h.toUpperCase(); };
const solidOf = (p: Paint) => (p.type === 'solid' ? hex6(p.color) : p.type === 'none' ? 'none' : hex6(p.stops[0]?.color || '#000000'));

/* ---------- SVG (+ gradients via defs) ---------- */
function svgGrad(p: Paint, s: Shape, id: string): { ref: string; def: string } | null {
  if (p.type === 'none' || p.type === 'solid') return null;
  const b = bbox(s);
  const stops = p.stops.slice().sort((a, c) => a.pos - c.pos)
    .map((st) => `<stop offset="${Math.round(st.pos * 100)}%" stop-color="${hex6(st.color)}"/>`).join('');
  if (p.type === 'radial') {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
    return { ref: `url(#${id})`, def: `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops}</radialGradient>` };
  }
  const rad = (p.angle * Math.PI) / 180, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const len = Math.abs(b.w * Math.cos(rad)) + Math.abs(b.h * Math.sin(rad));
  const x1 = cx - Math.cos(rad) * len / 2, y1 = cy - Math.sin(rad) * len / 2, x2 = cx + Math.cos(rad) * len / 2, y2 = cy + Math.sin(rad) * len / 2;
  return { ref: `url(#${id})`, def: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>` };
}

function svgPaths(shapes: Shape[]): { defs: string[]; paths: string[] } {
  const defs: string[] = []; const paths: string[] = [];
  shapes.forEach((s, i) => {
    if (!s.visible) return; const d = shapeToD(s); if (!d) return;
    const fg = svgGrad(s.fill, s, `f${i}`); if (fg) defs.push(fg.def);
    const sg = svgGrad(s.stroke, s, `s${i}`); if (sg) defs.push(sg.def);
    const a = [`d="${d}"`, `fill="${fg ? fg.ref : solidOf(s.fill)}"`];
    if (s.stroke.type !== 'none') {
      a.push(`stroke="${sg ? sg.ref : solidOf(s.stroke)}"`, `stroke-width="${s.strokeWidth}"`);
      if (s.cap !== 'Butt') a.push(`stroke-linecap="${s.cap.toLowerCase()}"`);
      if (s.join !== 'Miter') a.push(`stroke-linejoin="${s.join.toLowerCase()}"`);
      if (s.dash.length) a.push(`stroke-dasharray="${s.dash.join(' ')}"`);
    }
    if (s.opacity < 1) a.push(`opacity="${s.opacity}"`);
    const rot = rotationTransform(s); if (rot) a.push(`transform="${rot}"`);
    paths.push(`  <path ${a.join(' ')}/>`);
  });
  return { defs, paths };
}

export function generateSVG(shapes: Shape[], ab: Artboard): string {
  const { defs, paths } = svgPaths(shapes);
  const bg = ab.background ? `  <rect width="${ab.width}" height="${ab.height}" fill="${hex6(ab.background)}"/>\n` : '';
  const d = defs.length ? `  <defs>\n${defs.map((x) => '    ' + x).join('\n')}\n  </defs>\n` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ab.width}" height="${ab.height}" viewBox="0 0 ${ab.width} ${ab.height}">\n${d}${bg}${paths.join('\n')}\n</svg>`;
}

export function generateReactSVG(shapes: Shape[], ab: Artboard, opts: CodeOptions): string {
  const { defs, paths } = svgPaths(shapes);
  const jsx = (s: string) => s
    .replace(/stroke-width=/g, 'strokeWidth=').replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=').replace(/stroke-dasharray=/g, 'strokeDasharray=')
    .replace(/stop-color=/g, 'stopColor=');
  const inner = [...defs.map((x) => '      <defs>' + jsx(x) + '</defs>'), ...paths.map((p) => '    ' + jsx(p.trim()))].join('\n');
  return `export function ${opts.funcName}() {\n  return (\n    <svg xmlns="http://www.w3.org/2000/svg" width="${ab.width}" height="${ab.height}" viewBox="0 0 ${ab.width} ${ab.height}">\n${inner}\n    </svg>\n  );\n}`;
}

/* ---------- Android VectorDrawable (solid paints) ---------- */
function vdColor(p: Paint): string | null { const c = solidOf(p); return c === 'none' ? null : c; }
export function generateVectorDrawable(shapes: Shape[], ab: Artboard): string {
  const body: string[] = [];
  shapes.forEach((s) => {
    if (!s.visible) return; const d = shapeToD(s); if (!d) return;
    const a = [`android:pathData="${d}"`];
    const f = vdColor(s.fill); if (f) { a.push(`android:fillColor="${f}"`); if (s.opacity < 1) a.push(`android:fillAlpha="${s.opacity}"`); }
    const st = vdColor(s.stroke); if (st) { a.push(`android:strokeColor="${st}"`, `android:strokeWidth="${s.strokeWidth}"`); if (s.cap !== 'Butt') a.push(`android:strokeLineCap="${s.cap.toLowerCase()}"`); if (s.join !== 'Miter') a.push(`android:strokeLineJoin="${s.join.toLowerCase()}"`); }
    const path = `  <path\n${a.map((x) => '    ' + x).join('\n')} />`;
    const rot = rotationTransform(s);
    if (rot) { const b = bbox(s); body.push(`  <group android:rotation="${Math.round(s.rotation)}" android:pivotX="${Math.round(b.x + b.w / 2)}" android:pivotY="${Math.round(b.y + b.h / 2)}">\n  ${path}\n  </group>`); }
    else body.push(path);
  });
  return `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="${ab.width}dp"\n    android:height="${ab.height}dp"\n    android:viewportWidth="${ab.width}"\n    android:viewportHeight="${ab.height}">\n${body.join('\n')}\n</vector>`;
}

/* ---------- HTML Canvas (Path2D) ---------- */
export function generateCanvasJS(shapes: Shape[], _ab: Artboard, opts: CodeOptions): string {
  const lines: string[] = [`function ${opts.funcName.charAt(0).toLowerCase() + opts.funcName.slice(1)}(ctx) {`];
  shapes.forEach((s, i) => {
    if (!s.visible) return; const d = shapeToD(s); if (!d) return;
    const p = `p${i}`;
    lines.push(`  // ${s.name}`);
    lines.push('  ctx.save();');
    if (s.opacity < 1) lines.push(`  ctx.globalAlpha = ${s.opacity};`);
    const rot = rotationTransform(s);
    if (rot) { const b = bbox(s); const cx = b.x + b.w / 2, cy = b.y + b.h / 2; lines.push(`  ctx.translate(${cx}, ${cy}); ctx.rotate(${(s.rotation * Math.PI / 180).toFixed(4)}); ctx.translate(${-cx}, ${-cy});`); }
    lines.push(`  const ${p} = new Path2D(${JSON.stringify(d)});`);
    if (s.fill.type !== 'none') lines.push(`  ctx.fillStyle = ${JSON.stringify(solidOf(s.fill))}; ctx.fill(${p});`);
    if (s.stroke.type !== 'none') {
      lines.push(`  ctx.strokeStyle = ${JSON.stringify(solidOf(s.stroke))}; ctx.lineWidth = ${s.strokeWidth};`);
      if (s.cap !== 'Butt') lines.push(`  ctx.lineCap = ${JSON.stringify(s.cap.toLowerCase())};`);
      if (s.dash.length) lines.push(`  ctx.setLineDash([${s.dash.join(', ')}]);`); else lines.push('  ctx.setLineDash([]);');
      lines.push(`  ctx.stroke(${p});`);
    }
    lines.push('  ctx.restore();');
  });
  lines.push('}');
  return lines.join('\n');
}
