// Shape Model -> Jetpack Compose `Canvas { }` DrawScope code.

import type { Shape, PathNode } from '../model/shapes';
import { bbox, center, polygonPoints } from '../model/shapes';
import type { Artboard, CodeOptions } from '../store/useStore';
import { ax, ay, colorLiteral, f, paintArg } from './utils';
import type { Ctx } from './utils';
import { planAnim } from './anim';
import type { ShapeAnimApply } from './anim';

export function generateCanvas(shapes: Shape[], artboard: Artboard, opts: CodeOptions): string {
  const imports = new Set<string>([
    'import androidx.compose.foundation.Canvas',
    'import androidx.compose.runtime.Composable',
    'import androidx.compose.ui.Modifier',
  ]);
  // fitParent makes the Canvas fill its parent width and keep the aspect ratio,
  // so the drawing scales with the device (dp-adaptive) — and forces relative coords.
  const fit = opts.fitParent;
  if (fit) { imports.add('import androidx.compose.foundation.layout.fillMaxWidth'); imports.add('import androidx.compose.foundation.layout.aspectRatio'); }
  else { imports.add('import androidx.compose.foundation.layout.size'); imports.add('import androidx.compose.ui.unit.dp'); }
  const c: Ctx = { relative: opts.relative || fit, width: artboard.width, height: artboard.height, fmt: opts.colorFormat, imports };
  const plan = planAnim(shapes, c);

  const body: string[] = [];
  shapes.forEach((s, i) => {
    if (!s.visible) return;
    const ap = plan.apply(i);
    body.push(`// ${s.name}`);
    let lines = emitShape(s, i, c, ap);
    lines = wrapStaticRotation(s, lines, c);
    lines = wrapAnim(s, lines, ap, c);
    body.push(...lines);
    body.push('');
  });
  if (body[body.length - 1] === '') body.pop();

  const mod = opts.modifierParam ? 'modifier: Modifier = Modifier' : '';
  const modUse = opts.modifierParam ? 'modifier' : 'Modifier';
  const animDecls = plan.decls.length ? [...indent(plan.decls, 1), ''] : [];
  const canvasMod = fit
    ? `${modUse}.fillMaxWidth().aspectRatio(${f(artboard.width / artboard.height)})`
    : `${modUse}.size(${f(artboard.width)}.dp, ${f(artboard.height)}.dp)`;
  const header = [
    '@Composable',
    `fun ${opts.funcName}(${mod}) {`,
    ...animDecls,
    `    Canvas(${canvasMod}) {`,
  ];
  const footer = ['    }', '}'];

  const importBlock = opts.includeImports ? [...[...imports].sort(), ''] : [];
  return [...importBlock, ...header, ...indent(body, 2), ...footer].join('\n');
}

function indent(lines: string[], level: number): string[] {
  const pad = '    '.repeat(level);
  return lines.map((l) => (l ? pad + l : l));
}

/* static rotation wrapper (polygon bakes rotation into its points instead) */
function wrapStaticRotation(s: Shape, draws: string[], c: Ctx): string[] {
  if (!s.rotation || s.type === 'polygon' || s.type === 'line') return draws;
  const { cx, cy } = center(s);
  c.imports.add('import androidx.compose.ui.graphics.drawscope.rotate');
  c.imports.add('import androidx.compose.ui.geometry.Offset');
  return [`rotate(degrees = ${f(s.rotation)}, pivot = Offset(${ax(cx, c)}, ${ay(cy, c)})) {`, ...indent(draws, 1), '}'];
}

/* animated transform wrappers (translate -> scale -> rotate) */
function wrapAnim(s: Shape, draws: string[], ap: ShapeAnimApply | null, c: Ctx): string[] {
  if (!ap) return draws;
  const { cx, cy } = center(s);
  const pivot = `pivot = Offset(${ax(cx, c)}, ${ay(cy, c)})`;
  let out = draws;
  if (ap.rotate) { c.imports.add('import androidx.compose.ui.graphics.drawscope.rotate'); c.imports.add('import androidx.compose.ui.geometry.Offset'); out = [`rotate(degrees = ${ap.rotate}, ${pivot}) {`, ...indent(out, 1), '}']; }
  if (ap.scale) { c.imports.add('import androidx.compose.ui.graphics.drawscope.scale'); c.imports.add('import androidx.compose.ui.geometry.Offset'); out = [`scale(scaleX = ${ap.scale}, scaleY = ${ap.scale}, ${pivot}) {`, ...indent(out, 1), '}']; }
  if (ap.translateY) { c.imports.add('import androidx.compose.ui.graphics.drawscope.translate'); out = [`translate(top = ${ap.translateY}) {`, ...indent(out, 1), '}']; }
  return out;
}

/* shared extras appended to a draw call */
function extras(s: Shape, c: Ctx, ap: ShapeAnimApply | null): string[] {
  const out: string[] = [];
  if (ap?.alpha) out.push(`alpha = ${ap.alpha}`);
  else if (s.opacity < 1) out.push(`alpha = ${f(s.opacity)}`);
  if (s.blend !== 'SrcOver') {
    c.imports.add('import androidx.compose.ui.graphics.BlendMode');
    out.push(`blendMode = BlendMode.${s.blend}`);
  }
  return out;
}

function strokeStyle(s: Shape, c: Ctx, ap: ShapeAnimApply | null): string {
  c.imports.add('import androidx.compose.ui.graphics.drawscope.Stroke');
  const args = [`width = ${f(s.strokeWidth)}`];
  if (s.cap !== 'Butt') {
    c.imports.add('import androidx.compose.ui.graphics.StrokeCap');
    args.push(`cap = StrokeCap.${s.cap}`);
  }
  if (s.join !== 'Miter') {
    c.imports.add('import androidx.compose.ui.graphics.StrokeJoin');
    args.push(`join = StrokeJoin.${s.join}`);
  }
  if (s.dash.length || ap?.dashPhase) {
    c.imports.add('import androidx.compose.ui.graphics.PathEffect');
    const dashArr = s.dash.length ? s.dash : [12, 12];
    args.push(`pathEffect = PathEffect.dashPathEffect(floatArrayOf(${dashArr.map(f).join(', ')}), ${ap?.dashPhase ?? '0f'})`);
  }
  return `style = Stroke(${args.join(', ')})`;
}

function call(name: string, args: string[]): string[] {
  return [`${name}(`, ...args.map((a) => `    ${a},`), ')'];
}

function emitShape(s: Shape, i: number, c: Ctx, ap: ShapeAnimApply | null): string[] {
  const box = bbox(s);
  const fill = paintArg(s.fill, box, c);
  const stroke = paintArg(s.stroke, box, c);
  const ex = extras(s, c, ap);
  const out: string[] = [];

  const Offset = () => c.imports.add('import androidx.compose.ui.geometry.Offset');
  const Size = () => c.imports.add('import androidx.compose.ui.geometry.Size');

  switch (s.type) {
    case 'rect': {
      const uniform = s.corners.every((v) => v === s.corners[0]);
      Offset(); Size();
      const tl = `topLeft = Offset(${ax(s.x, c)}, ${ay(s.y, c)})`;
      const sz = `size = Size(${ax(s.width, c)}, ${ay(s.height, c)})`;
      if (uniform && s.corners[0] === 0) {
        if (fill) out.push(...call('drawRect', [fill, tl, sz, ...ex]));
        if (stroke) out.push(...call('drawRect', [stroke, tl, sz, ...ex, strokeStyle(s, c, ap)]));
      } else if (uniform) {
        c.imports.add('import androidx.compose.ui.geometry.CornerRadius');
        const cr = `cornerRadius = CornerRadius(${f(s.corners[0])}, ${f(s.corners[0])})`;
        if (fill) out.push(...call('drawRoundRect', [fill, tl, sz, cr, ...ex]));
        if (stroke) out.push(...call('drawRoundRect', [stroke, tl, sz, cr, ...ex, strokeStyle(s, c, ap)]));
      } else {
        out.push(...perCornerRect(s, i, c, fill, stroke, ex, ap));
      }
      break;
    }
    case 'ellipse': {
      Offset(); Size();
      const tl = `topLeft = Offset(${ax(s.x, c)}, ${ay(s.y, c)})`;
      const sz = `size = Size(${ax(s.width, c)}, ${ay(s.height, c)})`;
      if (fill) out.push(...call('drawOval', [fill, tl, sz, ...ex]));
      if (stroke) out.push(...call('drawOval', [stroke, tl, sz, ...ex, strokeStyle(s, c, ap)]));
      break;
    }
    case 'arc': {
      Offset(); Size();
      const geo = [
        `startAngle = ${f(s.startAngle)}`,
        `sweepAngle = ${f(s.sweepAngle)}`,
        `useCenter = ${s.useCenter}`,
        `topLeft = Offset(${ax(s.x, c)}, ${ay(s.y, c)})`,
        `size = Size(${ax(s.width, c)}, ${ay(s.height, c)})`,
      ];
      if (fill) out.push(...call('drawArc', [fill, ...geo, ...ex]));
      if (stroke) out.push(...call('drawArc', [stroke, ...geo, ...ex, strokeStyle(s, c, ap)]));
      break;
    }
    case 'polygon': {
      const pts = polygonPoints(box, s.sides, s.innerRatio, s.rotation);
      out.push(...buildPath(pts, true, false, i, c));
      let pv = `path${i}`;
      if (ap?.trace) { out.push(...traceSegment(i, true, ap.trace, c)); pv = `seg${i}`; }
      if (fill) out.push(...call('drawPath', [`path = ${pv}`, fill, ...ex]));
      if (stroke) out.push(...call('drawPath', [`path = ${pv}`, stroke, ...ex, strokeStyle(s, c, ap)]));
      break;
    }
    case 'line': {
      Offset();
      const p = s.points;
      if (!stroke && !fill) c.imports.add('import androidx.compose.ui.graphics.Color');
      const paint = stroke || fill || `color = ${colorLiteral('#000000', c.fmt)}`;
      if (ap?.trace) {
        out.push(...buildPath(p, false, false, i, c));
        out.push(...traceSegment(i, false, ap.trace, c));
        out.push(...call('drawPath', [`path = seg${i}`, paint, ...ex, strokeStyle(s, c, ap)]));
        break;
      }
      const args = [
        paint,
        `start = Offset(${ax(p[0], c)}, ${ay(p[1], c)})`,
        `end = Offset(${ax(p[2], c)}, ${ay(p[3], c)})`,
        `strokeWidth = ${f(s.strokeWidth)}`,
      ];
      if (s.cap !== 'Butt') {
        c.imports.add('import androidx.compose.ui.graphics.StrokeCap');
        args.push(`cap = StrokeCap.${s.cap}`);
      }
      if (s.dash.length || ap?.dashPhase) {
        c.imports.add('import androidx.compose.ui.graphics.PathEffect');
        const dashArr = s.dash.length ? s.dash : [12, 12];
        args.push(`pathEffect = PathEffect.dashPathEffect(floatArrayOf(${dashArr.map(f).join(', ')}), ${ap?.dashPhase ?? '0f'})`);
      }
      args.push(...ex);
      out.push(...call('drawLine', args));
      break;
    }
    case 'path': {
      if (s.nodes.length < 2) break;
      out.push(...buildBezierPath(s.nodes, s.closed, s.evenOdd, i, c));
      let pv = `path${i}`;
      if (ap?.trace) { out.push(...traceSegment(i, s.closed, ap.trace, c)); pv = `seg${i}`; }
      if (fill) out.push(...call('drawPath', [`path = ${pv}`, fill, ...ex]));
      if (stroke) out.push(...call('drawPath', [`path = ${pv}`, stroke, ...ex, strokeStyle(s, c, ap)]));
      break;
    }
  }
  return out;
}

function traceSegment(i: number, closed: boolean, traceVar: string, c: Ctx): string[] {
  c.imports.add('import androidx.compose.ui.graphics.PathMeasure');
  c.imports.add('import androidx.compose.ui.graphics.Path');
  return [
    `val measure${i} = PathMeasure().apply { setPath(path${i}, ${closed}) }`,
    `val seg${i} = Path()`,
    `measure${i}.getSegment(0f, measure${i}.length * ${traceVar}, seg${i}, true)`,
  ];
}

function buildPath(pts: number[], closed: boolean, evenOdd: boolean, i: number, c: Ctx): string[] {
  c.imports.add('import androidx.compose.ui.graphics.Path');
  const lines = [`val path${i} = Path().apply {`];
  for (let k = 0; k < pts.length; k += 2) {
    lines.push(`    ${k === 0 ? 'moveTo' : 'lineTo'}(${ax(pts[k], c)}, ${ay(pts[k + 1], c)})`);
  }
  if (closed) lines.push('    close()');
  lines.push('}');
  if (evenOdd) {
    c.imports.add('import androidx.compose.ui.graphics.PathFillType');
    lines.push(`path${i}.fillType = PathFillType.EvenOdd`);
  }
  return lines;
}

function buildBezierPath(nodes: PathNode[], closed: boolean, evenOdd: boolean, i: number, c: Ctx): string[] {
  c.imports.add('import androidx.compose.ui.graphics.Path');
  const lines = [`val path${i} = Path().apply {`];
  lines.push(`    moveTo(${ax(nodes[0].x, c)}, ${ay(nodes[0].y, c)})`);
  const seg = (a: PathNode, b: PathNode) => {
    const c1 = a.hOut, c2 = b.hIn;
    if (!c1 && !c2) lines.push(`    lineTo(${ax(b.x, c)}, ${ay(b.y, c)})`);
    else if (c1 && c2) lines.push(`    cubicTo(${ax(c1[0], c)}, ${ay(c1[1], c)}, ${ax(c2[0], c)}, ${ay(c2[1], c)}, ${ax(b.x, c)}, ${ay(b.y, c)})`);
    else { const h = (c1 || c2)!; lines.push(`    quadraticBezierTo(${ax(h[0], c)}, ${ay(h[1], c)}, ${ax(b.x, c)}, ${ay(b.y, c)})`); }
  };
  for (let k = 0; k < nodes.length - 1; k++) seg(nodes[k], nodes[k + 1]);
  if (closed) { seg(nodes[nodes.length - 1], nodes[0]); lines.push('    close()'); }
  lines.push('}');
  if (evenOdd) {
    c.imports.add('import androidx.compose.ui.graphics.PathFillType');
    lines.push(`path${i}.fillType = PathFillType.EvenOdd`);
  }
  return lines;
}

function perCornerRect(s: Shape & { type: 'rect' }, i: number, c: Ctx, fill: string | null, stroke: string | null, ex: string[], ap: ShapeAnimApply | null): string[] {
  c.imports.add('import androidx.compose.ui.graphics.Path');
  c.imports.add('import androidx.compose.ui.geometry.Rect');
  c.imports.add('import androidx.compose.ui.geometry.RoundRect');
  c.imports.add('import androidx.compose.ui.geometry.CornerRadius');
  const [tl, tr, br, bl] = s.corners;
  const r = `Rect(${ax(s.x, c)}, ${ay(s.y, c)}, ${ax(s.x + s.width, c)}, ${ay(s.y + s.height, c)})`;
  const lines = [
    `val path${i} = Path().apply {`,
    `    addRoundRect(`,
    `        RoundRect(`,
    `            rect = ${r},`,
    `            topLeft = CornerRadius(${f(tl)}, ${f(tl)}),`,
    `            topRight = CornerRadius(${f(tr)}, ${f(tr)}),`,
    `            bottomRight = CornerRadius(${f(br)}, ${f(br)}),`,
    `            bottomLeft = CornerRadius(${f(bl)}, ${f(bl)}),`,
    `        ),`,
    `    )`,
    `}`,
  ];
  const pv = `path${i}`;
  if (fill) lines.push(...call('drawPath', [`path = ${pv}`, fill, ...ex]));
  if (stroke) lines.push(...call('drawPath', [`path = ${pv}`, stroke, ...ex, strokeStyle(s, c, ap)]));
  return lines;
}
