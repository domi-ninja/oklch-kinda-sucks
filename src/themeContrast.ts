import { converter, toGamut } from "culori";
import { APCAcontrast, displayP3toY } from "apca-w3";
import { clampColor } from "./colorBounds";
import type { Color } from "./color";

const toP3 = toGamut("p3", "oklch", null, 0);
const toOklch = converter("oklch");
const toXYZ = converter("xyz65");
export const black: Color = { l: 0, c: 0, h: 0, a: 1 };
export const white: Color = { l: 1, c: 0, h: 0, a: 1 };
export function fitColor(color: Color): Color {
  if (color.l >= 1 - 1e-12) return { ...color, l: 1, c: 0, a: 1 };
  if (color.l <= 1e-12) return { ...color, l: 0, c: 0, a: 1 };
  const mapped = toOklch(toP3({ mode: "oklch", ...color }));
  return clampColor({ ...color, l: mapped.l, c: mapped.c, a: 1 });
}
function apcaY(color: Color) {
  const rgb = toP3({ mode: "oklch", ...color });
  return displayP3toY([rgb.r, rgb.g, rgb.b]);
}
export function apcaContrast(ink: Color, fill: Color) {
  return Math.abs(APCAcontrast(apcaY(ink), apcaY(fill)));
}
function relativeY(color: Color) {
  return Math.max(0, Math.min(1, toXYZ(toP3({ mode: "oklch", ...color })).y));
}
export function contrastRatio(a: Color, b: Color) {
  const x = relativeY(a),
    y = relativeY(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function sharedThemeInk(backgrounds: Color[]): Color {
  const dark = Math.min(...backgrounds.map((bg) => contrastRatio(black, bg)));
  const light = Math.min(...backgrounds.map((bg) => contrastRatio(white, bg)));
  return dark >= light ? black : white;
}
export function themeInk(background: Color): Color {
  return sharedThemeInk([background]);
}

// Binary searches change only lightness; gamut fitting retains as much source chroma as possible.
export function solveTextContrast(color: Color, target: number, ink: Color) {
  let low = 0,
    high = 1;
  for (let i = 0; i < 22; i++) {
    const l = (low + high) / 2,
      measured = apcaContrast(ink, fitColor({ ...color, l }));
    if (ink.l === 0 ? measured < target : measured > target) low = l;
    else high = l;
  }
  return fitColor({ ...color, l: ink.l === 0 ? high : low });
}
export function contrastTone(
  color: Color,
  position: number,
  background = white,
): Color {
  if (position === 0) return white;
  if (position === 1) return black;
  const start = apcaContrast(white, background),
    end = apcaContrast(black, background);
  const target = start + (end - start) * position;
  let low = 0,
    high = 1;
  for (let i = 0; i < 22; i++) {
    const l = (low + high) / 2,
      measured = apcaContrast(fitColor({ ...color, l }), background);
    if (background.l === 1 ? measured > target : measured < target) low = l;
    else high = l;
  }
  // APCA clips near-zero contrast. Choose the closest attainable side of that gap.
  const candidates = [
    fitColor({ ...color, l: low }),
    fitColor({ ...color, l: high }),
  ];
  return candidates.reduce((best, candidate) =>
    Math.abs(apcaContrast(candidate, background) - target) <
    Math.abs(apcaContrast(best, background) - target)
      ? candidate
      : best,
  );
}
