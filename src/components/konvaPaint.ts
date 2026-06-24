import type { Box, Paint, Shape } from '../model/shapes';

// Konva gradient points live in the node's LOCAL coordinate space.
// localBox describes the shape's extent in that space.
export function fillProps(p: Paint, localBox: Box): Record<string, unknown> {
  if (p.type === 'none') return { fill: undefined };
  if (p.type === 'solid') return { fill: p.color };

  const stops = p.stops.slice().sort((a, b) => a.pos - b.pos);
  const colorStops = stops.flatMap((s) => [s.pos, s.color]);
  const cx = localBox.x + localBox.w / 2;
  const cy = localBox.y + localBox.h / 2;

  if (p.type === 'linear') {
    const rad = (p.angle * Math.PI) / 180;
    const len = Math.abs(localBox.w * Math.cos(rad)) + Math.abs(localBox.h * Math.sin(rad));
    return {
      fillLinearGradientStartPoint: { x: cx - (Math.cos(rad) * len) / 2, y: cy - (Math.sin(rad) * len) / 2 },
      fillLinearGradientEndPoint: { x: cx + (Math.cos(rad) * len) / 2, y: cy + (Math.sin(rad) * len) / 2 },
      fillLinearGradientColorStops: colorStops,
    };
  }
  if (p.type === 'radial') {
    const r = Math.max(localBox.w, localBox.h) / 2;
    return {
      fillRadialGradientStartPoint: { x: cx, y: cy },
      fillRadialGradientEndPoint: { x: cx, y: cy },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: r,
      fillRadialGradientColorStops: colorStops,
    };
  }
  // sweep — Konva has no sweep gradient; approximate with the first stop colour
  return { fill: stops[0]?.color ?? '#888888' };
}

// Konva can't do gradient strokes — fall back to the first stop colour.
export function strokeColor(p: Paint): string | undefined {
  if (p.type === 'none') return undefined;
  if (p.type === 'solid') return p.color;
  return p.stops[0]?.color ?? '#888888';
}

export function strokeProps(s: Shape): Record<string, unknown> {
  const col = strokeColor(s.stroke);
  return {
    stroke: col,
    strokeWidth: col ? s.strokeWidth : 0,
    dash: s.dash.length ? s.dash : undefined,
    lineCap: s.cap.toLowerCase(),
    lineJoin: s.join.toLowerCase(),
    strokeScaleEnabled: false,
  };
}
