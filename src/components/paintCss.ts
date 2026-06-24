import type { Paint } from '../model/shapes';

const stopsCss = (p: Paint) =>
  p.stops.slice().sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${Math.round(s.pos * 100)}%`).join(', ');

export function fillCss(p: Paint): string {
  switch (p.type) {
    case 'none': return 'repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%) 0 0 / 8px 8px';
    case 'solid': return p.color;
    case 'linear': return `linear-gradient(${p.angle + 90}deg, ${stopsCss(p)})`;
    case 'radial': return `radial-gradient(circle, ${stopsCss(p)})`;
    case 'sweep': return `conic-gradient(${stopsCss(p)})`;
  }
}
