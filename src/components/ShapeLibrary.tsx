import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { PRESETS, CATEGORIES } from '../model/presets';
import { shapeToD } from '../codegen/svgPath';
import { haptics } from '../lib/haptics';

export default function ShapeLibrary({ onClose }: { onClose: () => void }) {
  const addShape = useStore((s) => s.addShape);
  const artboard = useStore((s) => s.artboard);
  const toast = useStore((s) => s.toast);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('All');

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return PRESETS.filter((p) => (cat === 'All' || p.cat === cat) && (!query || p.name.toLowerCase().includes(query) || p.kw.includes(query)));
  }, [q, cat]);

  const insert = (id: string) => {
    const p = PRESETS.find((x) => x.id === id); if (!p) return;
    const size = Math.min(artboard.width, artboard.height) * 0.42;
    addShape(p.build(artboard.width / 2, artboard.height / 2, size));
    haptics.success(); toast(`Added ${p.name}`, 'success'); onClose();
  };

  return createPortal(
    <div className="help-scrim" onClick={onClose}>
      <div className="lib" onClick={(e) => e.stopPropagation()}>
        <div className="lib__head">
          <input className="in lib__search" autoFocus placeholder="Search shapes…  (arrow, star, heart…)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="iconbtn" onClick={onClose} title="close" style={{ fontSize: 16 }}>✕</button>
        </div>
        <div className="lib__cats">
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} className={`chipbtn${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="lib__grid">
          {list.map((p) => {
            const shp = p.build(50, 50, 60);
            const d = shapeToD(shp);
            const stroked = shp.fill.type === 'none';
            return (
              <button key={p.id} className="libitem" title={p.name} onClick={() => insert(p.id)}>
                <svg viewBox="0 0 100 100" className="libitem__svg">
                  <path d={d} fill={stroked ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={stroked ? 6 : 0} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="libitem__name">{p.name}</span>
              </button>
            );
          })}
          {!list.length && <p className="empty-hint" style={{ gridColumn: '1 / -1' }}>No shapes match “{q}”.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
