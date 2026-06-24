import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { generateCanvas } from '../codegen/canvasGenerator';
import { generateImageVector } from '../codegen/imageVectorGenerator';
import { generateSVG, generateReactSVG, generateVectorDrawable, generateCanvasJS } from '../codegen/exporters';
import { Switch, Row, TextField, SelectField, Dropdown, Block } from './ui';
import { PlatformIcon } from './platformIcons';
import type { ColorFormat, CodeMode } from '../store/useStore';

const TARGETS = [
  { value: 'canvas' as CodeMode, label: 'Canvas', ext: 'kt', group: 'Jetpack Compose', icon: <PlatformIcon k="compose" /> },
  { value: 'imageVector' as CodeMode, label: 'ImageVector', ext: 'kt', group: 'Jetpack Compose', icon: <PlatformIcon k="compose" /> },
  { value: 'vectorDrawable' as CodeMode, label: 'VectorDrawable', ext: 'xml', group: 'Android (XML)', icon: <PlatformIcon k="android" /> },
  { value: 'svg' as CodeMode, label: 'SVG', ext: 'svg', group: 'Web', icon: <PlatformIcon k="svg" /> },
  { value: 'react' as CodeMode, label: 'React (inline SVG)', ext: 'tsx', group: 'Web', icon: <PlatformIcon k="react" /> },
  { value: 'canvasJs' as CodeMode, label: 'HTML Canvas', ext: 'js', group: 'Web', icon: <PlatformIcon k="js" /> },
];

export default function CodeColumn() {
  const { shapes, artboard, codeMode, opts } = useStore();
  const setCodeMode = useStore((s) => s.setCodeMode);
  const setOpts = useStore((s) => s.setOpts);
  const toast = useStore((s) => s.toast);
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);

  const code = useMemo(() => {
    switch (codeMode) {
      case 'canvas': return generateCanvas(shapes, artboard, opts);
      case 'imageVector': return generateImageVector(shapes, artboard, opts);
      case 'svg': return generateSVG(shapes, artboard);
      case 'vectorDrawable': return generateVectorDrawable(shapes, artboard);
      case 'react': return generateReactSVG(shapes, artboard, opts);
      case 'canvasJs': return generateCanvasJS(shapes, artboard, opts);
    }
  }, [shapes, artboard, codeMode, opts]);
  const lines = code.split('\n');
  const target = TARGETS.find((t) => t.value === codeMode)!;
  const isCompose = codeMode === 'canvas' || codeMode === 'imageVector';
  const animated = codeMode === 'canvas' && shapes.some((s) => s.anim?.preset && s.anim.preset !== 'none');

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); toast('Copied', 'success'); setTimeout(() => setCopied(false), 1200); }
    catch { toast('Copy failed', 'error'); }
  };
  const dl = (text: string, name: string, type = 'text/plain') => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };
  const downloadSVG = () => { dl(generateSVG(shapes, artboard), `${opts.funcName}.svg`, 'image/svg+xml'); toast('Saved SVG', 'success'); };
  const downloadPNG = async (scale = 2) => {
    const svg = generateSVG(shapes, artboard);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    try { await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }); } catch { toast('PNG failed', 'error'); return; }
    const cv = document.createElement('canvas'); cv.width = artboard.width * scale; cv.height = artboard.height * scale;
    const ctx = cv.getContext('2d')!; ctx.scale(scale, scale); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
    cv.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${opts.funcName}@${scale}x.png`; a.click(); URL.revokeObjectURL(a.href); toast('Saved PNG', 'success'); });
  };

  return (
    <div className="pc codecol">
      <div className="codecol__top">
        <div className="field"><span className="lbl">Export target {animated && <span className="vx-badge vx-badge--grey" style={{ fontSize: 9 }}>animated</span>}</span>
          <Dropdown value={codeMode} options={TARGETS} onChange={setCodeMode} /></div>
        <div className="code-actions">
          <button className={`vx-btn vx-btn--gradient vx-btn--sm copybtn${copied ? ' is-copied' : ''}`} onClick={copy}>{copied ? '✓ Copied' : '⧉ Copy'}</button>
          <button className="vx-btn vx-btn--outline vx-btn--sm" onClick={() => { dl(code, `${opts.funcName}.${target.ext}`); toast(`Saved .${target.ext}`, 'success'); }}>↓ .{target.ext}</button>
          <button className={`vx-btn vx-btn--ghost vx-btn--sm${wrap ? ' is-on' : ''}`} onClick={() => setWrap((w) => !w)} title="word wrap">⇄</button>
        </div>
        <div className="code-actions">
          <button className="vx-btn vx-btn--outline vx-btn--sm" style={{ flex: 1 }} onClick={downloadSVG}>↓ SVG asset</button>
          <button className="vx-btn vx-btn--outline vx-btn--sm" style={{ flex: 1 }} onClick={() => downloadPNG(2)}>↓ PNG @2x</button>
        </div>
      </div>

      <pre className={`code-out${wrap ? ' wrap' : ''}`}>
        <code>{lines.map((l, i) => <span className="cl" key={i}><span className="cl__n">{i + 1}</span><span className="cl__t">{l || ' '}</span></span>)}</code>
      </pre>

      <Block title="Options" icon="⚙" defaultOpen={false}>
        <TextField label="Name" value={opts.funcName} onChange={(v) => setOpts({ funcName: v || 'GeneratedShape' })} />
        {isCompose && <>
          <SelectField<ColorFormat> label="Color format" value={opts.colorFormat}
            options={[{ value: 'hex', label: 'Color(0xFF…)' }, { value: 'rgb', label: 'Color(r, g, b)' }]} onChange={(v) => setOpts({ colorFormat: v })} />
          <Row label="Include imports"><Switch checked={opts.includeImports} onChange={(v) => setOpts({ includeImports: v })} /></Row>
        </>}
        {codeMode === 'canvas' && <>
          <Row label="modifier param"><Switch checked={opts.modifierParam} onChange={(v) => setOpts({ modifierParam: v })} /></Row>
          <Row label="Fit parent (dp-adaptive)"><Switch checked={opts.fitParent} onChange={(v) => setOpts({ fitParent: v })} /></Row>
          <Row label="Responsive coords"><Switch checked={opts.relative || opts.fitParent} onChange={(v) => setOpts({ relative: v })} /></Row>
          <p className="small muted">Fit parent → the Canvas fills its width &amp; keeps aspect ratio, so it scales with the device instead of a fixed dp size.</p>
        </>}
        {!isCompose && <p className="small muted">Gradients are full in SVG; other targets fall back to solid. Animations export in Compose Canvas.</p>}
      </Block>
    </div>
  );
}
