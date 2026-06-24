import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import Rail from './components/Rail';
import Editor from './components/Editor';
import Inspector from './components/Inspector';
import CodeColumn from './components/CodeColumn';
import Toasts from './components/Toasts';
import HelpModal from './components/HelpModal';
import ShapeLibrary from './components/ShapeLibrary';
import { SidePanel } from './components/Panels';
import { useShortcuts } from './lib/useShortcuts';
import { installGlobalHaptics } from './lib/haptics';

export default function App() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const clear = useStore((s) => s.clear);
  const shapes = useStore((s) => s.shapes);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const panels = useStore((s) => s.panels);
  const togglePanel = useStore((s) => s.togglePanel);
  const lib = useStore((s) => s.showLibrary);
  const setLib = useStore((s) => s.setShowLibrary);
  const [help, setHelp] = useState(false);

  useShortcuts();
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { installGlobalHaptics(); }, []);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span className="mark">◆</span>shape<b>2</b>compose</span>
        <span className="topbar__div" />
        <div className="histbtns">
          <button className="iconbtn" disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={undo}>↶</button>
          <button className="iconbtn" disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={redo}>↷</button>
        </div>
        <button className="vx-btn vx-btn--gradient vx-btn--sm" onClick={() => setLib(true)} title="Shape library">＋ Shapes</button>
        <span className="spacer" />
        <div className="histbtns">
          <button className={`iconbtn${panels.rail ? ' on' : ''}`} title="Toggle tools" onClick={() => togglePanel('rail')}>▤</button>
          <button className={`iconbtn${panels.insp ? ' on' : ''}`} title="Toggle inspector" onClick={() => togglePanel('insp')}>▥</button>
          <button className={`iconbtn${panels.code ? ' on' : ''}`} title="Toggle code" onClick={() => togglePanel('code')}>‹›</button>
        </div>
        <span className="topbar__div" />
        <span className="muted small">{shapes.length} shape{shapes.length === 1 ? '' : 's'}</span>
        <button className="theme-toggle" title="Help / guide" onClick={() => setHelp(true)}>?</button>
        <button className="theme-toggle" title="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button>
        <button className="vx-btn vx-btn--outline vx-btn--sm" onClick={() => { if (shapes.length && confirm('Clear all shapes?')) clear(); }}>Clear</button>
      </header>
      <div className="workspace">
        <SidePanel id="rail" side="left" title="Tools"><Rail /></SidePanel>
        <main className="stage-area"><Editor /></main>
        <SidePanel id="insp" side="right" title="Inspector"><Inspector /></SidePanel>
        <SidePanel id="code" side="right" title="Export"><CodeColumn /></SidePanel>
      </div>
      <Toasts />
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {lib && <ShapeLibrary onClose={() => setLib(false)} />}
      {/* lib also opens from canvas right-click via store flag */}
    </div>
  );
}
