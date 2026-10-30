import { converter } from "culori";
import { cssColor, sampleColor, type Color } from "./color";
import type { PickerMode } from "./workspace";
const toLch = converter("lch");
const toHsl = converter("hsl");
const toOklch = converter("oklch");
export type Coordinates = [number, number, number];
export function coordinates(color: Color, mode: PickerMode): Coordinates {
  if (mode === "OKHCL") return [color.h, color.c, color.l];
  if (mode === "HCL") {
    const c = toLch({ mode: "oklch", ...color });
    return [c.h ?? color.h, c.c, c.l];
  }
  // RGB and HSL describe the browser's opaque sRGB result, without alpha readback loss.
  const [r, g, b] = sampleColor(cssColor({ ...color, a: 1 })).channels;
  if (mode === "RGB") return [r, g, b];
  const c = toHsl({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return [c.h ?? color.h, c.s * 100, c.l * 100];
}
export function coordinateCss(
  [x, y, z]: Coordinates,
  mode: PickerMode,
  alpha = 1,
) {
  if (mode === "RGB") return `rgb(${x} ${y} ${z} / ${alpha})`;
  if (mode === "HSL") return `hsl(${x} ${y}% ${z}% / ${alpha})`;
  if (mode === "HCL") return `lch(${z} ${y} ${x} / ${alpha})`;
  return `oklch(${z} ${y} ${x} / ${alpha})`;
}
export function fromCoordinates(
  [x, y, z]: Coordinates,
  mode: PickerMode,
  a: number,
): Color {
  if (mode === "OKHCL") return { h: x, c: y, l: z, a };
  const c =
    mode === "RGB"
      ? toOklch({ mode: "rgb", r: x / 255, g: y / 255, b: z / 255 })
      : mode === "HSL"
        ? toOklch({ mode: "hsl", h: x, s: y / 100, l: z / 100 })
        : toOklch({ mode: "lch", h: x, c: y, l: z });
  return { l: c.l, c: c.c, h: c.h ?? 0, a };
}
export const channels = {
  RGB: [
    { name: "Red", max: 255, unit: "", step: 1 },
    { name: "Green", max: 255, unit: "", step: 1 },
    { name: "Blue", max: 255, unit: "", step: 1 },
  ],
  HSL: [
    { name: "Hue", max: 360, unit: "°", step: 0.1 },
    { name: "Saturation", max: 100, unit: "%", step: 0.1 },
    { name: "Lightness", max: 100, unit: "%", step: 0.1 },
  ],
  HCL: [
    { name: "Hue", max: 360, unit: "°", step: 0.1 },
    { name: "Chroma", max: 150, unit: "", step: 0.1 },
    { name: "Lightness", max: 100, unit: "%", step: 0.1 },
  ],
  OKHCL: [
    { name: "Hue", max: 360, unit: "°", step: 0.1 },
    { name: "Chroma", max: 0.4, unit: "", step: 0.001 },
    { name: "Lightness", max: 1, unit: "", step: 0.001 },
  ],
} satisfies Record<
  PickerMode,
  { name: string; max: number; unit: string; step: number }[]
>;
