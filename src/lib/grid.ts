// Shared graph-grid math so the infinite background grid and the snapping
// logic agree on the same "nice" step (1 / 2 / 5 × 10ⁿ), Desmos-style.

export function niceStep(raw: number): number {
  if (raw <= 0 || !isFinite(raw)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return m * pow;
}

// Minor step targets ~64px on screen at the current zoom; major = 5 minors.
export function gridStep(zoom: number): { minor: number; major: number } {
  const minor = niceStep(64 / zoom);
  return { minor, major: minor * 5 };
}

// Snap a value: to the grid step when snapping is on, otherwise to whole units
// (so resizes are always round, never 119.73).
export function snapValue(v: number, step: number | null): number {
  return step ? Math.round(v / step) * step : Math.round(v);
}
