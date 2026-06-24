import { useStore } from '../store/useStore';
import { BLEND_MODES, canRotate, ANIM_PRESETS } from '../model/shapes';
import type { Shape, StrokeCap, StrokeJoin, BlendMode, Anim, AnimPreset, AnimRepeat, Easing } from '../model/shapes';
import { Block, NumberField, SelectField, ColorField, Slider, Switch, Row, IconBtn } from './ui';
import { PaintEditor } from './PaintEditor';
import { useState } from 'react';

const CAPS: StrokeCap[] = ['Butt', 'Round', 'Square'];
const JOINS: StrokeJoin[] = ['Miter', 'Round', 'Bevel'];
const ICONS: Record<string, string> = { rect: '▭', ellipse: '◯', polygon: '⬠', arc: '◴', line: '╱', path: '✎' };

export default function Inspector() {
  const shapes = useStore((s) => s.shapes);
  const selectedId = useStore((s) => s.selectedId);
  const update = useStore((s) => s.updateShape);
  const duplicateShape = useStore((s) => s.duplicateShape);
  const deleteShape = useStore((s) => s.deleteShape);
  const artboard = useStore((s) => s.artboard);
  const setArtboard = useStore((s) => s.setArtboard);
  const grid = useStore((s) => s.grid);
  const snap = useStore((s) => s.snap);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const toggleSnap = useStore((s) => s.toggleSnap);

  const s = shapes.find((x) => x.id === selectedId) || null;
  const up = (patch: Partial<Shape>) => s && update(s.id, patch, true);

  return (
    <div className="pc">
      {!s && (
        <>
          <div className="col__title">Artboard</div>
          <Block title="Canvas" icon="▦">
            <div className="grid2">
              <NumberField label="Width" value={artboard.width} min={1} suffix="dp" onChange={(v) => setArtboard({ width: v })} />
              <NumberField label="Height" value={artboard.height} min={1} suffix="dp" onChange={(v) => setArtboard({ height: v })} />
            </div>
            <ColorField label="Background" value={artboard.background || '#FFFFFF'} onChange={(v) => setArtboard({ background: v })} />
            <Row label="Transparent"><Switch checked={!artboard.background} onChange={(t) => setArtboard({ background: t ? '' : '#FFFFFF' })} /></Row>
            <Row label="Show grid"><Switch checked={grid} onChange={toggleGrid} /></Row>
            <Row label="Snap to grid"><Switch checked={snap} onChange={toggleSnap} /></Row>
          </Block>
          <p className="empty-hint">Select a shape to edit every property,<br />or pick a tool to draw a new one.</p>
        </>
      )}

      {s && (
        <>
          <div className="insp-header">
            <span className="insp-header__icon">{ICONS[s.type]}</span>
            <input className="insp-header__name" value={s.name} onChange={(e) => up({ name: e.target.value })} />
            <IconBtn title="Duplicate (Ctrl+D)" onClick={() => duplicateShape(s.id)}>⧉</IconBtn>
            <IconBtn title="Delete (Del)" danger onClick={() => deleteShape(s.id)}>🗑</IconBtn>
          </div>

          <Block title="Geometry" icon="✛">
            {'x' in s && (
              <div className="grid2">
                <NumberField label="X" value={s.x} onChange={(v) => up({ x: v } as Partial<Shape>)} />
                <NumberField label="Y" value={s.y} onChange={(v) => up({ y: v } as Partial<Shape>)} />
                <NumberField label="W" value={s.width} min={1} onChange={(v) => up({ width: v } as Partial<Shape>)} />
                <NumberField label="H" value={s.height} min={1} onChange={(v) => up({ height: v } as Partial<Shape>)} />
              </div>
            )}
            {s.type === 'rect' && <CornerEditor corners={s.corners} onChange={(c) => up({ corners: c } as Partial<Shape>)} />}
            {s.type === 'polygon' && (
              <>
                <NumberField label="Sides" value={s.sides} min={3} max={24} onChange={(v) => up({ sides: Math.round(v) } as Partial<Shape>)} />
                <Slider label="Star depth" min={0} max={0.95} value={s.innerRatio} format={(v) => (v === 0 ? 'polygon' : `${Math.round(v * 100)}%`)} onChange={(v) => up({ innerRatio: v } as Partial<Shape>)} />
              </>
            )}
            {s.type === 'arc' && (
              <>
                <Slider label="Start" min={0} max={360} step={1} value={s.startAngle} format={(v) => `${Math.round(v)}°`} onChange={(v) => up({ startAngle: v } as Partial<Shape>)} />
                <Slider label="Sweep" min={-360} max={360} step={1} value={s.sweepAngle} format={(v) => `${Math.round(v)}°`} onChange={(v) => up({ sweepAngle: v } as Partial<Shape>)} />
                <Row label="Pie (use center)"><Switch checked={s.useCenter} onChange={(t) => up({ useCenter: t } as Partial<Shape>)} /></Row>
              </>
            )}
            {s.type === 'path' && (
              <>
                <Row label="Closed path"><Switch checked={s.closed} onChange={(t) => up({ closed: t } as Partial<Shape>)} /></Row>
                <Row label="Even-odd fill"><Switch checked={s.evenOdd} onChange={(t) => up({ evenOdd: t } as Partial<Shape>)} /></Row>
                <p className="small muted">{s.nodes.length} nodes · drag squares to move, dots to curve, double-click a square to toggle corner/smooth</p>
              </>
            )}
            {canRotate(s) && <Slider label="Rotation" min={0} max={360} step={1} value={s.rotation} format={(v) => `${Math.round(v)}°`} onChange={(v) => up({ rotation: v })} />}
          </Block>

          <Block title="Fill" icon="●" right={<Dot paint={s.fill} />}>
            <PaintEditor paint={s.fill} onChange={(fill) => up({ fill })} />
          </Block>

          <Block title="Stroke" icon="○" right={<Dot paint={s.stroke} />}>
            <PaintEditor paint={s.stroke} onChange={(stroke) => up({ stroke })} />
            {s.stroke.type !== 'none' && (
              <>
                <NumberField label="Width" value={s.strokeWidth} min={0} step={0.5} onChange={(v) => up({ strokeWidth: v })} />
                <div className="grid2">
                  <SelectField label="Cap" value={s.cap} options={CAPS} onChange={(v) => up({ cap: v })} />
                  <SelectField label="Join" value={s.join} options={JOINS} onChange={(v) => up({ join: v })} />
                </div>
                <DashEditor dash={s.dash} onChange={(dash) => up({ dash })} />
              </>
            )}
          </Block>

          <Block title="Effects" icon="◐">
            <Slider label="Opacity" value={s.opacity} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => up({ opacity: v })} />
            <SelectField label="Blend mode" value={s.blend} options={BLEND_MODES as unknown as BlendMode[]} onChange={(v) => up({ blend: v })} />
          </Block>

          <Block title="Animate" icon="▶" right={s.anim.preset !== 'none' ? <span className="anim-on" /> : undefined}>
            <AnimEditor shape={s} up={up} />
          </Block>
        </>
      )}
    </div>
  );
}

function Dot({ paint }: { paint: { type: string; color: string; stops: { color: string }[] } }) {
  const bg = paint.type === 'none' ? 'transparent' : paint.type === 'solid' ? paint.color : `linear-gradient(90deg, ${paint.stops.map((x) => x.color).join(',')})`;
  return <span className="paint-dot" style={{ background: bg, opacity: paint.type === 'none' ? 0.3 : 1 }} />;
}

function CornerEditor({ corners, onChange }: { corners: [number, number, number, number]; onChange: (c: [number, number, number, number]) => void }) {
  const linked = corners.every((v) => v === corners[0]);
  const [link, setLink] = useState(linked);
  const labels = ['↖', '↗', '↘', '↙'];
  return (
    <div className="field">
      <span className="lbl lbl--row"><span>Corner radius</span>
        <button className={`linkbtn${link ? ' on' : ''}`} title="link corners" onClick={() => setLink((l) => !l)}>{link ? '🔗' : '⛓'}</button>
      </span>
      {link ? (
        <NumberField label="" value={corners[0]} min={0} onChange={(v) => onChange([v, v, v, v])} />
      ) : (
        <div className="grid2">
          {labels.map((lb, i) => (
            <NumberField key={i} label={lb} value={corners[i]} min={0}
              onChange={(v) => { const c = corners.slice() as [number, number, number, number]; c[i] = v; onChange(c); }} />
          ))}
        </div>
      )}
    </div>
  );
}

const PRESET_LABELS: Record<AnimPreset, string> = {
  none: 'None', spin: 'Spin', pulse: 'Pulse', fade: 'Fade', dash: 'Dash flow', trace: 'Trace (draw on)', float: 'Float', wiggle: 'Wiggle',
};
const PRESET_DEFAULTS: Record<AnimPreset, Partial<Anim>> = {
  none: {}, spin: { repeat: 'loop', easing: 'linear', duration: 2000 }, pulse: { repeat: 'reverse', easing: 'easeInOut', duration: 900 },
  fade: { repeat: 'reverse', easing: 'easeInOut', duration: 1000 }, dash: { repeat: 'loop', easing: 'linear', duration: 700 },
  trace: { repeat: 'loop', easing: 'linear', duration: 1600 }, float: { repeat: 'reverse', easing: 'easeInOut', duration: 1200 },
  wiggle: { repeat: 'reverse', easing: 'easeInOut', duration: 500 },
};

function AnimEditor({ shape, up }: { shape: Shape; up: (patch: Partial<Shape>) => void }) {
  const a = shape.anim;
  const setA = (patch: Partial<Anim>) => up({ anim: { ...a, ...patch } });
  const usesAmount = a.preset === 'pulse' || a.preset === 'float' || a.preset === 'wiggle';

  const pickPreset = (p: AnimPreset) => {
    const patch: Partial<Shape> = { anim: { ...a, ...PRESET_DEFAULTS[p], preset: p } };
    if (p === 'dash' && !shape.dash.length) patch.dash = [12, 12];
    up(patch);
  };

  return (
    <>
      <SelectField label="Preset" value={a.preset}
        options={ANIM_PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] }))} onChange={pickPreset} />
      {a.preset !== 'none' && (
        <>
          <div className="grid2">
            <NumberField label="Duration (ms)" value={a.duration} min={50} step={50} onChange={(v) => setA({ duration: v })} />
            <NumberField label="Delay (ms)" value={a.delay} min={0} step={50} onChange={(v) => setA({ delay: v })} />
          </div>
          <div className="grid2">
            <SelectField<AnimRepeat> label="Repeat" value={a.repeat}
              options={[{ value: 'loop', label: 'Loop' }, { value: 'reverse', label: 'Reverse' }, { value: 'once', label: 'Once' }]} onChange={(v) => setA({ repeat: v })} />
            <SelectField<Easing> label="Easing" value={a.easing}
              options={[{ value: 'linear', label: 'Linear' }, { value: 'easeInOut', label: 'Ease in-out' }, { value: 'easeIn', label: 'Ease in' }, { value: 'easeOut', label: 'Ease out' }]} onChange={(v) => setA({ easing: v })} />
          </div>
          {usesAmount && <Slider label="Amount" min={0.2} max={3} step={0.1} value={a.amount} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => setA({ amount: v })} />}
          {a.preset === 'dash' && shape.stroke.type === 'none' && <p className="small muted">Tip: give this shape a stroke so the dash flow is visible.</p>}
          {a.preset === 'trace' && !['path', 'line', 'polygon'].includes(shape.type) && <p className="small muted">Trace works best on lines, pens and polygons.</p>}
          <p className="small muted">▶ Press Play on the canvas to preview · exports in Canvas mode.</p>
        </>
      )}
    </>
  );
}

function DashEditor({ dash, onChange }: { dash: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="field">
      <span className="lbl">Dash pattern <span className="muted small">(blank = solid)</span></span>
      <input className="in" value={dash.join(', ')} placeholder="e.g. 10, 6"
        onChange={(e) => onChange(e.target.value.split(',').map((x) => parseFloat(x.trim())).filter((n) => !isNaN(n)))} />
    </div>
  );
}
