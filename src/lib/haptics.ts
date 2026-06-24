// Tactile feedback. Uses the Vibration API where available (Android / mobile),
// degrades to a no-op on desktop where the visual press-states carry the feel.

const can = typeof navigator !== 'undefined' && 'vibrate' in navigator;
let enabled = true;

function buzz(pattern: number | number[]) {
  if (!enabled || !can) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}

export const haptics = {
  setEnabled(v: boolean) { enabled = v; },
  tap() { buzz(8); },          // light press
  select() { buzz(12); },      // selection / tool change
  bump() { buzz([0, 10, 30, 10]); }, // boundary / snap
  success() { buzz([0, 12, 24, 18]); },
  warn() { buzz([0, 30, 40, 30]); },
};

// One delegated listener gives every button a press buzz without per-component wiring.
export function installGlobalHaptics() {
  if (typeof window === 'undefined') return;
  window.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest('button, [role="button"], .toolbtn, .iconbtn, .seg2 button, input[type="range"], input[type="checkbox"], input[type="color"]')) {
      haptics.tap();
    }
  }, { passive: true, capture: true });
}
