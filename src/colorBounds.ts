import type { Color } from "./color";

export function clampChannel(value: number, max: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
}

export function clampColor(color: Color): Color {
  return {
    l: clampChannel(color.l, 1),
    c: clampChannel(color.c, 0.4),
    h: Number.isFinite(color.h)
      ? color.h >= 0 && color.h < 360
        ? color.h
        : ((color.h % 360) + 360) % 360
      : 0,
    a: clampChannel(color.a, 1),
  };
}
