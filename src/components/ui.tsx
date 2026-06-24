import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { haptics } from '../lib/haptics';

/* ---------- Collapsible block (smooth grid-rows animation) ---------- */
export function Block({ title, icon, right, children, defaultOpen = true }: {
  title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`block${open ? '' : ' collapsed'}`}>
      <div className="block__head" onClick={() => setOpen((o) => !o)}>
        <span className="chev">▾</span>
        {icon && <span className="block__icon">{icon}</span>}
        <h4>{title}</h4>
        <span className="spacer" />
        {right && <span onClick={(e) => e.stopPropagation()}>{right}</span>}
      </div>
      <div className="block__wrap"><div className="block__body">{children}</div></div>
    </div>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

/* ---------- Number field with drag-to-scrub label ---------- */
export function NumberField({ label, value, onChange, step = 1, min, max, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string;
}) {
  const begin = useStore((s) => s.beginEdit);
  const drag = useRef<{ x: number; v: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, v: value };
    begin();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dv = (e.clientX - drag.current.x) * step;
    onChange(round(clamp(drag.current.v + dv, min, max)));
  };
  const onUp = (e: React.PointerEvent) => {
    if (drag.current) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  return (
    <label className="field num">
      <span className="lbl scrub" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} title="drag to scrub">{label}</span>
      <span className="num__box">
        <input className="in" type="number" step={step} min={min} max={max} value={round(value)}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0, min, max))} />
        {suffix && <span className="num__suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      <input className="in" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[] | { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      <Dropdown value={value} options={options} onChange={onChange} />
    </label>
  );
}

type Opt<T> = { value: T; label: string; icon?: ReactNode; group?: string };

/* Theme-native dropdown (portal popover) — the OS <select> list never matched the theme. */
export function Dropdown<T extends string>({ value, options, onChange }: {
  value: T; options: readonly T[] | Opt<T>[]; onChange: (v: T) => void;
}) {
  const opts: Opt<T>[] = options.map((o) => (typeof o === 'string' ? { value: o as T, label: o as string } : o));
  const cur = opts.find((o) => o.value === value);
  // preserve group order as first seen
  const groups: string[] = [];
  opts.forEach((o) => { const g = o.group ?? ''; if (!groups.includes(g)) groups.push(g); });
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { const t = e.target as Node; if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const reposition = () => setOpen(false);
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); };
  }, [open]);

  const toggle = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); setOpen((o) => !o); };

  let popStyle: React.CSSProperties = {};
  if (rect) {
    const below = window.innerHeight - rect.bottom;
    const up = below < 260 && rect.top > below;
    popStyle = { position: 'fixed', left: rect.left, width: rect.width, maxHeight: 256,
      ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) };
  }

  return (
    <>
      <button ref={btnRef} type="button" className={`dd${open ? ' open' : ''}`} onClick={toggle}>
        <span className="dd__val">{cur?.icon}{cur?.label ?? value}</span>
        <span className="dd__chev">▾</span>
      </button>
      {open && rect && createPortal(
        <div ref={popRef} className="dd-pop" style={popStyle}>
          {groups.map((g) => (
            <div key={g || '_'}>
              {g && <div className="dd-group">{g}</div>}
              {opts.filter((o) => (o.group ?? '') === g).map((o) => (
                <button key={o.value} type="button" className={`dd-opt${o.value === value ? ' on' : ''}`}
                  onClick={() => { onChange(o.value); setOpen(false); haptics.select(); }}>
                  <span className="dd-opt__l">{o.icon}{o.label}</span>{o.value === value && <span className="dd-opt__check">✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>, document.body)}
    </>
  );
}

/* ---------- Color field with hex + recent swatches + eyedropper ---------- */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      <ColorControl value={value} onChange={onChange} />
    </label>
  );
}

export function ColorControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const recent = useStore((s) => s.recentColors);
  const push = useStore((s) => s.pushRecentColor);
  const commit = (c: string) => { onChange(c); };
  const eyedropper = async () => {
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) return;
    try { const r = await new ED().open(); commit(r.sRGBHex); push(r.sRGBHex); } catch { /* cancelled */ }
  };
  return (
    <div className="colorctl">
      <div className="color">
        <span className="color__chip" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => commit(e.target.value)} onBlur={(e) => push(e.target.value)} />
        </span>
        <input className="in hex" value={value.toUpperCase()} onChange={(e) => commit(e.target.value)} onBlur={(e) => push(e.target.value)} />
        {'EyeDropper' in window && <button type="button" className="iconbtn pick" title="pick colour" onClick={eyedropper}>⦿</button>}
      </div>
      <div className="swrow">
        {recent.slice(0, 9).map((c) => (
          <button type="button" key={c} className="sw" style={{ background: c }} title={c} onClick={() => commit(c)} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Slider with floating value bubble ---------- */
export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="field">
      <span className="lbl lbl--row"><span>{label}</span><b className="lbl__val">{format ? format(value) : round(value)}</b></span>
      <span className="slider">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ ['--pct' as string]: `${pct}%` }} />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, accent = false }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; accent?: boolean;
}) {
  return (
    <div className={`seg2${accent ? ' seg2--accent' : ''}`}>
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => { onChange(o.value); haptics.select(); }}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="vx-switch" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" /><span className="knob" />
    </label>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field row"><span className="lbl">{label}</span>{children}</div>;
}

export function IconBtn({ title, onClick, children, danger }: { title: string; onClick: (e: React.MouseEvent) => void; children: ReactNode; danger?: boolean }) {
  return <button className={`iconbtn${danger ? ' danger' : ''}`} title={title} onClick={onClick}>{children}</button>;
}
