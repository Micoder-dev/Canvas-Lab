import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Tool } from '../store/useStore';
import { haptics } from './haptics';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select', r: 'rect', o: 'ellipse', g: 'polygon', a: 'arc', l: 'line', p: 'path',
};

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const st = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) (st.penActive() ? st.penRedo() : st.redo()); else (st.penActive() ? st.penUndo() : st.undo()); haptics.tap(); return; }
      if (mod && k === 'y') { e.preventDefault(); st.penActive() ? st.penRedo() : st.redo(); return; }
      if (mod && k === 'd') { e.preventDefault(); if (st.selectedId) st.duplicateShape(st.selectedId); return; }
      if (mod && k === 'c') { st.copy(); return; }
      if (mod && k === 'v') { st.paste(); return; }
      if (mod) return;

      if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        if (st.tool === 'path' && st.penNodes.length) { st.penUndo(); haptics.tap(); }
        else if (st.selectedId) { st.deleteShape(st.selectedId); haptics.warn(); }
        return;
      }
      if (k === 'escape') { st.selectShape(null); st.setTool('select'); return; }
      if (k === '=' || k === '+') { e.preventDefault(); st.zoomBy(1.2); return; }
      if (k === '-') { e.preventDefault(); st.zoomBy(1 / 1.2); return; }
      if (k === '0') { e.preventDefault(); st.resetView(); return; }

      const nudge = e.shiftKey ? 10 : 1;
      if (k === 'arrowup') { e.preventDefault(); st.nudge(0, -nudge); return; }
      if (k === 'arrowdown') { e.preventDefault(); st.nudge(0, nudge); return; }
      if (k === 'arrowleft') { e.preventDefault(); st.nudge(-nudge, 0); return; }
      if (k === 'arrowright') { e.preventDefault(); st.nudge(nudge, 0); return; }

      if (TOOL_KEYS[k]) { st.setTool(TOOL_KEYS[k]); haptics.select(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
