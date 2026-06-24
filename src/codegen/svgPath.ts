// Shape -> SVG path `d` (absolute coords, rotation NOT baked — caller adds a
// transform). Shared by the export formats and the shape-library thumbnails.

import type { Shape, PathNode } from '../model/shapes';
import { bbox, polygonPoints } from '../model/shapes';

const n = (v: number) => Math.round(v * 100) / 100;

function roundedRect(x: number, y: number, w: number, h: number, c: [number, number, number, number]): string {
  let [tl, tr, br, bl] = c;
  const m = Math.min(w, h) / 2; tl = Math.min(tl, m); tr = Math.min(tr, m); br = Math.min(br, m); bl = Math.min(bl, m);
  return [
    `M${n(x + tl)},${n(y)}`,
    `H${n(x + w - tr)}`, tr ? `A${n(tr)},${n(tr)} 0 0 1 ${n(x + w)},${n(y + tr)}` : '',
    `V${n(y + h - br)}`, br ? `A${n(br)},${n(br)} 0 0 1 ${n(x + w - br)},${n(y + h)}` : '',
    `H${n(x + bl)}`, bl ? `A${n(bl)},${n(bl)} 0 0 1 ${n(x)},${n(y + h - bl)}` : '',
    `V${n(y + tl)}`, tl ? `A${n(tl)},${n(tl)} 0 0 1 ${n(x + tl)},${n(y)}` : '',
    'Z',
  ].filter(Boolean).join(' ');
}

function polyD(pts: number[], closed: boolean): string {
  let d = `M${n(pts[0])},${n(pts[1])}`;
  for (let i = 2; i < pts.length; i += 2) d += ` L${n(pts[i])},${n(pts[i + 1])}`;
  return d + (closed ? ' Z' : '');
}

export function shapeToD(s: Shape): string {
  const b = bbox(s);
  switch (s.type) {
    case 'rect': return roundedRect(s.x, s.y, s.width, s.height, s.corners);
    case 'ellipse': {
      const rx = s.width / 2, ry = s.height / 2, cx = s.x + rx, cy = s.y + ry;
      return `M${n(cx - rx)},${n(cy)} a${n(rx)},${n(ry)} 0 1 1 ${n(rx * 2)},0 a${n(rx)},${n(ry)} 0 1 1 ${n(-rx * 2)},0 Z`;
    }
    case 'arc': {
      const rx = s.width / 2, ry = s.height / 2, cx = s.x + rx, cy = s.y + ry;
      const a0 = (s.startAngle * Math.PI) / 180, a1 = ((s.startAngle + s.sweepAngle) * Math.PI) / 180;
      const x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
      const x1 = cx + rx * Math.cos(a1), y1 = cy + ry * Math.sin(a1);
      const large = Math.abs(s.sweepAngle) > 180 ? 1 : 0, sweep = s.sweepAngle > 0 ? 1 : 0;
      let d = s.useCenter ? `M${n(cx)},${n(cy)} L${n(x0)},${n(y0)}` : `M${n(x0)},${n(y0)}`;
      d += ` A${n(rx)},${n(ry)} 0 ${large} ${sweep} ${n(x1)},${n(y1)}`;
      return d + (s.useCenter ? ' Z' : '');
    }
    case 'polygon': return polyD(polygonPoints(b, s.sides, s.innerRatio, 0), true);
    case 'line': return polyD(s.points, false);
    case 'path': {
      const nodes = s.nodes; if (nodes.length < 2) return '';
      let d = `M${n(nodes[0].x)},${n(nodes[0].y)}`;
      const seg = (a: PathNode, bb: PathNode) => {
        const c1 = a.hOut, c2 = bb.hIn;
        if (!c1 && !c2) d += ` L${n(bb.x)},${n(bb.y)}`;
        else if (c1 && c2) d += ` C${n(c1[0])},${n(c1[1])} ${n(c2[0])},${n(c2[1])} ${n(bb.x)},${n(bb.y)}`;
        else { const h = (c1 || c2)!; d += ` Q${n(h[0])},${n(h[1])} ${n(bb.x)},${n(bb.y)}`; }
      };
      for (let k = 0; k < nodes.length - 1; k++) seg(nodes[k], nodes[k + 1]);
      if (s.closed) { seg(nodes[nodes.length - 1], nodes[0]); d += ' Z'; }
      return d;
    }
  }
}

export const rotationTransform = (s: Shape): string => {
  if (!s.rotation || s.type === 'polygon') return '';
  const b = bbox(s);
  return `rotate(${n(s.rotation)} ${n(b.x + b.w / 2)} ${n(b.y + b.h / 2)})`;
};
