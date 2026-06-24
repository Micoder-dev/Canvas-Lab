import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PRESETS } from '../model/presets';
import { shapeToD } from '../codegen/svgPath';

const ACC = '#5E6AD2';

function CmdPreview({ d, ctrls, anchors }: { d: string; ctrls: [number, number][]; anchors: [number, number][] }) {
  return (
    <svg viewBox="0 0 120 70" className="help-svg">
      {ctrls.map((c, i) => <line key={i} x1={anchors[Math.min(i, anchors.length - 1)][0]} y1={anchors[Math.min(i, anchors.length - 1)][1]} x2={c[0]} y2={c[1]} stroke={ACC} strokeWidth="1" opacity="0.5" />)}
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {ctrls.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r="3.5" fill={ACC} />)}
      {anchors.map((a, i) => <rect key={i} x={a[0] - 3.5} y={a[1] - 3.5} width="7" height="7" rx="1.5" fill="var(--surface)" stroke={ACC} strokeWidth="1.6" />)}
    </svg>
  );
}
const Tbl = ({ rows }: { rows: [string, string][] }) => (
  <table className="help-tbl"><tbody>{rows.map(([k, v]) => <tr key={k}><td className="help-tbl__k">{k}</td><td className="muted">{v}</td></tr>)}</tbody></table>
);
const KTbl = ({ rows }: { rows: [string, string][] }) => (
  <table className="help-tbl"><tbody>{rows.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
);

function Swatch({ bg, label }: { bg: string; label: string }) {
  return <figure className="help-sw"><div className="help-sw__chip" style={{ background: bg }} /><figcaption>{label}</figcaption></figure>;
}

const SECTIONS: { id: string; title: string; body: () => React.ReactNode }[] = [
  {
    id: 'start', title: 'Getting started', body: () => (
      <>
        <p className="muted">Draw shapes on the artboard, style them in the inspector, then export to Jetpack Compose, SVG, Android VectorDrawable, React, or HTML Canvas — plus SVG/PNG asset files.</p>
        <Tbl rows={[
          ['Artboard', 'The white page = your composable size (dp). Set W/H in the inspector when nothing is selected.'],
          ['Panels', 'Tools, Inspector and Export each collapse and resize — drag their edges, or toggle from the top bar.'],
          ['Everything autosaves', 'Your work persists locally between sessions.'],
        ]} />
      </>
    ),
  },
  {
    id: 'tools', title: 'Tools', body: () => (
      <KTbl rows={[['V', 'Select / move / resize / rotate'], ['R', 'Rectangle (per-corner radius)'], ['O', 'Ellipse'], ['G', 'Polygon / star'], ['A', 'Arc / pie'], ['L', 'Line'], ['P', 'Pen (bezier paths)']]} />
    ),
  },
  {
    id: 'pen', title: 'Pen & curves', body: () => (
      <>
        <p className="muted small">Each path segment becomes one of these, depending on its control handles:</p>
        <div className="help-cmds">
          <div className="help-cmd"><CmdPreview d="M15 55 L105 20" ctrls={[]} anchors={[[15, 55], [105, 20]]} /><div className="help-cmd__name">lineTo</div><code className="help-cmd__kt">lineTo(x, y)</code><p className="muted small">Corner point, no handles.</p></div>
          <div className="help-cmd"><CmdPreview d="M15 55 Q60 5 105 50" ctrls={[[60, 5]]} anchors={[[15, 55], [105, 50]]} /><div className="help-cmd__name">quadraticBezierTo</div><code className="help-cmd__kt">quadraticBezierTo(cx, cy, x, y)</code><p className="muted small">One control handle.</p></div>
          <div className="help-cmd"><CmdPreview d="M15 55 C35 5 85 65 105 18" ctrls={[[35, 5], [85, 65]]} anchors={[[15, 55], [105, 18]]} /><div className="help-cmd__name">cubicTo</div><code className="help-cmd__kt">cubicTo(c1x, c1y, c2x, c2y, x, y)</code><p className="muted small">Two control handles (click-drag).</p></div>
        </div>
        <Tbl rows={[['Click', 'add a corner point'], ['Click-drag', 'add a smooth point (pulls out handles)'], ['Click first point', 'close the path'], ['Enter / double-click', 'finish'], ['⌫ / Ctrl+Z', 'remove last point'], ['Esc', 'cancel'], ['Edit', 'drag square anchors / round handles; Alt breaks symmetry; double-click toggles corner/smooth']]} />
      </>
    ),
  },
  {
    id: 'shapes', title: 'Shape library', body: () => (
      <>
        <p className="muted small">Click <b>＋ Shapes</b> in the top bar (or right-click the canvas → Add shape) for {PRESETS.length}+ ready shapes with search.</p>
        <div className="help-thumbs">
          {PRESETS.slice(0, 12).map((p) => { const s = p.build(50, 50, 60); const d = shapeToD(s); const st = s.fill.type === 'none'; return (
            <div className="help-thumb" key={p.id}><svg viewBox="0 0 100 100"><path d={d} fill={st ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={st ? 6 : 0} strokeLinejoin="round" strokeLinecap="round" /></svg></div>
          ); })}
        </div>
      </>
    ),
  },
  {
    id: 'paint', title: 'Fill & stroke', body: () => (
      <>
        <p className="muted small">Fill and stroke each support: none, solid, and linear / radial / sweep gradients (multi-stop).</p>
        <div className="help-row">
          <Swatch bg="#5E6AD2" label="Solid" />
          <Swatch bg="linear-gradient(90deg,#5E6AD2,#E15E8A)" label="Linear" />
          <Swatch bg="radial-gradient(circle,#FBBF24,#E15E8A)" label="Radial" />
          <Swatch bg="conic-gradient(#5E6AD2,#3FB950,#FBBF24,#5E6AD2)" label="Sweep" />
        </div>
        <Tbl rows={[['Stroke', 'width, cap (Butt/Round/Square), join (Miter/Round/Bevel)'], ['Dash', 'comma-separated pattern → PathEffect.dashPathEffect'], ['Per-corner radius', 'rectangles support 4 independent corners']]} />
      </>
    ),
  },
  {
    id: 'effects', title: 'Effects', body: () => (
      <Tbl rows={[['Opacity', 'per-shape alpha'], ['Blend mode', '19 Compose BlendModes (Multiply, Screen, Overlay…)'], ['Rotation', 'around the shape center → rotate() / transform']]} />
    ),
  },
  {
    id: 'anim', title: 'Animations', body: () => (
      <>
        <Tbl rows={[['Spin', 'rotate() + animateFloat 0→360'], ['Pulse', 'scale() reversing'], ['Fade', 'animated alpha'], ['Dash flow', 'animated dashPathEffect phase'], ['Trace', 'draw-on via PathMeasure.getSegment'], ['Float', 'translate() bob'], ['Wiggle', 'small reversing rotate()']]} />
        <p className="muted small">Configure duration, delay, easing, repeat (loop/reverse/once) and amount. Hit <b>Preview</b> on the canvas to play; code exports as a real <code>rememberInfiniteTransition</code> in Compose Canvas.</p>
      </>
    ),
  },
  {
    id: 'nav', title: 'Canvas & grid', body: () => (
      <KTbl rows={[['Drag background', 'Pan'], ['Scroll', 'Zoom toward the cursor'], ['Shift+scroll', 'Pan horizontally'], ['Space-drag / middle-drag', 'Pan'], ['+ / − / 0', 'Zoom in / out / reset & center'], ['Snap', 'resize & draw snap to round values aligned to the graph grid'], ['Right-click', 'context menu']]} />
    ),
  },
  {
    id: 'export', title: 'Export', body: () => (
      <Tbl rows={[['Compose · Canvas', 'DrawScope + animations'], ['Compose · ImageVector', 'static vector asset'], ['SVG', 'full gradients; download as .svg'], ['Android VectorDrawable', 'res/drawable XML'], ['React', 'inline-SVG component'], ['HTML Canvas', 'Path2D drawing function'], ['PNG @2x', 'rasterized asset download']]} />
    ),
  },
  {
    id: 'keys', title: 'Shortcuts', body: () => (
      <KTbl rows={[['Ctrl/⌘ Z', 'Undo'], ['Ctrl/⌘ ⇧ Z', 'Redo'], ['Ctrl/⌘ D', 'Duplicate'], ['Ctrl/⌘ C / V', 'Copy / paste'], ['Delete', 'Delete'], ['Arrows', 'Nudge (⇧ = ×10)'], ['Esc', 'Deselect']]} />
    ),
  },
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
  const [sec, setSec] = useState('start');
  const active = SECTIONS.find((s) => s.id === sec)!;
  return createPortal(
    <div className="help-scrim" onClick={onClose}>
      <div className="help help--nav" onClick={(e) => e.stopPropagation()}>
        <div className="help__nav">
          <div className="help__brand">Guide</div>
          {SECTIONS.map((s) => (
            <button key={s.id} className={`help__navitem${sec === s.id ? ' on' : ''}`} onClick={() => setSec(s.id)}>{s.title}</button>
          ))}
        </div>
        <div className="help__main">
          <div className="help__head"><h2>{active.title}</h2><button className="iconbtn" onClick={onClose} style={{ fontSize: 16 }}>✕</button></div>
          <div className="help__content">{active.body()}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
