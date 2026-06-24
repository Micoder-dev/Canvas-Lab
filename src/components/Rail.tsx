import { useStore } from '../store/useStore';
import type { Tool } from '../store/useStore';
import { fillCss } from './paintCss';
import { haptics } from '../lib/haptics';

const tools: { id: Tool; glyph: string; label: string; key: string; wide?: boolean }[] = [
  { id: 'select', glyph: '⤢', label: 'Select', key: 'V' },
  { id: 'rect', glyph: '▭', label: 'Rect', key: 'R' },
  { id: 'ellipse', glyph: '◯', label: 'Ellipse', key: 'O' },
  { id: 'polygon', glyph: '⬠', label: 'Polygon', key: 'G' },
  { id: 'arc', glyph: '◴', label: 'Arc', key: 'A' },
  { id: 'line', glyph: '╱', label: 'Line', key: 'L' },
  { id: 'path', glyph: '✎', label: 'Pen', key: 'P', wide: true },
];

export default function Rail() {
  const { shapes, selectedId, tool } = useStore();
  const setTool = useStore((s) => s.setTool);
  const selectShape = useStore((s) => s.selectShape);
  const updateShape = useStore((s) => s.updateShape);
  const deleteShape = useStore((s) => s.deleteShape);
  const duplicateShape = useStore((s) => s.duplicateShape);
  const reorder = useStore((s) => s.reorder);

  const pick = (t: Tool) => { setTool(t); haptics.select(); };

  return (
    <div className="pc">
      <div className="col__title">Tools</div>
      <div className="toolgrid">
        {tools.map((t) => (
          <button key={t.id} className={`toolbtn${t.wide ? ' toolbtn--wide' : ''}${tool === t.id ? ' active' : ''}`}
            title={`${t.label} (${t.key})`} onClick={() => pick(t.id)}>
            <span className="glyph">{t.glyph}</span>
            <span className="toolbtn__label">{t.label}</span>
            <kbd className="toolbtn__key">{t.key}</kbd>
          </button>
        ))}
      </div>

      <div className="col__title" style={{ marginTop: 18 }}>Layers <span className="muted small">({shapes.length})</span></div>
      <ul className="layers">
        {[...shapes].reverse().map((s) => (
          <li key={s.id} className={`layer${s.id === selectedId ? ' sel' : ''}`} onClick={() => selectShape(s.id)}>
            <span className="layer__sw" style={{ background: fillCss(s.fill) }} />
            <span className="layer__name">{s.name}</span>
            <span className="layer__ctrls">
              <button className="iconbtn" title={s.visible ? 'hide' : 'show'} onClick={(e) => { e.stopPropagation(); updateShape(s.id, { visible: !s.visible }); }}>{s.visible ? '◉' : '◌'}</button>
              <button className="iconbtn" title="bring forward" onClick={(e) => { e.stopPropagation(); reorder(s.id, 'up'); }}>↑</button>
              <button className="iconbtn" title="send back" onClick={(e) => { e.stopPropagation(); reorder(s.id, 'down'); }}>↓</button>
              <button className="iconbtn" title="duplicate" onClick={(e) => { e.stopPropagation(); duplicateShape(s.id); }}>⧉</button>
              <button className="iconbtn danger" title="delete" onClick={(e) => { e.stopPropagation(); deleteShape(s.id); }}>✕</button>
            </span>
          </li>
        ))}
        {!shapes.length && <li className="empty-hint">No shapes yet.<br />Pick a tool and draw on the canvas.</li>}
      </ul>
    </div>
  );
}
