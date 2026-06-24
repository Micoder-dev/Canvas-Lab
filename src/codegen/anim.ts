// Animation codegen: turns each shape's `anim` into Compose animation state
// (rememberInfiniteTransition / Animatable) + per-shape transform/alpha/dash/trace.

import type { Shape } from '../model/shapes';
import type { Ctx } from './utils';
import { f } from './utils';

const EASING: Record<string, string> = {
  linear: 'LinearEasing', easeInOut: 'FastOutSlowInEasing', easeIn: 'FastOutLinearInEasing', easeOut: 'LinearOutSlowInEasing',
};

export interface ShapeAnimApply {
  rotate?: string; scale?: string; translateY?: string; alpha?: string; dashPhase?: string; trace?: string;
}
export interface AnimPlan { decls: string[]; apply: (i: number) => ShapeAnimApply | null; }

const sumDash = (s: Shape) => (s.dash.length ? s.dash.reduce((a, b) => a + b, 0) : 24);

export function planAnim(shapes: Shape[], c: Ctx): AnimPlan {
  const animated = shapes.map((s, i) => ({ s, i })).filter((x) => x.s.anim && x.s.anim.preset !== 'none');
  if (!animated.length) return { decls: [], apply: () => null };

  const I = c.imports;
  I.add('import androidx.compose.runtime.getValue');
  I.add('import androidx.compose.animation.core.tween');

  const decls: string[] = [];
  const applies = new Map<number, ShapeAnimApply>();
  const easings = new Set<string>();
  const hasInfinite = animated.some((x) => x.s.anim.repeat !== 'once');
  if (hasInfinite) {
    I.add('import androidx.compose.animation.core.rememberInfiniteTransition');
    I.add('import androidx.compose.animation.core.animateFloat');
    I.add('import androidx.compose.animation.core.infiniteRepeatable');
    I.add('import androidx.compose.animation.core.RepeatMode');
    decls.push('val transition = rememberInfiniteTransition(label = "anim")');
  }

  animated.forEach(({ s, i }) => {
    const a = s.anim; const v = `anim${i}`;
    const ref = a.repeat === 'once' ? `${v}.value` : v;
    const easing = EASING[a.easing]; easings.add(easing);
    let init = 0, target = 1; const ap: ShapeAnimApply = {};
    switch (a.preset) {
      case 'spin': init = 0; target = 360; ap.rotate = ref; break;
      case 'wiggle': init = -a.amount * 12; target = a.amount * 12; ap.rotate = ref; break;
      case 'pulse': init = 1; target = 1 + a.amount * 0.2; ap.scale = ref; break;
      case 'float': init = 0; target = -a.amount * 12; ap.translateY = ref; break;
      case 'fade': init = 0.2; target = 1; ap.alpha = ref; break;
      case 'dash': init = 0; target = sumDash(s); ap.dashPhase = ref; break;
      case 'trace': init = 0; target = 1; ap.trace = ref; break;
      default: return;
    }
    const tween = `tween(durationMillis = ${Math.round(a.duration)}${a.delay ? `, delayMillis = ${Math.round(a.delay)}` : ''}, easing = ${easing})`;
    if (a.repeat === 'once') {
      I.add('import androidx.compose.runtime.remember');
      I.add('import androidx.compose.runtime.LaunchedEffect');
      I.add('import androidx.compose.animation.core.Animatable');
      decls.push(`val ${v} = remember { Animatable(${f(init)}) }`);
      decls.push(`LaunchedEffect(Unit) { ${v}.animateTo(${f(target)}, animationSpec = ${tween}) }`);
    } else {
      const mode = a.repeat === 'reverse' ? 'Reverse' : 'Restart';
      decls.push(`val ${v} by transition.animateFloat(`);
      decls.push(`    initialValue = ${f(init)}, targetValue = ${f(target)},`);
      decls.push(`    animationSpec = infiniteRepeatable(animation = ${tween}, repeatMode = RepeatMode.${mode}), label = "${v}",`);
      decls.push(')');
    }
    applies.set(i, ap);
  });
  easings.forEach((e) => I.add('import androidx.compose.animation.core.' + e));
  return { decls, apply: (i) => applies.get(i) ?? null };
}
