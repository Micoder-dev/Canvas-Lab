import { create } from 'zustand';
import type { Shape, PathNode, PathShape } from '../model/shapes';
import { bbox, translatePatch, makeShape } from '../model/shapes';

export type Tool = 'select' | 'rect' | 'ellipse' | 'line' | 'path' | 'polygon' | 'arc';
export type CodeMode = 'canvas' | 'imageVector' | 'svg' | 'vectorDrawable' | 'react' | 'canvasJs';
export type ColorFormat = 'hex' | 'rgb';
export type Theme = 'light' | 'dark';

export interface Artboard { width: number; height: number; background: string; }
export interface CodeOptions {
  funcName: string; relative: boolean; includeImports: boolean; modifierParam: boolean; colorFormat: ColorFormat; fitParent: boolean;
}
export interface Toast { id: number; msg: string; kind: 'info' | 'success' | 'error'; }

export type PanelId = 'rail' | 'insp' | 'code';
export interface Panels { rail: boolean; insp: boolean; code: boolean; }
export interface PanelW { rail: number; insp: number; code: number; }

export type Unit = 'dp' | 'sp' | 'px' | 'pt';

interface Persisted {
  shapes: Shape[]; artboard: Artboard; theme: Theme; opts: CodeOptions; codeMode: CodeMode; grid: boolean; snap: boolean;
  panels: Panels; panelW: PanelW; unit: Unit;
}

interface State extends Persisted {
  selectedId: string | null;
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };
  viewport: { w: number; h: number };
  playing: boolean;
  past: Shape[][];
  future: Shape[][];
  clipboard: Shape | null;
  toasts: Toast[];
  recentColors: string[];

  // live pen draft (own granular history so Ctrl+Z removes points one by one)
  penNodes: PathNode[];
  penPast: PathNode[][];
  penFuture: PathNode[][];

  setTool: (t: Tool) => void;
  addShape: (s: Shape) => void;
  updateShape: (id: string, patch: Partial<Shape>, coalesce?: boolean) => void;
  duplicateShape: (id: string) => void;
  deleteShape: (id: string) => void;
  selectShape: (id: string | null) => void;
  reorder: (id: string, dir: 'up' | 'down') => void;
  arrange: (id: string, where: 'front' | 'back') => void;
  showLibrary: boolean;
  setShowLibrary: (v: boolean) => void;
  nudge: (dx: number, dy: number) => void;
  copy: () => void;
  paste: () => void;

  beginEdit: () => void; // snapshot before a gesture (drag/transform/pen)
  undo: () => void;
  redo: () => void;

  // pen drafting
  penAdd: (n: PathNode) => void;
  penDragLast: (hOut: [number, number], hIn: [number, number]) => void;
  penUndo: () => void;
  penRedo: () => void;
  penFinish: (closed: boolean) => void;
  penCancel: () => void;
  penActive: () => boolean;

  setArtboard: (patch: Partial<Artboard>) => void;
  setCodeMode: (m: CodeMode) => void;
  setOpts: (patch: Partial<CodeOptions>) => void;
  setTheme: (t: Theme) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  togglePanel: (id: PanelId) => void;
  setPanelWidth: (id: PanelId, w: number) => void;
  setUnit: (u: Unit) => void;
  clear: () => void;

  setZoom: (z: number, focal?: { x: number; y: number }) => void;
  setPan: (p: { x: number; y: number }) => void;
  zoomBy: (factor: number, focal?: { x: number; y: number }) => void;
  resetView: () => void;
  setViewport: (w: number, h: number) => void;
  centerView: () => void;
  togglePlay: () => void;

  pushRecentColor: (c: string) => void;
  toast: (msg: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

const KEY = 'shape2compose:v4';
function load(): Partial<Persisted> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
const saved = load();

const clone = <T,>(v: T): T => structuredClone(v);
let uid = Date.now();
const newId = () => `s${++uid}`;

export const useStore = create<State>((set, get) => {
  const snapshot = (coalesce = false) => {
    const st = get();
    const past = st.past.slice();
    // coalesce: collapse a burst of edits (sliders/typing) into one undo step
    if (coalesce && past.length && performance.now() - lastSnap < 500) {
      lastSnap = performance.now();
      return; // keep the earlier pre-burst snapshot
    }
    past.push(clone(st.shapes));
    if (past.length > 100) past.shift();
    lastSnap = performance.now();
    set({ past, future: [] });
  };

  return {
    shapes: saved.shapes ?? [],
    artboard: saved.artboard ?? { width: 360, height: 360, background: '#FFFFFF' },
    theme: saved.theme ?? 'dark',
    opts: { funcName: 'GeneratedShape', relative: false, includeImports: true, modifierParam: true, colorFormat: 'hex', fitParent: false, ...(saved.opts ?? {}) },
    codeMode: saved.codeMode ?? 'canvas',
    grid: saved.grid ?? true,
    snap: saved.snap ?? false,
    panels: saved.panels ?? { rail: true, insp: true, code: true },
    panelW: saved.panelW ?? { rail: 196, insp: 292, code: 380 },
    unit: saved.unit ?? 'dp',

    selectedId: null,
    tool: 'select',
    zoom: 1,
    pan: { x: 0, y: 0 },
    viewport: { w: 0, h: 0 },
    playing: false,
    past: [],
    future: [],
    clipboard: null,
    toasts: [],
    recentColors: ['#4F8CFF', '#E11D2A', '#2FBF71', '#F5A623', '#7C5CFF', '#FF5C7A'],
    penNodes: [],
    penPast: [],
    penFuture: [],

    setTool: (t) => set({ tool: t }),

    addShape: (s) => { snapshot(); set((st) => ({ shapes: [...st.shapes, s], selectedId: s.id })); },

    updateShape: (id, patch, coalesce = false) => {
      snapshot(coalesce);
      set((st) => ({ shapes: st.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)) }));
    },

    duplicateShape: (id) => {
      const src = get().shapes.find((s) => s.id === id);
      if (!src) return;
      snapshot();
      const copy = Object.assign(clone(src), translatePatch(src, 16, 16)) as Shape; copy.id = newId(); copy.name = src.name + '-copy';
      set((st) => ({ shapes: [...st.shapes, copy], selectedId: copy.id }));
      get().toast('Duplicated', 'success');
    },

    deleteShape: (id) => {
      snapshot();
      set((st) => ({ shapes: st.shapes.filter((s) => s.id !== id), selectedId: st.selectedId === id ? null : st.selectedId }));
    },

    selectShape: (id) => set({ selectedId: id }),

    arrange: (id, where) => {
      snapshot();
      set((st) => {
        const arr = st.shapes.filter((s) => s.id !== id); const s = st.shapes.find((x) => x.id === id); if (!s) return {};
        return { shapes: where === 'front' ? [...arr, s] : [s, ...arr] };
      });
    },
    showLibrary: false,
    setShowLibrary: (v) => set({ showLibrary: v }),

    reorder: (id, dir) => {
      snapshot();
      set((st) => {
        const i = st.shapes.findIndex((s) => s.id === id); if (i < 0) return {};
        const j = dir === 'up' ? i + 1 : i - 1; if (j < 0 || j >= st.shapes.length) return {};
        const next = st.shapes.slice(); [next[i], next[j]] = [next[j], next[i]]; return { shapes: next };
      });
    },

    nudge: (dx, dy) => {
      const id = get().selectedId; if (!id) return;
      const s = get().shapes.find((x) => x.id === id); if (!s) return;
      snapshot(true);
      set((st) => ({ shapes: st.shapes.map((x) => (x.id === id ? ({ ...x, ...translatePatch(x, dx, dy) } as Shape) : x)) }));
    },

    copy: () => { const s = get().shapes.find((x) => x.id === get().selectedId); if (s) { set({ clipboard: clone(s) }); get().toast('Copied'); } },
    paste: () => {
      const c = get().clipboard; if (!c) return;
      snapshot();
      const copy = Object.assign(clone(c), translatePatch(c, 20, 20)) as Shape; copy.id = newId(); copy.name = c.name + '-copy';
      set((st) => ({ shapes: [...st.shapes, copy], selectedId: copy.id }));
      get().toast('Pasted', 'success');
    },

    beginEdit: () => snapshot(),

    undo: () => set((st) => {
      if (!st.past.length) return {};
      const past = st.past.slice(); const prev = past.pop()!;
      return { past, future: [clone(st.shapes), ...st.future], shapes: prev, selectedId: prev.some((s) => s.id === st.selectedId) ? st.selectedId : null };
    }),
    redo: () => set((st) => {
      if (!st.future.length) return {};
      const future = st.future.slice(); const next = future.shift()!;
      return { future, past: [...st.past, clone(st.shapes)], shapes: next };
    }),

    penActive: () => get().tool === 'path' && (get().penNodes.length > 0 || get().penPast.length > 0),
    penAdd: (n) => set((st) => ({ penPast: [...st.penPast, clone(st.penNodes)], penNodes: [...st.penNodes, n], penFuture: [] })),
    penDragLast: (hOut, hIn) => set((st) => {
      if (!st.penNodes.length) return {};
      const nodes = st.penNodes.slice(); const i = nodes.length - 1;
      nodes[i] = { ...nodes[i], hOut, hIn }; return { penNodes: nodes };
    }),
    penUndo: () => set((st) => {
      if (!st.penPast.length) return {};
      const past = st.penPast.slice(); const prev = past.pop()!;
      return { penPast: past, penFuture: [clone(st.penNodes), ...st.penFuture], penNodes: prev };
    }),
    penRedo: () => set((st) => {
      if (!st.penFuture.length) return {};
      const future = st.penFuture.slice(); const next = future.shift()!;
      return { penFuture: future, penPast: [...st.penPast, clone(st.penNodes)], penNodes: next };
    }),
    penFinish: (closed) => {
      const nodes = get().penNodes;
      set({ penNodes: [], penPast: [], penFuture: [] });
      if (nodes.length >= 2) {
        const s = makeShape('path', nodes[0].x, nodes[0].y) as PathShape;
        s.nodes = nodes; s.closed = closed;
        get().addShape(s); get().toast('Path created', 'success');
      }
    },
    penCancel: () => set({ penNodes: [], penPast: [], penFuture: [] }),

    setArtboard: (patch) => set((st) => ({ artboard: { ...st.artboard, ...patch } })),
    setCodeMode: (m) => set({ codeMode: m }),
    setOpts: (patch) => set((st) => ({ opts: { ...st.opts, ...patch } })),
    setTheme: (t) => set({ theme: t }),
    toggleGrid: () => set((st) => ({ grid: !st.grid })),
    toggleSnap: () => set((st) => ({ snap: !st.snap })),
    togglePanel: (id) => set((st) => ({ panels: { ...st.panels, [id]: !st.panels[id] } })),
    setPanelWidth: (id, w) => set((st) => ({ panelW: { ...st.panelW, [id]: Math.max(150, Math.min(640, w)) } })),
    setUnit: (u) => set({ unit: u }),
    clear: () => { snapshot(); set({ shapes: [], selectedId: null }); },

    setZoom: (z, focal) => get().zoomBy(clampZoom(z) / get().zoom, focal),
    setPan: (p) => set({ pan: p }),
    zoomBy: (factor, focal) => {
      const st = get();
      const nz = clampZoom(st.zoom * factor);
      const f = focal ?? { x: st.artboard.width / 2, y: st.artboard.height / 2 };
      // keep focal point stationary on screen
      const wx = (f.x - st.pan.x) / st.zoom;
      const wy = (f.y - st.pan.y) / st.zoom;
      set({ zoom: nz, pan: { x: f.x - wx * nz, y: f.y - wy * nz } });
    },
    resetView: () => set((st) => ({ zoom: 1, pan: { x: Math.round((st.viewport.w - st.artboard.width) / 2), y: Math.round((st.viewport.h - st.artboard.height) / 2) } })),
    centerView: () => set((st) => ({ pan: { x: Math.round((st.viewport.w - st.artboard.width * st.zoom) / 2), y: Math.round((st.viewport.h - st.artboard.height * st.zoom) / 2) } })),
    setViewport: (w, h) => set({ viewport: { w, h } }),
    togglePlay: () => set((st) => ({ playing: !st.playing })),

    pushRecentColor: (c) => set((st) => ({ recentColors: [c, ...st.recentColors.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 12) })),
    toast: (msg, kind = 'info') => {
      const id = ++uid; set((st) => ({ toasts: [...st.toasts, { id, msg, kind }] }));
      setTimeout(() => get().dismissToast(id), 2200);
    },
    dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  };
});

let lastSnap = 0;
function clampZoom(z: number) { return Math.min(8, Math.max(0.1, z)); }

export const fitBounds = (shapes: Shape[]) => {
  if (!shapes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) { const b = bbox(s); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  return { minX, minY, maxX, maxY };
};

// debounced autosave
let saveT: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((st) => {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const p: Persisted = { shapes: st.shapes, artboard: st.artboard, theme: st.theme, opts: st.opts, codeMode: st.codeMode, grid: st.grid, snap: st.snap, panels: st.panels, panelW: st.panelW, unit: st.unit };
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
  }, 400);
});
