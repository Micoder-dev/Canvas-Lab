// Shape Model -> Jetpack Compose `ImageVector` builder code.
// Good for static icons/logos: one ImageVector, many vector paths.

import type { Paint, Shape } from '../model/shapes';
import { bbox, polygonPoints } from '../model/shapes';
import type { Artboard, CodeOptions } from '../store/useStore';
import { colorLiteral, f, gradientBrush } from './utils';
import type { Ctx } from './utils';

export function generateImageVector(shapes: Shape[], artboard: Artboard, opts: CodeOptions): string {
  const imports = new Set<string>([
    'import androidx.compose.ui.graphics.vector.ImageVector',
    'import androidx.compose.ui.graphics.vector.path',
    'import androidx.compose.ui.unit.dp',
  ]);
  // ImageVector uses viewport units; relative scaling is handled by viewport, so force absolute.
  const c: Ctx = { relative: false, width: artboard.width, height: artboard.height, fmt: opts.colorFormat, imports };

  const blocks: string[] = [];
  shapes.forEach((s) => {
    if (!s.visible) return;
    blocks.push(...pathBlock(s, c));
  });

  const head = [
    `val ${opts.funcName}: ImageVector = ImageVector.Builder(`,
    `    name = "${opts.funcName}",`,
    `    defaultWidth = ${f(artboard.width)}.dp,`,
    `    defaultHeight = ${f(artboard.height)}.dp,`,
    `    viewportWidth = ${f(artboard.width)},`,
    `    viewportHeight = ${f(artboard.height)},`,
    `).apply {`,
  ];
  const foot = ['}.build()'];

  const importBlock = opts.includeImports ? [...[...imports].sort(), ''] : [];
  return [...importBlock, ...head, ...indent(blocks, 1), ...foot].join('\n');
}

function indent(lines: string[], level: number): string[] {
  const pad = '    '.repeat(level);
  return lines.map((l) => (l ? pad + l : l));
}

function paintFill(p: Paint, s: Shape, c: Ctx): string | null {
  if (p.type === 'none') return null;
  if (p.type === 'solid') {
    c.imports.add('import androidx.compose.ui.graphics.SolidColor');
    c.imports.add('import androidx.compose.ui.graphics.Color');
    return `SolidColor(${colorLiteral(p.color, c.fmt)})`;
  }
  return gradientBrush(p, bbox(s), c);
}

function pathArgs(s: Shape, c: Ctx): string {
  const args: string[] = [];
  const fill = paintFill(s.fill, s, c);
  if (fill) args.push(`fill = ${fill}`);
  if (s.opacity < 1 && s.fill.type !== 'none') args.push(`fillAlpha = ${f(s.opacity)}`);
  const stroke = paintFill(s.stroke, s, c);
  if (stroke) {
    args.push(`stroke = ${stroke}`);
    args.push(`strokeLineWidth = ${f(s.strokeWidth)}`);
    if (s.opacity < 1) args.push(`strokeAlpha = ${f(s.opacity)}`);
    if (s.cap !== 'Butt') {
      c.imports.add('import androidx.compose.ui.graphics.StrokeCap');
      args.push(`strokeLineCap = StrokeCap.${s.cap}`);
    }
    if (s.join !== 'Miter') {
      c.imports.add('import androidx.compose.ui.graphics.StrokeJoin');
      args.push(`strokeLineJoin = StrokeJoin.${s.join}`);
    }
  }
  if (s.type === 'path' && s.evenOdd) {
    c.imports.add('import androidx.compose.ui.graphics.PathFillType');
    args.push(`pathFillType = PathFillType.EvenOdd`);
  }
  return args.join(', ');
}

function pathBlock(s: Shape, c: Ctx): string[] {
  const cmds = pathCommands(s);
  if (!cmds.length) return [];
  return [`path(${pathArgs(s, c)}) {`, ...cmds.map((l) => '    ' + l), '}'];
}

function poly(pts: number[], closed: boolean): string[] {
  const out: string[] = [];
  for (let k = 0; k < pts.length; k += 2) {
    out.push(`${k === 0 ? 'moveTo' : 'lineTo'}(${f(pts[k])}, ${f(pts[k + 1])})`);
  }
  if (closed) out.push('close()');
  return out;
}

function pathCommands(s: Shape): string[] {
  const b = bbox(s);
  switch (s.type) {
    case 'rect': {
      // ImageVector can't express per-corner radii simply; emit a sharp rect outline.
      return poly([s.x, s.y, s.x + s.width, s.y, s.x + s.width, s.y + s.height, s.x, s.y + s.height], true);
    }
    case 'ellipse': {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
      return [
        `moveTo(${f(cx - rx)}, ${f(cy)})`,
        `arcToRelative(${f(rx)}, ${f(ry)}, 0f, true, true, ${f(rx * 2)}, 0f)`,
        `arcToRelative(${f(rx)}, ${f(ry)}, 0f, true, true, ${f(-rx * 2)}, 0f)`,
        `close()`,
      ];
    }
    case 'arc': {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
      const a0 = (s.startAngle * Math.PI) / 180;
      const a1 = ((s.startAngle + s.sweepAngle) * Math.PI) / 180;
      const x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
      const x1 = cx + rx * Math.cos(a1), y1 = cy + ry * Math.sin(a1);
      const large = Math.abs(s.sweepAngle) > 180;
      const sweep = s.sweepAngle > 0;
      const out: string[] = [];
      if (s.useCenter) out.push(`moveTo(${f(cx)}, ${f(cy)})`, `lineTo(${f(x0)}, ${f(y0)})`);
      else out.push(`moveTo(${f(x0)}, ${f(y0)})`);
      out.push(`arcTo(${f(rx)}, ${f(ry)}, 0f, ${large}, ${sweep}, ${f(x1)}, ${f(y1)})`);
      if (s.useCenter) out.push('close()');
      return out;
    }
    case 'polygon':
      return poly(polygonPoints(b, s.sides, s.innerRatio, s.rotation), true);
    case 'line':
      return poly(s.points, false);
    case 'path': {
      const nodes = s.nodes;
      if (nodes.length < 2) return [];
      const out = [`moveTo(${f(nodes[0].x)}, ${f(nodes[0].y)})`];
      const seg = (a: typeof nodes[0], bn: typeof nodes[0]) => {
        const c1 = a.hOut, c2 = bn.hIn;
        if (!c1 && !c2) out.push(`lineTo(${f(bn.x)}, ${f(bn.y)})`);
        else if (c1 && c2) out.push(`curveTo(${f(c1[0])}, ${f(c1[1])}, ${f(c2[0])}, ${f(c2[1])}, ${f(bn.x)}, ${f(bn.y)})`);
        else { const h = (c1 || c2)!; out.push(`quadTo(${f(h[0])}, ${f(h[1])}, ${f(bn.x)}, ${f(bn.y)})`); }
      };
      for (let k = 0; k < nodes.length - 1; k++) seg(nodes[k], nodes[k + 1]);
      if (s.closed) { seg(nodes[nodes.length - 1], nodes[0]); out.push('close()'); }
      return out;
    }
  }
}
