import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';

export interface Menu { x: number; y: number; id: string | null; }

export default function ContextMenu({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const st = useStore();
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('blur', close);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('blur', close); window.removeEventListener('keydown', key); };
  }, [onClose]);

  const run = (fn: () => void) => () => { fn(); onClose(); };
  const item = (label: string, fn: () => void, danger = false, kbd?: string) => (
    <button className={`ctx-item${danger ? ' danger' : ''}`} onClick={run(fn)}><span>{label}</span>{kbd && <kbd>{kbd}</kbd>}</button>
  );
  const sep = <div className="ctx-sep" />;
  const id = menu.id;

  return createPortal(
    <div className="ctx" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      {id ? <>
        {item('Duplicate', () => st.duplicateShape(id), false, '⌘D')}
        {item('Copy', () => st.copy())}
        {st.clipboard && item('Paste', () => st.paste(), false, '⌘V')}
        {sep}
        {item('Bring to front', () => st.arrange(id, 'front'))}
        {item('Forward', () => st.reorder(id, 'up'))}
        {item('Backward', () => st.reorder(id, 'down'))}
        {item('Send to back', () => st.arrange(id, 'back'))}
        {sep}
        {item('Delete', () => st.deleteShape(id), true, 'Del')}
      </> : <>
        {item('Add shape…', () => st.setShowLibrary(true))}
        {st.clipboard && item('Paste here', () => st.paste(), false, '⌘V')}
        {sep}
        {item('Reset / center view', () => st.resetView(), false, '0')}
        {item(st.grid ? 'Hide grid' : 'Show grid', () => st.toggleGrid())}
        {item(st.snap ? 'Disable snap' : 'Enable snap', () => st.toggleSnap())}
        {st.shapes.length > 0 && <>{sep}{item('Clear all', () => st.clear(), true)}</>}
      </>}
    </div>,
    document.body,
  );
}
