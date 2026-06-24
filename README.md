# shape2compose

A web canvas editor where you draw shapes visually and copy ready-to-use
**Jetpack Compose** Kotlin code — `Canvas { }` DrawScope or `ImageVector`.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Architecture

The whole app follows one rule: **the editor and the code generators never
talk to each other directly.** They communicate through a normalized Shape
Model. This is what lets one design produce multiple output formats.

```
[Konva editor] → [Shape Model (plain JSON)] → [Code generators]
   Editor.tsx        model/shapes.ts            codegen/*.ts
```

- `src/model/shapes.ts` — the Shape Model: `rect`, `ellipse`, `line`, `path`
  + the `Artboard`. Plain data, no UI/Kotlin knowledge.
- `src/store/useStore.ts` — Zustand store (shapes, selection, tool, options).
- `src/components/Editor.tsx` — Konva stage: draw, select, move, resize,
  rotate, pen tool. Renders gradients/dashes/stars/arcs. Shape Model only.
- `src/components/Inspector.tsx` — full property inspector (every field).
- `src/components/PaintEditor.tsx` — solid + gradient stop editor.
- `src/codegen/canvasGenerator.ts` — Shape Model → `Canvas { }` DrawScope.
- `src/codegen/imageVectorGenerator.ts` — Shape Model → `ImageVector`.
- `src/codegen/utils.ts` — Kotlin literal helpers (float, color, brush, coords).
- `src/styles/` — Vexora design system (tokens, components) + editor chrome.

## Design system

UI is **neutral-pro** (Linear/Figma-style): flat near-black/grey surfaces, thin
1px borders, a single indigo accent used only on active items, compact density,
SF Pro typography, light/dark themes. Re-theme by editing `src/styles/tokens.css`
(the accent is the `--red` token, kept by name so the ported `vx-*` components
inherit it). Layout is **canvas-first**: tools left, big canvas, inspector right,
and the Kotlin output in a collapsible **bottom drawer**.

## Animation

Per shape, an **Animate** panel adds presets that export real Compose animation
code (`rememberInfiniteTransition` + `animateFloat`, or `Animatable` for once):
**Spin** (`rotate`), **Pulse** (`scale`), **Fade** (alpha), **Dash flow**
(animated `dashPathEffect` phase), **Trace** (draw-on via `PathMeasure.getSegment`),
**Float** (`translate`), **Wiggle**. Duration, delay, easing, repeat
(loop/reverse/once) and amount are configurable. A **Preview** button plays the
animation live on the canvas. (Animations export in Canvas mode.)

Press **?** in the top bar for the in-app **Guide** — visual previews of the path
commands (`lineTo` / `quadraticBezierTo` / `cubicTo`), tools, pen, animations and
shortcuts.

## Features

Shapes: **rectangle** (per-corner radius), **ellipse**, **line**, **pen/path**
(closed + even-odd fill), **polygon/star** (sides + star depth), **arc/pie**
(start/sweep/use-center).

Per-shape, every Compose Canvas capability is exposed:
- **Fill & stroke paint**: none / solid / linear / radial / sweep gradient
  (multi-stop, angle) → emits `Color` or `Brush.*`.
- **Stroke**: width, cap (Butt/Round/Square), join (Miter/Round/Bevel),
  dash pattern → `Stroke` + `PathEffect.dashPathEffect`.
- **Transform**: rotation (around center → `rotate()` wrapper).
- **Compositing**: opacity (alpha) + 19 blend modes (`BlendMode.*`).

Editor: select / move / resize / rotate handles, **drag-to-edit path & line
vertices**, layers (reorder, hide, duplicate, delete), grid + snap,
**zoom + pan** (scroll to zoom, space-drag to pan), light/dark toggle.

Pen tool (bezier): **click** = corner point, **click-drag** = smooth point with
control handles, click the first point or press **Enter** to finish, **Esc** to
cancel. Edit a selected path on-canvas: drag the square anchors, drag the round
control handles (Alt to break symmetry), double-click an anchor to toggle
corner/smooth. Emits `lineTo` / `quadraticBezierTo` / `cubicTo` (Canvas) and
`lineTo` / `quadTo` / `curveTo` (ImageVector).

Editing UX: **undo / redo** (history with burst-coalescing), **autosave** to
localStorage, **keyboard shortcuts** (V/R/O/G/A/L/P tools, Ctrl+Z/Y,
Ctrl+D duplicate, Ctrl+C/V, Delete, arrow-nudge, +/−/0 zoom, Esc),
**toasts** for actions, **haptic feedback** (`navigator.vibrate` on mobile)
plus press/hover/focus micro-interactions on every control, drag-to-scrub
number fields, eyedropper + recent-colour swatches.

Code: **Canvas DrawScope** or **ImageVector** output, color format
(`Color(0xFF…)` or `Color(r,g,b)`), toggle imports / `modifier` param,
**responsive mode** (`size.width × fraction`), copy + download `.kt`.

## Roadmap (next)

1. **SVG import** → parse into the Shape Model (reuse existing designs).
2. Bezier curve handles in the pen tool (`cubicTo`) — smooth chart curves.
3. Save/load project JSON (localStorage) + share-by-URL.
4. **Live Compose preview** via Kotlin/Wasm (the real moat).
5. **Data-bound chart mode** — define a shape as a function of `List<Float>`
   and emit a data-driven Canvas (solves charts properly).
6. Animation timeline → emit `Animatable` / `animateFloat`.

Adding an output format = one new file in `src/codegen/` that reads the Shape
Model. Adding a shape = extend `model/shapes.ts`, render it in `Editor.tsx`,
and handle it in each generator.
