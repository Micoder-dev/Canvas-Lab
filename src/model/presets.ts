// A searchable library of ready-made shapes. Each preset builds a Shape
// centered at (cx, cy) at the given size. Geometry is authored in a normalized
// [-0.5, 0.5] box (y down) and scaled.

import { makeShape, solid, none } from './shapes';
import type { Shape, PathShape, PathNode } from './shapes';

type Pt = [number, number];
const rotate = (pts: Pt[], deg: number): Pt[] => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c] as Pt);
};

export interface Preset { id: string; name: string; kw: string; build: (cx: number, cy: number, size: number) => Shape; }

function poly(pts: Pt[], closed = true): Preset['build'] {
  return (cx, cy, sz) => {
    const s = makeShape('path', 0, 0) as PathShape;
    s.nodes = pts.map(([x, y]) => ({ x: cx + x * sz, y: cy + y * sz, hIn: null, hOut: null }));
    s.closed = closed;
    if (!closed) { s.fill = none(); s.stroke = solid('#E8E8EC'); s.strokeWidth = 6; s.cap = 'Round'; s.join = 'Round'; }
    return s;
  };
}
function bez(nodes: { p: Pt; i?: Pt; o?: Pt }[], closed = true): Preset['build'] {
  return (cx, cy, sz) => {
    const s = makeShape('path', 0, 0) as PathShape;
    s.nodes = nodes.map(({ p, i, o }): PathNode => ({ x: cx + p[0] * sz, y: cy + p[1] * sz, hIn: i ? [cx + i[0] * sz, cy + i[1] * sz] : null, hOut: o ? [cx + o[0] * sz, cy + o[1] * sz] : null }));
    s.closed = closed;
    return s;
  };
}
const prim = (build: Preset['build']): Preset['build'] => build;

const ARROW: Pt[] = [[-0.5, -0.16], [0.12, -0.16], [0.12, -0.38], [0.5, 0], [0.12, 0.38], [0.12, 0.16], [-0.5, 0.16]];
const PLUS_T = 0.17;
const PLUS: Pt[] = [[-PLUS_T, -0.5], [PLUS_T, -0.5], [PLUS_T, -PLUS_T], [0.5, -PLUS_T], [0.5, PLUS_T], [PLUS_T, PLUS_T], [PLUS_T, 0.5], [-PLUS_T, 0.5], [-PLUS_T, PLUS_T], [-0.5, PLUS_T], [-0.5, -PLUS_T], [-PLUS_T, -PLUS_T]];

function gear(teeth: number): Preset['build'] {
  return (cx, cy, sz) => {
    const s = makeShape('path', 0, 0) as PathShape; const nodes: PathNode[] = [];
    const ro = sz * 0.5, ri = sz * 0.38; const n = teeth * 2;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const r = i % 2 === 0 ? ro : ri; nodes.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, hIn: null, hOut: null }); }
    s.nodes = nodes; s.closed = true; return s;
  };
}

export const CATEGORIES = ['Basic', 'Polygons', 'Stars', 'Arrows', 'Symbols'] as const;

export const PRESETS: (Preset & { cat: string })[] = [
  // Basic
  { cat: 'Basic', id: 'rect', name: 'Rectangle', kw: 'box rect square', build: prim((cx, cy, sz) => { const s = makeShape('rect', cx - sz * 0.65, cy - sz * 0.45, ) as Extract<Shape, { type: 'rect' }>; s.width = sz * 1.3; s.height = sz * 0.9; return s; }) },
  { cat: 'Basic', id: 'rrect', name: 'Rounded rect', kw: 'rounded box card', build: prim((cx, cy, sz) => { const s = makeShape('rect', cx - sz * 0.65, cy - sz * 0.45) as Extract<Shape, { type: 'rect' }>; s.width = sz * 1.3; s.height = sz * 0.9; s.corners = [sz * 0.18, sz * 0.18, sz * 0.18, sz * 0.18]; return s; }) },
  { cat: 'Basic', id: 'square', name: 'Square', kw: 'box square', build: prim((cx, cy, sz) => { const s = makeShape('rect', cx - sz / 2, cy - sz / 2) as Extract<Shape, { type: 'rect' }>; s.width = sz; s.height = sz; return s; }) },
  { cat: 'Basic', id: 'circle', name: 'Circle', kw: 'round dot ellipse', build: prim((cx, cy, sz) => { const s = makeShape('ellipse', cx - sz / 2, cy - sz / 2) as Extract<Shape, { type: 'ellipse' }>; s.width = sz; s.height = sz; return s; }) },
  { cat: 'Basic', id: 'ellipse', name: 'Ellipse', kw: 'oval round', build: prim((cx, cy, sz) => { const s = makeShape('ellipse', cx - sz * 0.65, cy - sz * 0.42) as Extract<Shape, { type: 'ellipse' }>; s.width = sz * 1.3; s.height = sz * 0.84; return s; }) },
  { cat: 'Basic', id: 'triangle', name: 'Triangle', kw: 'triangle tri', build: poly([[0, -0.5], [0.5, 0.5], [-0.5, 0.5]]) },
  { cat: 'Basic', id: 'tri-down', name: 'Triangle down', kw: 'triangle down caret', build: poly([[-0.5, -0.5], [0.5, -0.5], [0, 0.5]]) },
  { cat: 'Basic', id: 'right-tri', name: 'Right triangle', kw: 'triangle right', build: poly([[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) },
  { cat: 'Basic', id: 'diamond', name: 'Diamond', kw: 'rhombus diamond', build: poly([[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]) },
  { cat: 'Basic', id: 'parallelogram', name: 'Parallelogram', kw: 'slant skew', build: poly([[-0.3, -0.45], [0.5, -0.45], [0.3, 0.45], [-0.5, 0.45]]) },
  { cat: 'Basic', id: 'trapezoid', name: 'Trapezoid', kw: 'trapezium', build: poly([[-0.3, -0.45], [0.3, -0.45], [0.5, 0.45], [-0.5, 0.45]]) },
  // Polygons
  ...[['Pentagon', 5], ['Hexagon', 6], ['Heptagon', 7], ['Octagon', 8], ['Nonagon', 9], ['Decagon', 10]].map(([name, n]) => ({
    cat: 'Polygons', id: 'ngon' + n, name: name as string, kw: `polygon ${n} sides ${name}`,
    build: prim((cx, cy, sz) => { const s = makeShape('polygon', cx - sz / 2, cy - sz / 2) as Extract<Shape, { type: 'polygon' }>; s.width = sz; s.height = sz; s.sides = n as number; return s; }),
  })),
  // Stars
  ...[['Star (4)', 4, 0.42], ['Star (5)', 5, 0.45], ['Star (6)', 6, 0.5], ['Star (8)', 8, 0.55], ['Burst (12)', 12, 0.7]].map(([name, n, ir]) => ({
    cat: 'Stars', id: 'star' + n, name: name as string, kw: `star burst ${n} point`,
    build: prim((cx, cy, sz) => { const s = makeShape('polygon', cx - sz / 2, cy - sz / 2) as Extract<Shape, { type: 'polygon' }>; s.width = sz; s.height = sz; s.sides = n as number; s.innerRatio = ir as number; return s; }),
  })),
  // Arrows
  { cat: 'Arrows', id: 'arrow-r', name: 'Arrow right', kw: 'arrow right next', build: poly(ARROW) },
  { cat: 'Arrows', id: 'arrow-l', name: 'Arrow left', kw: 'arrow left back', build: poly(rotate(ARROW, 180)) },
  { cat: 'Arrows', id: 'arrow-u', name: 'Arrow up', kw: 'arrow up top', build: poly(rotate(ARROW, -90)) },
  { cat: 'Arrows', id: 'arrow-d', name: 'Arrow down', kw: 'arrow down bottom', build: poly(rotate(ARROW, 90)) },
  { cat: 'Arrows', id: 'chevron', name: 'Chevron', kw: 'chevron caret next', build: poly([[-0.5, -0.5], [0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0.5], [0, 0]]) },
  { cat: 'Arrows', id: 'caret', name: 'Caret', kw: 'caret arrow expand', build: poly([[-0.45, -0.25], [0, 0.3], [0.45, -0.25]], false) },
  // Symbols
  { cat: 'Symbols', id: 'plus', name: 'Plus', kw: 'plus add cross', build: poly(PLUS) },
  { cat: 'Symbols', id: 'cross', name: 'Cross (X)', kw: 'x close cross delete', build: poly(rotate(PLUS, 45)) },
  { cat: 'Symbols', id: 'check', name: 'Checkmark', kw: 'check tick done ok', build: poly([[-0.42, 0.02], [-0.12, 0.34], [0.46, -0.36]], false) },
  { cat: 'Symbols', id: 'heart', name: 'Heart', kw: 'heart love like', build: bez([{ p: [0, 0.4], i: [0.5, -0.18], o: [-0.5, -0.18] }, { p: [0, -0.15], i: [-0.28, -0.5], o: [0.28, -0.5] }]) },
  { cat: 'Symbols', id: 'lightning', name: 'Lightning', kw: 'bolt flash power energy', build: poly([[0.12, -0.5], [-0.32, 0.06], [-0.02, 0.06], [-0.12, 0.5], [0.32, -0.06], [0.02, -0.06]]) },
  { cat: 'Symbols', id: 'shield', name: 'Shield', kw: 'shield secure guard', build: bez([{ p: [0, -0.5] }, { p: [0.45, -0.32] }, { p: [0.45, 0.1], o: [0.45, 0.32] }, { p: [0, 0.5], i: [0.35, 0.34] }, { p: [-0.45, 0.1], i: [-0.45, 0.32] }, { p: [-0.45, -0.32] }]) },
  { cat: 'Symbols', id: 'speech', name: 'Speech bubble', kw: 'chat message comment bubble', build: poly([[-0.5, -0.45], [0.5, -0.45], [0.5, 0.2], [-0.05, 0.2], [-0.22, 0.5], [-0.22, 0.2], [-0.5, 0.2]]) },
  { cat: 'Symbols', id: 'bookmark', name: 'Bookmark', kw: 'bookmark save tag flag', build: poly([[-0.35, -0.5], [0.35, -0.5], [0.35, 0.5], [0, 0.22], [-0.35, 0.5]]) },
  { cat: 'Symbols', id: 'blob', name: 'Blob', kw: 'blob organic splat', build: bez([{ p: [0, -0.45], i: [-0.3, -0.5], o: [0.35, -0.48] }, { p: [0.45, 0], i: [0.5, -0.3], o: [0.42, 0.32] }, { p: [0, 0.45], i: [0.35, 0.5], o: [-0.35, 0.5] }, { p: [-0.45, 0], i: [-0.45, 0.3], o: [-0.5, -0.32] }]) },
  { cat: 'Symbols', id: 'gear', name: 'Gear', kw: 'gear cog settings', build: gear(8) },
  { cat: 'Symbols', id: 'moon', name: 'Crescent', kw: 'moon night crescent', build: bez([{ p: [0.1, -0.48], i: [0.55, -0.2], o: [-0.45, -0.5] }, { p: [0.1, 0.48], i: [-0.45, 0.5], o: [0.55, 0.2] }]) },
];
