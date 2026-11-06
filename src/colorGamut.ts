import { converter, parse } from "culori";
import { round, type Color } from "./color";
import { clampColor } from "./colorBounds";

const toRgb = converter("rgb");
const toP3 = converter("p3");
const toOklch = converter("oklch");

// Inspect the source color before canvas readback or gamut mapping can clip it.
export function colorGamut(color: Color) {
  const source = { mode: "oklch", ...color, alpha: color.a } as const;
  const rgb = toRgb(source);
  const p3 = toP3(source);
  const inside = ({ r, g, b }: Pick<typeof rgb, "r" | "g" | "b">) =>
    [r, g, b].every((value) => value >= -0.00001 && value <= 1.00001);
  return {
    srgb: inside(rgb),
    p3: inside(p3),
    srgbChannels: [rgb.r, rgb.g, rgb.b].map((value) => round(value * 255, 2)),
    p3Css: `color(display-p3 ${[p3.r, p3.g, p3.b].map((value) => round(value, 6)).join(" ")} / ${round(color.a, 6)})`,
  };
}

export function parseDisplayP3(text: string): Color | null {
  const parsed = parse(text.trim());
  if (!parsed || parsed.mode !== "p3") return null;
  const color = toOklch(parsed);
  const result = {
    l: color.l,
    c: color.c,
    h: color.h ?? 0,
    a: color.alpha ?? 1,
  };
  return Object.values(result).every(Number.isFinite) &&
    result.a >= 0 &&
    result.a <= 1
    ? clampColor(result)
    : null;
}
