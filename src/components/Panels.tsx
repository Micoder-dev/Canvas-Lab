import type { ReactNode } from 'react';
import { useStore } from '../store/useStore';
import type { PanelId } from '../store/useStore';

export function SidePanel({ id, side, title, children }: { id: PanelId; side: 'left' | 'right'; title: string; children: ReactNode }) {
  const open = useStore((s) => s.panels[id]);
  const w = useStore((s) => s.panelW[id]);
  const toggle = useStore((s) => s.togglePanel);
  const setW = useStore((s) => s.setPanelWidth);

  if (!open) {
    return (
      <button className={`paneltab paneltab--${side}`} title={`Show ${title}`} onClick={() => toggle(id)}>
        <span className="paneltab__chev">{side === 'left' ? '›' : '‹'}</span>
        <span className="paneltab__label">{title}</span>
      </button>
    );
  }

  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX; const startW = w;
    const move = (ev: PointerEvent) => { const dx = ev.clientX - startX; setW(id, side === 'left' ? startW + dx : startW - dx); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  return (
    <aside className={`sidepanel sidepanel--${side}`} style={{ width: w }}>
      {side === 'right' && <div className="resizer resizer--left" onPointerDown={onResizeDown} />}
      <div className="sidepanel__head">
        <span className="sidepanel__title">{title}</span>
        <button className="iconbtn" title={`Hide ${title}`} onClick={() => toggle(id)}>{side === 'left' ? '⟨' : '⟩'}</button>
      </div>
      <div className="sidepanel__body">{children}</div>
      {side === 'left' && <div className="resizer resizer--right" onPointerDown={onResizeDown} />}
    </aside>
  );
}
