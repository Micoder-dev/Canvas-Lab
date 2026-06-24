import { Fragment, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Circle, Shape as RKShape, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useStore } from '../store/useStore';
import { makeShape, bbox, polygonPoints, translatePatch, mirror } from '../model/shapes';
import type { Shape, PathNode } from '../model/shapes';
import { fillProps, strokeProps, strokeColor } from './konvaPaint';
import ContextMenu from './ContextMenu';
import type { Menu } from './ContextMenu';
import { Dropdown } from './ui';
import { PlatformIcon } from './platformIcons';
import { haptics } from '../lib/haptics';
import { animXform } from '../lib/animPreview';
import type { AnimXform } from '../lib/animPreview';
import { gridStep, snapValue } from '../lib/grid';

const ACCENT = '#5E6AD2';
const UNITS = [
  { value: 'dp', label: 'dp · Android', icon: <PlatformIcon k="android" /> },
  { value: 'sp', label: 'sp · Android text', icon: <PlatformIcon k="android" /> },
  { value: 'px', label: 'px · Web / CSS', icon: <PlatformIcon k="svg" /> },
  { value: 'pt', label: 'pt · iOS', icon: <PlatformIcon k="apple" /> },
];

function tracePath(ctx: Konva.Context, nodes: PathNode[], closed: boolean) {
  if (nodes.length < 2) return;
  ctx.moveTo(nodes[0].x, nodes[0].y);
  const seg = (a: PathNode, b: PathNode) => {
    const c1 = a.hOut, c2 = b.hIn;
    if (!c1 && !c2) ctx.lineTo(b.x, b.y);
    else if (c1 && c2) ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b.x, b.y);
    else { const h = (c1 || c2)!; ctx.quadraticCurveTo(h[0], h[1], b.x, b.y); }
  };
  for (let k = 0; k < nodes.length - 1; k++) seg(nodes[k], nodes[k + 1]);
  if (closed) { seg(nodes[nodes.length - 1], nodes[0]); ctx.closePath(); }
}

export default function Editor() {
  const { shapes, selectedId, tool, artboard, grid, snap, zoom, pan, theme, unit } = useStore();
  const setUnit = useStore((s) => s.setUnit);
  const addShape = useStore((s) => s.addShape);
  const updateShape = useStore((s) => s.updateShape);
  const selectShape = useStore((s) => s.selectShape);
  const setTool = useStore((s) => s.setTool);
  const beginEdit = useStore((s) => s.beginEdit);
  const zoomBy = useStore((s) => s.zoomBy);
  const setPan = useStore((s) => s.setPan);
  const resetView = useStore((s) => s.resetView);
  const penNodes = useStore((s) => s.penNodes);
  const penAdd = useStore((s) => s.penAdd);
  const penDragLast = useStore((s) => s.penDragLast);
  const penFinish = useStore((s) => s.penFinish);
  const penCancel = useStore((s) => s.penCancel);
  const playing = useStore((s) => s.playing);
  const togglePlay = useStore((s) => s.togglePlay);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const drawingId = useRef<string | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const penDrag = useRef<boolean>(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [closeHover, setCloseHover] = useState(false);
  const space = useRef(false);
  const panning = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [panCursor, setPanCursor] = useState(false);
  const [clock, setClock] = useState(0);
  const [dims, setDims] = useState<{ sx: number; sy: number; label: string; snapped: boolean } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0; const t0 = performance.now();
    const loop = (t: number) => { setClock(t - t0); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __penLen?: () => number }).__penLen = () => useStore.getState().penNodes.length; });

  const setViewport = useStore((s) => s.setViewport);
  const didCenter = useRef(false);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const measure = () => { const w = el.clientWidth, h = el.clientHeight; setSize({ w, h }); setViewport(w, h); };
    const ro = new ResizeObserver(measure);
    ro.observe(el); measure();
    return () => ro.disconnect();
  }, []); // eslint-disable-line

  // center the artboard once, after the container has a real measured size
  useEffect(() => {
    if (didCenter.current || size.w < 2) return;
    didCenter.current = true;
    resetView();
  }, [size.w, size.h]); // eslint-disable-line

  useEffect(() => {
    const tr = trRef.current, stage = stageRef.current; if (!tr || !stage) return;
    const sel = shapes.find((s) => s.id === selectedId);
    const ok = sel && (sel.type === 'rect' || sel.type === 'ellipse') && tool === 'select';
    const node = ok ? stage.findOne('.' + selectedId) : null;
    tr.nodes(node ? [node] : []); tr.getLayer()?.batchDraw();
  }, [selectedId, shapes, tool]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') { space.current = true; setPanCursor(true); }
      if (tool === 'path' && e.key === 'Enter') finishPen(false);
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { space.current = false; setPanCursor(false); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  useEffect(() => { if (tool !== 'path') { penCancel(); penDrag.current = false; setCursor(null); } }, [tool]); // eslint-disable-line

  // the snapping step is the grid's current minor step when Snap is on, else whole units
  const step = () => (snap ? gridStep(zoom).minor : null);
  const sn = (v: number) => snapValue(v, step());
  // for dims: returns [snapped, didSnapToGrid]
  const magnet = (v: number): [number, boolean] => { const s = step(); return s ? [Math.round(v / s) * s, true] : [Math.round(v), false]; };
  const world = () => { const p = stageRef.current?.getRelativePointerPosition() ?? { x: 0, y: 0 }; return { x: sn(p.x), y: sn(p.y) }; };
  const screen = () => stageRef.current?.getPointerPosition() ?? { x: 0, y: 0 };

  function finishPen(closed: boolean) {
    if (useStore.getState().penNodes.length >= 2) haptics.success();
    penFinish(closed); penDrag.current = false; setCursor(null); setTool('select');
  }

  // Desmos-style: scroll zooms toward the cursor; shift+scroll pans.
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (e.evt.shiftKey) { setPan({ x: pan.x - (e.evt.deltaX || e.evt.deltaY), y: pan.y }); return; }
    const f = Math.pow(1.0015, -e.evt.deltaY);
    zoomBy(f, screen());
  };

  const startPan = () => { const p = screen(); panning.current = { x: p.x, y: p.y, px: pan.x, py: pan.y }; setPanCursor(true); };

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (space.current || e.evt.button === 1) { startPan(); return; }
    // dragging the empty background pans the canvas (click still deselects)
    if (tool === 'select') { if (e.target === e.target.getStage()) { selectShape(null); startPan(); } return; }
    const { x, y } = world();
    if (tool === 'path') {
      if (useStore.getState().penNodes.length >= 2 && closeHover) { finishPen(true); return; }
      penAdd({ x, y, hIn: null, hOut: null }); penDrag.current = true; haptics.tap(); return;
    }
    if (tool === 'line') { const s = makeShape('line', x, y) as Extract<Shape, { type: 'line' }>; s.points = [x, y, x, y]; drawingId.current = s.id; addShape(s); return; }
    const s = makeShape(tool, x, y); drawingId.current = s.id; startPt.current = { x, y }; addShape(s);
  };

  const onMouseMove = () => {
    if (panning.current) { const p = screen(); const pc = panning.current; setPan({ x: pc.px + (p.x - pc.x), y: pc.py + (p.y - pc.y) }); return; }
    const { x, y } = world();
    if (tool === 'path') {
      const d = useStore.getState().penNodes;
      if (penDrag.current && d.length) {
        const n = d[d.length - 1]; penDragLast([x, y], mirror([n.x, n.y], [x, y])); return;
      }
      setCursor({ x, y });
      if (d.length >= 2) setCloseHover(Math.hypot(x - d[0].x, y - d[0].y) * zoom < 12);
      else setCloseHover(false);
      return;
    }
    const id = drawingId.current; if (!id) return;
    const cur = useStore.getState().shapes.find((sh) => sh.id === id); if (!cur) return;
    const sp = screen();
    if (cur.type === 'line') {
      const [ex, exs] = magnet(x); const [ey, eys] = magnet(y);
      updateShape(id, { points: [cur.points[0], cur.points[1], ex, ey] } as Partial<Shape>, true);
      setDims({ sx: sp.x, sy: sp.y, label: `${Math.round(Math.hypot(ex - cur.points[0], ey - cur.points[1]))} ${unit}`, snapped: exs || eys });
    } else if (startPt.current) {
      const st = startPt.current;
      const [w, ws] = magnet(Math.abs(x - st.x)); const [h, hs] = magnet(Math.abs(y - st.y));
      const nx = x < st.x ? st.x - w : st.x; const ny = y < st.y ? st.y - h : st.y;
      updateShape(id, { x: nx, y: ny, width: Math.max(1, w), height: Math.max(1, h) } as Partial<Shape>, true);
      setDims({ sx: sp.x, sy: sp.y, label: `${Math.round(w)} × ${Math.round(h)} ${unit}`, snapped: ws || hs });
    }
  };

  const onMouseUp = () => {
    if (panning.current) { panning.current = null; setPanCursor(space.current); return; }
    if (tool === 'path') { penDrag.current = false; return; }
    if (drawingId.current) { drawingId.current = null; startPt.current = null; setDims(null); setTool('select'); }
  };

  const onDblClick = () => { if (tool === 'path') finishPen(false); };

  // snap final canvas commits (drag/resize end) to round / grid values
  const snapPatch = (p: Partial<Shape>): Partial<Shape> => {
    const q = { ...p } as Record<string, unknown>;
    for (const k of ['x', 'y']) if (typeof q[k] === 'number') q[k] = sn(q[k] as number);
    for (const k of ['width', 'height']) if (typeof q[k] === 'number') q[k] = Math.max(1, sn(q[k] as number));
    if (Array.isArray(q.points)) q.points = (q.points as number[]).map(sn);
    return q as Partial<Shape>;
  };
  // live dimension badge while transforming
  const onTransform = () => {
    const s = shapes.find((x) => x.id === selectedId); if (!s || !('width' in s)) return;
    const node = stageRef.current?.findOne('.' + selectedId) as Konva.Rect | Konva.Ellipse | undefined; if (!node) return;
    const w = s.type === 'ellipse' ? (node as Konva.Ellipse).radiusX() * 2 * node.scaleX() : node.width() * node.scaleX();
    const h = s.type === 'ellipse' ? (node as Konva.Ellipse).radiusY() * 2 * node.scaleY() : node.height() * node.scaleY();
    const sp = screen();
    setDims({ sx: sp.x, sy: sp.y, label: `${Math.round(sn(w))} × ${Math.round(sn(h))} ${unit}`, snapped: !!step() });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const stage = stageRef.current; if (!stage) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const hit = stage.getIntersection({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const nm = hit?.name?.();
    const id = nm && shapes.some((s) => s.id === nm) ? nm : null;
    if (id) selectShape(id);
    setMenu({ x: e.clientX, y: e.clientY, id });
  };

  const cls = `canvas-stage cur-${panning.current ? 'grabbing' : panCursor ? 'grab' : tool === 'select' ? 'default' : 'cross'}`;

  return (
    <div ref={wrapRef} className={cls} onContextMenu={onContextMenu}>
      <Stage ref={stageRef} width={size.w} height={size.h} scaleX={zoom} scaleY={zoom} x={pan.x} y={pan.y}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onDblClick={onDblClick}>
        <Layer listening={false}>
          {grid && <InfiniteGrid pan={pan} zoom={zoom} size={size} dark={theme === 'dark'} unit={unit} />}
          <Rect x={-2} y={-2} width={artboard.width + 4} height={artboard.height + 4} cornerRadius={3} fill="rgba(0,0,0,.22)" shadowColor="black" shadowBlur={30 / zoom} shadowOpacity={0.4} />
          <Rect x={0} y={0} width={artboard.width} height={artboard.height} fill={artboard.background || undefined} stroke="rgba(128,128,128,.45)" strokeWidth={1 / zoom} />
          {!artboard.background && <CheckerBg w={artboard.width} h={artboard.height} />}
        </Layer>
        <Layer>
          {shapes.map((s) => (
            <ShapeNode key={s.id} shape={s} draggable={tool === 'select' && !space.current && !playing}
              xf={playing ? animXform(s.anim, clock) : null}
              onSelect={() => tool === 'select' && !space.current && (selectShape(s.id), haptics.select())}
              beginEdit={beginEdit} onChange={(patch, c) => updateShape(s.id, c ? patch : snapPatch(patch), c)} />
          ))}

          <SelectionOverlay shapes={shapes} selectedId={selectedId} tool={tool} zoom={zoom} />
          <LineHandles shapes={shapes} selectedId={selectedId} tool={tool} zoom={zoom} beginEdit={beginEdit} onChange={updateShape} />
          <PathHandles shapes={shapes} selectedId={selectedId} tool={tool} zoom={zoom} beginEdit={beginEdit} onChange={updateShape} />

          {tool === 'path' && penNodes.length >= 1 && <PenPreview nodes={penNodes} cursor={cursor} closeHover={closeHover} zoom={zoom} />}

          <Transformer ref={trRef} rotateAnchorOffset={26 / zoom} anchorSize={9} anchorCornerRadius={5}
            borderStroke={ACCENT} anchorStroke={ACCENT} anchorFill="#fff" borderStrokeWidth={1.5}
            onTransform={onTransform} onTransformEnd={() => setDims(null)}
            boundBoxFunc={(o, n) => (n.width < 4 || n.height < 4 ? o : n)} />
        </Layer>
      </Stage>

      {shapes.some((s) => s.anim?.preset && s.anim.preset !== 'none') && (
        <button className={`playbtn${playing ? ' on' : ''}`} title={playing ? 'Pause preview' : 'Play animation preview'} onClick={togglePlay}>
          {playing ? '⏸' : '▶'} {playing ? 'Pause' : 'Preview'}
        </button>
      )}
      <div className="zoombar">
        <button className="iconbtn" title="Zoom out (−)" onClick={() => zoomBy(1 / 1.2)}>−</button>
        <button className="zoombar__pct" title="Reset view (0)" onClick={resetView}>{Math.round(zoom * 100)}%</button>
        <button className="iconbtn" title="Zoom in (+)" onClick={() => zoomBy(1.2)}>+</button>
      </div>

      {dims && (
        <div className={`dimbadge${dims.snapped ? ' snapped' : ''}`} style={{ left: dims.sx + 14, top: dims.sy + 16 }}>{dims.label}</div>
      )}
      {tool === 'path' && (
        <div className="penhint">
          <b>Pen</b> · click = corner · click-drag = curve · <kbd>⌫</kbd>/<kbd>⌘Z</kbd> remove last point · click first point or <kbd>Enter</kbd> to finish · <kbd>Esc</kbd> cancel
        </div>
      )}
      {!shapes.length && tool === 'select' && (
        <div className="canvas-empty">Pick a tool on the left and drag on the artboard to start.<br /><span>Drag the background to pan · scroll to zoom · right-click for options</span></div>
      )}
      <div className="artboard-tag" style={{ left: Math.max(4, pan.x), top: Math.max(4, pan.y - 19) }}>{artboard.width} × {artboard.height} {unit}</div>
      <div className="canvas-units"><Dropdown value={unit} options={UNITS} onChange={(u) => setUnit(u as never)} /></div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function CheckerBg({ w, h }: { w: number; h: number }) {
  return <RKShape listening={false} sceneFunc={(ctx, shape) => {
    const s = 10; ctx.beginPath();
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (((x / s) + (y / s)) % 2 === 0) ctx.rect(x, y, s, s);
    ctx.fillStyle = 'rgba(140,140,140,.18)'; ctx.fill(); ctx.fillStrokeShape(shape);
  }} />;
}
function InfiniteGrid({ pan, zoom, size, dark, unit }: { pan: { x: number; y: number }; zoom: number; size: { w: number; h: number }; dark: boolean; unit: string }) {
  const minorC = dark ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.045)';
  const majorC = dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.09)';
  const axisC = dark ? 'rgba(126,138,255,.7)' : 'rgba(94,106,210,.65)';
  const labelC = dark ? 'rgba(220,224,235,.5)' : 'rgba(20,22,28,.5)';
  return <RKShape listening={false} sceneFunc={(ctx) => {
    const { minor, major } = gridStep(zoom);
    const L = -pan.x / zoom, T = -pan.y / zoom, R = (size.w - pan.x) / zoom, B = (size.h - pan.y) / zoom;
    const line = (x0: number, y0: number, x1: number, y1: number) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
    ctx.beginPath();
    for (let x = Math.ceil(L / minor) * minor; x <= R; x += minor) line(x, T, x, B);
    for (let y = Math.ceil(T / minor) * minor; y <= B; y += minor) line(L, y, R, y);
    ctx.strokeStyle = minorC; ctx.lineWidth = 1 / zoom; ctx.stroke();
    ctx.beginPath();
    for (let x = Math.ceil(L / major) * major; x <= R; x += major) line(x, T, x, B);
    for (let y = Math.ceil(T / major) * major; y <= B; y += major) line(L, y, R, y);
    ctx.strokeStyle = majorC; ctx.lineWidth = 1 / zoom; ctx.stroke();
    // axes through origin (0,0 = top-left of the composable, dp space)
    ctx.beginPath();
    if (0 >= L && 0 <= R) line(0, T, 0, B);
    if (0 >= T && 0 <= B) line(L, 0, R, 0);
    ctx.strokeStyle = axisC; ctx.lineWidth = 1.5 / zoom; ctx.stroke();
    // dp labels on major lines (only when reasonably spaced)
    if (major * zoom > 34) {
      const fs = 10.5 / zoom;
      ctx.fillStyle = labelC; ctx.font = `${fs}px ui-monospace, monospace`; ctx.textBaseline = 'top';
      const ly = Math.min(Math.max(0, T + 3 / zoom), B - fs - 3 / zoom);
      for (let x = Math.ceil(L / major) * major; x <= R; x += major) ctx.fillText(Math.abs(x) < 1e-6 ? '0' : String(Math.round(x)), x + 3 / zoom, ly);
      const lx = Math.min(Math.max(0, L + 3 / zoom), R - 22 / zoom);
      for (let y = Math.ceil(T / major) * major; y <= B; y += major) if (Math.abs(y) > 1e-6) ctx.fillText(String(Math.round(y)), lx + 3 / zoom, y + 2 / zoom);
      ctx.fillText(unit, lx + 3 / zoom, ly); // unit marker near origin
    }
  }} />;
}

function SelectionOverlay({ shapes, selectedId, tool, zoom }: { shapes: Shape[]; selectedId: string | null; tool: string; zoom: number }) {
  const s = shapes.find((x) => x.id === selectedId);
  if (!s || tool !== 'select' || s.type === 'rect' || s.type === 'ellipse') return null;
  const b = bbox(s);
  return <Rect x={b.x} y={b.y} width={b.w} height={b.h} stroke={ACCENT} strokeWidth={1.5 / zoom} dash={[5 / zoom, 4 / zoom]} listening={false} />;
}

function LineHandles({ shapes, selectedId, tool, zoom, beginEdit, onChange }: {
  shapes: Shape[]; selectedId: string | null; tool: string; zoom: number; beginEdit: () => void; onChange: (id: string, patch: Partial<Shape>, c?: boolean) => void;
}) {
  const s = shapes.find((x) => x.id === selectedId);
  if (!s || tool !== 'select' || s.type !== 'line' || s.rotation) return null;
  const pts = s.points;
  return <>{pts.map((_, i) => i % 2 === 0 && (
    <Circle key={i} x={pts[i]} y={pts[i + 1]} radius={5 / zoom} fill="#fff" stroke={ACCENT} strokeWidth={1.5 / zoom} draggable onDragStart={beginEdit}
      onDragMove={(e) => { const np = pts.slice(); np[i] = e.target.x(); np[i + 1] = e.target.y(); onChange(s.id, { points: np } as Partial<Shape>, true); }} />
  ))}</>;
}

function PathHandles({ shapes, selectedId, tool, zoom, beginEdit, onChange }: {
  shapes: Shape[]; selectedId: string | null; tool: string; zoom: number; beginEdit: () => void; onChange: (id: string, patch: Partial<Shape>, c?: boolean) => void;
}) {
  const s = shapes.find((x) => x.id === selectedId);
  if (!s || tool !== 'select' || s.type !== 'path' || s.rotation) return null;
  const nodes = s.nodes;
  const set = (next: PathNode[]) => onChange(s.id, { nodes: next } as Partial<Shape>, true);
  const r = 5 / zoom, hr = 4 / zoom, sw = 1.5 / zoom;

  const moveAnchor = (i: number, nx: number, ny: number) => {
    const dx = nx - nodes[i].x, dy = ny - nodes[i].y; const next = nodes.slice();
    const n = nodes[i]; next[i] = { x: nx, y: ny, hIn: n.hIn ? [n.hIn[0] + dx, n.hIn[1] + dy] : null, hOut: n.hOut ? [n.hOut[0] + dx, n.hOut[1] + dy] : null }; set(next);
  };
  const moveHandle = (i: number, which: 'hIn' | 'hOut', hx: number, hy: number, alt: boolean) => {
    const next = nodes.slice(); const n = { ...nodes[i] }; n[which] = [hx, hy];
    const opp = which === 'hIn' ? 'hOut' : 'hIn';
    if (!alt && n[opp]) n[opp] = mirror([n.x, n.y], [hx, hy]);
    next[i] = n; set(next);
  };
  const toggleSmooth = (i: number) => {
    const next = nodes.slice(); const n = nodes[i];
    if (n.hIn || n.hOut) { next[i] = { ...n, hIn: null, hOut: null }; }
    else {
      const prev = nodes[(i - 1 + nodes.length) % nodes.length]; const nxt = nodes[(i + 1) % nodes.length];
      let dx = nxt.x - prev.x, dy = nxt.y - prev.y; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const h = Math.min(60, len / 3);
      next[i] = { ...n, hOut: [n.x + dx * h, n.y + dy * h], hIn: [n.x - dx * h, n.y - dy * h] };
    }
    set(next);
  };

  return <>
    {nodes.map((n, i) => <Fragment key={'l' + i}>
      {n.hIn && <Line points={[n.x, n.y, n.hIn[0], n.hIn[1]]} stroke={ACCENT} strokeWidth={sw} listening={false} opacity={0.6} />}
      {n.hOut && <Line points={[n.x, n.y, n.hOut[0], n.hOut[1]]} stroke={ACCENT} strokeWidth={sw} listening={false} opacity={0.6} />}
    </Fragment>)}
    {nodes.map((n, i) => <Fragment key={'h' + i}>
      {n.hIn && <Circle x={n.hIn[0]} y={n.hIn[1]} radius={hr} fill={ACCENT} stroke="#fff" strokeWidth={sw} draggable onDragStart={beginEdit}
        onDragMove={(e) => moveHandle(i, 'hIn', e.target.x(), e.target.y(), e.evt.altKey)} />}
      {n.hOut && <Circle x={n.hOut[0]} y={n.hOut[1]} radius={hr} fill={ACCENT} stroke="#fff" strokeWidth={sw} draggable onDragStart={beginEdit}
        onDragMove={(e) => moveHandle(i, 'hOut', e.target.x(), e.target.y(), e.evt.altKey)} />}
    </Fragment>)}
    {nodes.map((n, i) => (
      <Rect key={'a' + i} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} cornerRadius={1 / zoom} fill="#fff" stroke={ACCENT} strokeWidth={sw}
        draggable onDragStart={beginEdit} onDragMove={(e) => moveAnchor(i, e.target.x() + r, e.target.y() + r)}
        onDblClick={(e) => { e.cancelBubble = true; beginEdit(); toggleSmooth(i); }} />
    ))}
  </>;
}

function PenPreview({ nodes, cursor, closeHover, zoom }: { nodes: PathNode[]; cursor: { x: number; y: number } | null; closeHover: boolean; zoom: number }) {
  const all = cursor ? [...nodes, { x: cursor.x, y: cursor.y, hIn: null, hOut: null }] : nodes;
  return <>
    <RKShape listening={false} stroke={ACCENT} strokeWidth={1.5 / zoom} dash={[6 / zoom, 4 / zoom]}
      sceneFunc={(ctx, shape) => { ctx.beginPath(); tracePath(ctx, all, false); ctx.strokeShape(shape); }} />
    {nodes.map((n, i) => <Fragment key={'p' + i}>
      {n.hOut && <Circle x={n.hOut[0]} y={n.hOut[1]} radius={3 / zoom} fill={ACCENT} listening={false} />}
      {n.hIn && <Circle x={n.hIn[0]} y={n.hIn[1]} radius={3 / zoom} fill={ACCENT} listening={false} />}
    </Fragment>)}
    {nodes.map((n, i) => (
      <Circle key={'pa' + i} x={n.x} y={n.y} radius={(i === 0 && closeHover ? 6 : 4) / zoom} fill={i === 0 && closeHover ? ACCENT : '#fff'} stroke={ACCENT} strokeWidth={1.5 / zoom} listening={false} />
    ))}
  </>;
}

function ShapeNode({ shape: s, draggable, xf, onSelect, beginEdit, onChange }: {
  shape: Shape; draggable: boolean; xf: AnimXform | null; onSelect: () => void; beginEdit: () => void; onChange: (patch: Partial<Shape>, c?: boolean) => void;
}) {
  if (!s.visible) return null;
  const op = xf?.alpha ?? s.opacity;
  const rot = (s.rotation || 0) + (xf?.rot || 0);
  const sc = xf?.scale ?? 1;
  const dy = xf?.dy || 0;
  const common = { name: s.id, draggable, opacity: op, onMouseDown: onSelect, onTap: onSelect, onDragStart: beginEdit };
  const b = bbox(s);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const moveEnd = (e: Konva.KonvaEventObject<DragEvent>) => { const dx = e.target.x(), dyy = e.target.y(); e.target.position({ x: 0, y: 0 }); onChange(translatePatch(s, dx, dyy)); };
  const txPts = (pts: number[]) => (sc === 1 && !dy ? pts : pts.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * sc : cy + (v - cy) * sc + dy)));
  const applyXf = (ctx: Konva.Context) => {
    if (dy) ctx.translate(0, dy);
    if (rot || sc !== 1) { ctx.translate(cx, cy); if (rot) ctx.rotate((rot * Math.PI) / 180); if (sc !== 1) ctx.scale(sc, sc); ctx.translate(-cx, -cy); }
  };

  if (s.type === 'rect') {
    return <Rect {...common} x={s.x + s.width / 2} y={s.y + s.height / 2 + dy} offsetX={s.width / 2} offsetY={s.height / 2}
      width={s.width} height={s.height} rotation={rot} scaleX={sc} scaleY={sc} cornerRadius={s.corners as number[]}
      {...fillProps(s.fill, { x: 0, y: 0, w: s.width, h: s.height })} {...strokeProps(s)} onTransformStart={beginEdit}
      onDragEnd={(e) => onChange({ x: e.target.x() - s.width / 2, y: e.target.y() - s.height / 2 } as Partial<Shape>)}
      onTransformEnd={(e) => { const n = e.target as Konva.Rect; const x = n.scaleX(), y = n.scaleY(); n.scaleX(1); n.scaleY(1); const w = Math.max(1, n.width() * x), h = Math.max(1, n.height() * y); onChange({ x: n.x() - w / 2, y: n.y() - h / 2, width: w, height: h, rotation: n.rotation() } as Partial<Shape>); }} />;
  }
  if (s.type === 'ellipse') {
    return <Ellipse {...common} x={s.x + s.width / 2} y={s.y + s.height / 2 + dy} radiusX={s.width / 2} radiusY={s.height / 2} rotation={rot} scaleX={sc} scaleY={sc}
      {...fillProps(s.fill, { x: -s.width / 2, y: -s.height / 2, w: s.width, h: s.height })} {...strokeProps(s)} onTransformStart={beginEdit}
      onDragEnd={(e) => onChange({ x: e.target.x() - s.width / 2, y: e.target.y() - s.height / 2 } as Partial<Shape>)}
      onTransformEnd={(e) => { const n = e.target as Konva.Ellipse; const x = n.scaleX(), y = n.scaleY(); n.scaleX(1); n.scaleY(1); const w = Math.max(1, n.radiusX() * 2 * x), h = Math.max(1, n.radiusY() * 2 * y); onChange({ x: n.x() - w / 2, y: n.y() - h / 2, width: w, height: h, rotation: n.rotation() } as Partial<Shape>); }} />;
  }
  if (s.type === 'arc') {
    return <RKShape {...common} {...fillProps(s.fill, b)} {...strokeProps(s)} fillEnabled={s.fill.type !== 'none'}
      sceneFunc={(ctx, shape) => { const rx = s.width / 2, ry = s.height / 2, ax = s.x + rx, ay = s.y + ry; const a0 = (s.startAngle * Math.PI) / 180, a1 = ((s.startAngle + s.sweepAngle) * Math.PI) / 180;
        applyXf(ctx); ctx.beginPath(); if (s.useCenter) ctx.moveTo(ax, ay); ctx.ellipse(ax, ay, rx, ry, 0, a0, a1, s.sweepAngle < 0); if (s.useCenter) ctx.closePath(); ctx.fillStrokeShape(shape); }}
      onDragEnd={moveEnd} />;
  }
  if (s.type === 'polygon') {
    const pts = txPts(polygonPoints(b, s.sides, s.innerRatio, (s.rotation || 0) + (xf?.rot || 0)));
    return <Line {...common} points={pts} closed {...fillProps(s.fill, b)} {...strokeProps(s)} onDragEnd={moveEnd} />;
  }
  if (s.type === 'path') {
    if (s.nodes.length < 2) return null;
    return <RKShape {...common} {...fillProps(s.fill, b)} {...strokeProps(s)} fillEnabled={s.fill.type !== 'none'}
      sceneFunc={(ctx, shape) => { applyXf(ctx); ctx.beginPath(); tracePath(ctx, s.nodes, s.closed); ctx.fillStrokeShape(shape); }}
      hitFunc={(ctx, shape) => { ctx.beginPath(); tracePath(ctx, s.nodes, s.closed); ctx.fillStrokeShape(shape); }}
      onDragEnd={moveEnd} />;
  }
  // line
  return <Line {...common} points={txPts(s.points)} stroke={strokeColor(s.stroke)} strokeWidth={strokeColor(s.stroke) ? s.strokeWidth : 0}
    dash={s.dash.length ? s.dash : undefined} lineCap={s.cap.toLowerCase() as never} lineJoin={s.join.toLowerCase() as never}
    hitStrokeWidth={Math.max(12, s.strokeWidth)} strokeScaleEnabled={false} onDragEnd={moveEnd} />;
}
