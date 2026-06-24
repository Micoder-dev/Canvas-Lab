// The normalized "Shape Model" — single source of truth.
// Editor writes it; generators read it. Decoupled from both Konva and Kotlin.

export type ShapeType = 'rect' | 'ellipse' | 'line' | 'path' | 'polygon' | 'arc';

/* ---------- Paint ---------- */
export type PaintType = 'none' | 'solid' | 'linear' | 'radial' | 'sweep';
export interface GradientStop { color: string; pos: number; }
export interface Paint { type: PaintType; color: string; stops: GradientStop[]; angle: number; }

export const solid = (c: string): Paint => ({ type: 'solid', color: c, stops: defaultStops(), angle: 0 });
export const none = (): Paint => ({ type: 'none', color: '#000000', stops: defaultStops(), angle: 0 });
export const defaultStops = (): GradientStop[] => [{ color: '#4F8CFF', pos: 0 }, { color: '#A855F7', pos: 1 }];

/* ---------- Stroke + compositing ---------- */
export type StrokeCap = 'Butt' | 'Round' | 'Square';
export type StrokeJoin = 'Miter' | 'Round' | 'Bevel';
export const BLEND_MODES = [
  'SrcOver', 'Multiply', 'Screen', 'Overlay', 'Darken', 'Lighten', 'ColorDodge', 'ColorBurn',
  'Hardlight', 'Softlight', 'Difference', 'Exclusion', 'Hue', 'Saturation', 'Color', 'Luminosity', 'Plus', 'Clear', 'Src',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/* ---------- Animation ---------- */
export const ANIM_PRESETS = ['none', 'spin', 'pulse', 'fade', 'dash', 'trace', 'float', 'wiggle'] as const;
export type AnimPreset = (typeof ANIM_PRESETS)[number];
export type AnimRepeat = 'loop' | 'reverse' | 'once';
export type Easing = 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
export interface Anim {
  preset: AnimPreset;
  duration: number;  // ms
  delay: number;     // ms
  repeat: AnimRepeat;
  easing: Easing;
  amount: number;    // magnitude: pulse %, float px, wiggle deg
}
export const defaultAnim = (): Anim => ({ preset: 'none', duration: 1500, delay: 0, repeat: 'loop', easing: 'easeInOut', amount: 1 });

/* ---------- Shapes ---------- */
export interface CommonShape {
  id: string; type: ShapeType; name: string; visible: boolean;
  fill: Paint; stroke: Paint; strokeWidth: number;
  cap: StrokeCap; join: StrokeJoin; dash: number[]; opacity: number; rotation: number; blend: BlendMode;
  anim: Anim;
}
export interface RectShape extends CommonShape { type: 'rect'; x: number; y: number; width: number; height: number; corners: [number, number, number, number]; }
export interface EllipseShape extends CommonShape { type: 'ellipse'; x: number; y: number; width: number; height: number; }
export interface ArcShape extends CommonShape { type: 'arc'; x: number; y: number; width: number; height: number; startAngle: number; sweepAngle: number; useCenter: boolean; }
export interface PolygonShape extends CommonShape { type: 'polygon'; x: number; y: number; width: number; height: number; sides: number; innerRatio: number; }
export interface LineShape extends CommonShape { type: 'line'; points: number[]; }

// Bezier path: each node is an anchor with optional control handles (absolute coords).
// hIn  = control point governing the curve ARRIVING at this node.
// hOut = control point governing the curve LEAVING this node.
export type Handle = [number, number] | null;
export interface PathNode { x: number; y: number; hIn: Handle; hOut: Handle; }
export interface PathShape extends CommonShape { type: 'path'; nodes: PathNode[]; closed: boolean; evenOdd: boolean; }

export type Shape = RectShape | EllipseShape | ArcShape | PolygonShape | LineShape | PathShape;
export type BoxLike = RectShape | EllipseShape | ArcShape | PolygonShape;

export const hasBox = (s: Shape): s is BoxLike => s.type === 'rect' || s.type === 'ellipse' || s.type === 'arc' || s.type === 'polygon';
export const canRotate = (s: Shape) => s.type !== 'line';

/* ---------- bounding box ---------- */
export interface Box { x: number; y: number; w: number; h: number; }
export function bbox(s: Shape): Box {
  if (hasBox(s)) return { x: s.x, y: s.y, w: s.width, h: s.height };
  const pts: number[] = [];
  if (s.type === 'line') pts.push(...s.points);
  else for (const n of s.nodes) { pts.push(n.x, n.y); if (n.hIn) pts.push(...n.hIn); if (n.hOut) pts.push(...n.hOut); }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]); }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
export const center = (s: Shape) => { const b = bbox(s); return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 }; };

/* Regular polygon / star points, fit to bbox, rotation baked. */
export function polygonPoints(b: Box, sides: number, innerRatio: number, rotationDeg: number): number[] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
  const star = innerRatio > 0, n = star ? sides * 2 : sides, base = (-90 + rotationDeg) * (Math.PI / 180);
  const out: number[] = [];
  for (let i = 0; i < n; i++) { const a = base + (i * 2 * Math.PI) / n; const k = star && i % 2 === 1 ? innerRatio : 1; out.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); }
  return out;
}

export function rotatePoints(points: number[], cx: number, cy: number, deg: number): number[] {
  if (!deg) return points.slice();
  const r = deg * (Math.PI / 180), cos = Math.cos(r), sin = Math.sin(r); const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) { const dx = points[i] - cx, dy = points[i + 1] - cy; out.push(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos); }
  return out;
}

const rot1 = (p: [number, number], cx: number, cy: number, cos: number, sin: number): [number, number] => {
  const dx = p[0] - cx, dy = p[1] - cy; return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
};
export function rotateNodes(nodes: PathNode[], cx: number, cy: number, deg: number): PathNode[] {
  if (!deg) return nodes;
  const r = deg * (Math.PI / 180), cos = Math.cos(r), sin = Math.sin(r);
  return nodes.map((n) => {
    const [x, y] = rot1([n.x, n.y], cx, cy, cos, sin);
    return { x, y, hIn: n.hIn ? rot1(n.hIn, cx, cy, cos, sin) : null, hOut: n.hOut ? rot1(n.hOut, cx, cy, cos, sin) : null };
  });
}

/* translate any shape by (dx,dy) — returns the patch to apply */
export function translatePatch(s: Shape, dx: number, dy: number): Partial<Shape> {
  if (hasBox(s)) return { x: s.x + dx, y: s.y + dy } as Partial<Shape>;
  if (s.type === 'line') return { points: s.points.map((v, i) => v + (i % 2 ? dy : dx)) } as Partial<Shape>;
  return { nodes: s.nodes.map((n) => ({ x: n.x + dx, y: n.y + dy, hIn: n.hIn ? [n.hIn[0] + dx, n.hIn[1] + dy] as Handle : null, hOut: n.hOut ? [n.hOut[0] + dx, n.hOut[1] + dy] as Handle : null })) } as Partial<Shape>;
}

/* ---------- factories ---------- */
let counter = 0;
const nextId = () => `s${++counter}`;
const palette = ['#4F8CFF', '#E11D2A', '#2FBF71', '#F5A623', '#7C5CFF', '#FF5C7A'];
const pickFill = () => palette[counter % palette.length];

function commonDefaults(type: ShapeType): CommonShape {
  return { id: nextId(), type, name: `${type}${counter}`, visible: true, fill: solid(pickFill()), stroke: none(), strokeWidth: 2, cap: 'Butt', join: 'Miter', dash: [], opacity: 1, rotation: 0, blend: 'SrcOver', anim: defaultAnim() };
}

export function makeShape(type: ShapeType, x: number, y: number): Shape {
  const c = commonDefaults(type);
  switch (type) {
    case 'rect': return { ...c, type, x, y, width: 1, height: 1, corners: [0, 0, 0, 0] };
    case 'ellipse': return { ...c, type, x, y, width: 1, height: 1 };
    case 'arc': return { ...c, type, x, y, width: 1, height: 1, startAngle: 0, sweepAngle: 270, useCenter: true };
    case 'polygon': return { ...c, type, x, y, width: 1, height: 1, sides: 5, innerRatio: 0 };
    case 'line': return { ...c, type, fill: none(), stroke: solid('#15171A'), strokeWidth: 3, cap: 'Round', points: [x, y, x, y] };
    case 'path': return { ...c, type, fill: solid(pickFill()), nodes: [], closed: false, evenOdd: false };
  }
}

export const mirror = (anchor: [number, number], p: [number, number]): [number, number] => [2 * anchor[0] - p[0], 2 * anchor[1] - p[1]];
