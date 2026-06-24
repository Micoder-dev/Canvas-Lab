import type { Paint, PaintType } from '../model/shapes';
import { defaultStops } from '../model/shapes';
import { Segmented, Slider } from './ui';
import { fillCss } from './paintCss';

const types: { value: PaintType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'sweep', label: 'Sweep' },
];

export function PaintEditor({ paint, onChange }: { paint: Paint; onChange: (p: Paint) => void }) {
  const set = (patch: Partial<Paint>) => onChange({ ...paint, ...patch });
  const isGrad = paint.type === 'linear' || paint.type === 'radial' || paint.type === 'sweep';

  return (
    <div className="field">
      <Segmented value={paint.type} options={types} onChange={(t) => {
        if ((t === 'linear' || t === 'radial' || t === 'sweep') && paint.stops.length < 2) set({ type: t, stops: defaultStops() });
        else set({ type: t });
      }} />

      {paint.type === 'solid' && (
        <span className="color" style={{ marginTop: 8 }}>
          <input type="color" value={paint.color} onChange={(e) => set({ color: e.target.value })} />
          <input className="in hex" value={paint.color.toUpperCase()} onChange={(e) => set({ color: e.target.value })} />
        </span>
      )}

      {isGrad && (
        <div style={{ marginTop: 8 }}>
          <div className="gradbar" style={{ background: fillCss(paint), marginBottom: 8 }} />
          <div className="stops">
            {paint.stops.map((st, i) => (
              <div className="stop" key={i}>
                <input type="color" value={st.color} onChange={(e) => {
                  const stops = paint.stops.slice(); stops[i] = { ...st, color: e.target.value }; set({ stops });
                }} />
                <input type="range" min={0} max={1} step={0.01} value={st.pos} onChange={(e) => {
                  const stops = paint.stops.slice(); stops[i] = { ...st, pos: parseFloat(e.target.value) }; set({ stops });
                }} />
                <button className="iconbtn del" title="remove stop" disabled={paint.stops.length <= 2}
                  onClick={() => set({ stops: paint.stops.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
          </div>
          <button className="vx-chip" style={{ marginTop: 8 }}
            onClick={() => set({ stops: [...paint.stops, { color: '#ffffff', pos: 1 }] })}>+ Add stop</button>
          {paint.type === 'linear' && (
            <Slider label="Angle" format={(v) => `${Math.round(v)}°`} min={0} max={360} step={1} value={paint.angle}
              onChange={(v) => set({ angle: v })} />
          )}
        </div>
      )}
    </div>
  );
}
