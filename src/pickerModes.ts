import { converter, parse } from "culori";
import { cssColor, parseColor, round, sampleColor, type Color } from "./color";
import type { PickerMode } from "./workspace";
const toLch = converter("lch");
const toHsl = converter("hsl");
const toOklch = converter("oklch");
export type Coordinates = [number, number, number];
const coordinateCache = new WeakMap<
  Color,
  Partial<Record<PickerMode, Coordinates>>
>();
export const cssFunctions = {
  RGB: "rgb",
  HSL: "hsl",
  HCL: "lch",
  OKHCL: "oklch",
} satisfies Record<PickerMode, string>;

export function pickerExpression(
  color: Color,
  mode: PickerMode,
  percent = false,
) {
  if (!percent) {
    if (mode === "RGB") return sampleColor(cssColor(color)).hex;
    if (mode === "OKHCL") return cssColor(color);
    const [x, y, z] = coordinates(color, mode);
    return coordinateCss(
      [round(x, 3), round(y, 3), round(z, 3)],
      mode,
      round(color.a),
    );
  }
  const values = coordinates(color, mode).map(
    (value, index) => `${round((value / channels[mode][index].max) * 100, 2)}%`,
  );
  if (mode === "HCL" || mode === "OKHCL") values.reverse();
  return `${cssFunctions[mode]}(${values.join(" ")} / ${round(color.a * 100, 2)}%)`;
}

// Hue percentages are editor notation, scaled to a full turn rather than CSS angles.
export function parsePickerExpression(
  text: string,
  mode: PickerMode,
  percent = false,
): Color | null {
  if (!percent) {
    if (mode === "OKHCL") return parseColor(text);
    const parsed = parse(text.trim().toLowerCase());
    const expectedMode =
      mode === "RGB" ? "rgb" : mode === "HSL" ? "hsl" : "lch";
    if (!parsed || parsed.mode !== expectedMode) return null;
    const color = toOklch(parsed);
    const result = {
      l: color.l,
      c: color.c,
      h: color.h ?? 0,
      a: color.alpha ?? 1,
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  }
  const match = text
    .trim()
    .match(
      /^(rgb|hsl|lch|oklch)\(\s*([\d.+-]+)%\s+([\d.+-]+)%\s+([\d.+-]+)%\s*\/\s*([\d.+-]+)%\s*\)$/i,
    );
  if (!match || match[1].toLowerCase() !== cssFunctions[mode]) return null;
  const values = [Number(match[2]), Number(match[3]), Number(match[4])];
  const alpha = Number(match[5]) / 100;
  if (
    ![...values, alpha].every(Number.isFinite) ||
    values.some((v) => v < 0) ||
    alpha < 0 ||
    alpha > 1
  )
    return null;
  if (mode === "HCL" || mode === "OKHCL") values.reverse();
  const [x, y, z] = values.map(
    (value, index) => (value / 100) * channels[mode][index].max,
  );
  return fromCoordinates([x, y, z], mode, alpha);
}
export function coordinates(color: Color, mode: PickerMode): Coordinates {
  let cached = coordinateCache.get(color);
  if (!cached) {
    cached = {};
    coordinateCache.set(color, cached);
  }
  return (cached[mode] ??= calculateCoordinates(color, mode));
}
function calculateCoordinates(color: Color, mode: PickerMode): Coordinates {
  if (mode === "OKHCL") return [color.h, color.c, color.l];
  if (mode === "HCL") {
    const c = toLch({ mode: "oklch", ...color });
    return [c.h ?? color.h, c.c, c.l];
  }
  // RGB and HSL describe the browser's opaque sRGB result, without alpha readback loss.
  if (mode === "RGB") {
    const [r, g, b] = sampleColor(cssColor({ ...color, a: 1 })).channels;
    return [r, g, b];
  }
  const [r, g, b] = coordinates(color, "RGB");
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
